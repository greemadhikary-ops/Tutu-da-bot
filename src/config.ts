// Bot Configuration
// Set these via environment variables or .env file

export interface Config {
  // Telegram Bot Token (required) - get from @BotFather
  botToken: string;

  // Admin Telegram user IDs (comma-separated) - for admin commands
  adminIds: number[];

  // Web server port for download links
  serverPort: number;

  // Base URL for download links (e.g., https://yourdomain.com)
  baseUrl: string;

  // Storage directory for uploaded files
  storageDir: string;

  // Max file size in bytes (default: 50MB)
  maxFileSize: number;

  // Default file expiration in hours (0 = never expires)
  defaultExpiryHours: number;

  // Max files per user (0 = unlimited)
  maxFilesPerUser: number;

  // Save data interval in seconds
  saveIntervalSeconds: number;
}

function getEnv(key: string, fallback: string = ''): string {
  return process.env[key] || fallback;
}

function getEnvNumber(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

function getEnvArray(key: string, fallback: number[] = []): number[] {
  const val = process.env[key];
  if (!val) return fallback;
  return val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

export const config: Config = {
  botToken: getEnv('BOT_TOKEN', ''),
  adminIds: getEnvArray('ADMIN_IDS', []),
  serverPort: getEnvNumber('SERVER_PORT', 3001),
  baseUrl: getEnv('BASE_URL', 'http://localhost:3001'),
  storageDir: getEnv('STORAGE_DIR', join(process.cwd(), 'storage')),
  maxFileSize: getEnvNumber('MAX_FILE_SIZE', 50 * 1024 * 1024), // 50MB
  defaultExpiryHours: getEnvNumber('DEFAULT_EXPIRY_HOURS', 0), // Never expires
  maxFilesPerUser: getEnvNumber('MAX_FILES_PER_USER', 0), // Unlimited
  saveIntervalSeconds: getEnvNumber('SAVE_INTERVAL', 30),
};

// Validate config
export function validateConfig(): string[] {
  const errors: string[] = [];

  if (!config.botToken) {
    errors.push('BOT_TOKEN is required. Get one from @BotFather on Telegram.');
  }

  return errors;
}

import { join } from 'path';

export function printConfig(): void {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     📎 File Link Generator Bot          ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Server Port:    ${config.serverPort.toString().padEnd(21)}║`);
  console.log(`║  Base URL:       ${config.baseUrl.substring(0, 21).padEnd(21)}║`);
  console.log(`║  Storage Dir:    ${config.storageDir.substring(0, 21).padEnd(21)}║`);
  console.log(`║  Max File Size:  ${(formatBytes(config.maxFileSize)).padEnd(21)}║`);
  console.log(`║  Admins:         ${config.adminIds.length.toString().padEnd(21)}║`);
  console.log(`║  Default Expiry: ${config.defaultExpiryHours ? `${config.defaultExpiryHours}h` : 'Never'.padEnd(21)}║`);
  console.log('╚══════════════════════════════════════════╝');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

