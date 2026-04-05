import { nanoid } from 'nanoid';

export interface FileEntry {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploaderId: number;
  uploaderName: string;
  uploaderUsername?: string;
  uploadedAt: string;
  downloadCount: number;
  expiresAt?: string;
  telegramFileId: string;
  fileType: 'document' | 'photo' | 'video' | 'audio' | 'voice' | 'video_note';
}

export interface UserStats {
  userId: number;
  username?: string;
  name: string;
  fileCount: number;
  totalSize: number;
  firstSeen: string;
  lastUpload: string;
}

export interface BotStats {
  totalFiles: number;
  totalUsers: number;
  totalDownloads: number;
  totalSize: number;
  uptime: string;
}

// In-memory file store
const files = new Map<string, FileEntry>();
const users = new Map<number, UserStats>();

const startTime = new Date();

export function getStartTime(): Date {
  return startTime;
}

export function generateFileId(): string {
  return nanoid(10);
}

export function addFile(entry: FileEntry): void {
  files.set(entry.id, entry);
}

export function getFile(id: string): FileEntry | undefined {
  return files.get(id);
}

export function deleteFile(id: string): boolean {
  return files.delete(id);
}

export function incrementDownload(id: string): void {
  const file = files.get(id);
  if (file) {
    file.downloadCount++;
  }
}

export function getAllFiles(): FileEntry[] {
  return Array.from(files.values());
}

export function getUserFiles(userId: number): FileEntry[] {
  return Array.from(files.values()).filter(f => f.uploaderId === userId);
}

export function getExpiredFiles(): FileEntry[] {
  const now = new Date();
  return Array.from(files.values()).filter(f => f.expiresAt && new Date(f.expiresAt) < now);
}

export function trackUser(userId: number, name: string, username?: string): void {
  const existing = users.get(userId);
  if (existing) {
    existing.name = name;
    existing.username = username;
  } else {
    users.set(userId, {
      userId,
      name,
      username,
      fileCount: 0,
      totalSize: 0,
      firstSeen: new Date().toISOString(),
      lastUpload: new Date().toISOString(),
    });
  }
}

export function updateUserStats(userId: number, fileSize: number): void {
  const user = users.get(userId);
  if (user) {
    user.fileCount++;
    user.totalSize += fileSize;
    user.lastUpload = new Date().toISOString();
  }
}

export function getUserStats(userId: number): UserStats | undefined {
  return users.get(userId);
}

export function getAllUsers(): UserStats[] {
  return Array.from(users.values());
}

export function getBotStats(): BotStats {
  const allFiles = getAllFiles();
  return {
    totalFiles: allFiles.length,
    totalUsers: users.size,
    totalDownloads: allFiles.reduce((acc, f) => acc + f.downloadCount, 0),
    totalSize: allFiles.reduce((acc, f) => acc + f.size, 0),
    uptime: formatDuration(Date.now() - startTime.getTime()),
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Persistence - save/load from JSON
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'data', 'files.json');

export function saveData(): void {
  const data = {
    files: Array.from(files.entries()),
    users: Array.from(users.entries()),
  };
  try {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save data:', err);
  }
}

export function loadData(): void {
  try {
    if (!existsSync(DATA_FILE)) return;
    const raw = readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (data.files) {
      for (const [id, entry] of data.files) {
        files.set(id, entry as FileEntry);
      }
    }
    if (data.users) {
      for (const [id, stats] of data.users) {
        users.set(id as number, stats as UserStats);
      }
    }
    console.log(`Loaded ${files.size} files and ${users.size} users from storage`);
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}
