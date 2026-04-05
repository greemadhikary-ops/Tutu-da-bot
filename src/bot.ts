import { Bot, Context } from 'grammy';
import { config, validateConfig, printConfig } from './config.js';
import {
  FileEntry,
  generateFileId,
  addFile,
  getFile,
  deleteFile,
  getUserFiles,
  getAllFiles,
  getExpiredFiles,
  trackUser,
  updateUserStats,
  getAllUsers,
  getBotStats,
  formatFileSize,
  saveData,
} from './store.js';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';

let bot: Bot;

export function createBot(): Bot {
  const errors = validateConfig();
  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  }

  bot = new Bot(config.botToken);

  // ─── Command Handlers ───────────────────────────────────────

  // /start - Welcome message
  bot.command('start', async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    trackUser(user.id, `${user.first_name} ${user.last_name || ''}`.trim(), user.username);

    await ctx.reply(
      `👋 Hey <b>${user.first_name}</b>!\n\n` +
      `📎 I'm a <b>File Link Generator Bot</b>.\n\n` +
      `Send me any file and I'll instantly generate a shareable download link for it!\n\n` +
      `📂 <b>Supported files:</b>\n` +
      `  • Documents (PDF, DOCX, etc.)\n` +
      `  • Images & Photos\n` +
      `  • Videos\n` +
      `  • Audio files\n` +
      `  • Voice messages\n` +
      `  • Video notes\n\n` +
      `📋 <b>Commands:</b>\n` +
      `  /help — Show help\n` +
      `  /myfiles — View your uploaded files\n` +
      `  /delete &lt;id&gt; — Delete a file\n` +
      `  /info &lt;id&gt; — Get file details`,
      { parse_mode: 'HTML' }
    );
  });

  // /help - Help message
  bot.command('help', async (ctx) => {
    const isAdmin = ctx.from && config.adminIds.includes(ctx.from.id);

    await ctx.reply(
      `📖 <b>Help — File Link Generator Bot</b>\n\n` +
      `📤 <b>How to use:</b>\n` +
      `  Simply send me any file (document, photo, video, audio) and I'll generate a download link.\n\n` +
      `📋 <b>User Commands:</b>\n` +
      `  /myfiles — List your uploaded files\n` +
      `  /info &lt;id&gt; — Get details about a file\n` +
      `  /delete &lt;id&gt; — Delete your file\n\n` +
      (isAdmin ? (
        `🔒 <b>Admin Commands:</b>\n` +
        `  /stats — Bot statistics\n` +
        `  /allfiles — List all files\n` +
        `  /cleanup — Remove expired files\n` +
        `  /broadcast &lt;msg&gt; — Send to all users\n` +
        `  /deletefile &lt;id&gt; — Delete any file\n`
      ) : '') +
      `\n💡 <b>Tips:</b>\n` +
      `  • Files can be up to ${formatFileSize(config.maxFileSize)}\n` +
      `  • Links are permanent unless you delete the file\n` +
      `  • Share links with anyone — no login required`,
      { parse_mode: 'HTML' }
    );
  });

  // /myfiles - List user's files
  bot.command('myfiles', async (ctx) => {
    if (!ctx.from) return;

    const userFiles = getUserFiles(ctx.from.id);

    if (userFiles.length === 0) {
      await ctx.reply('📂 You haven\'t uploaded any files yet.\nSend me a file to get started!');
      return;
    }

    const fileList = userFiles.slice(-10).reverse().map((f, i) => {
      return `  ${i + 1}. <code>${f.id}</code> — ${truncate(f.originalName, 30)} (${formatFileSize(f.size)})\n` +
             `     ↕ ${f.downloadCount} downloads`;
    }).join('\n\n');

    const showMore = userFiles.length > 10
      ? `\n\n... and ${userFiles.length - 10} more files`
      : '';

    await ctx.reply(
      `📂 <b>Your Files</b> (${userFiles.length} total)\n\n${fileList}${showMore}`,
      { parse_mode: 'HTML' }
    );
  });

  // /info - Get file info
  bot.command('info', async (ctx) => {
    const fileId = ctx.message?.text?.split(' ')[1]?.trim();
    if (!fileId) {
      await ctx.reply('Usage: /info <file_id>');
      return;
    }

    const file = getFile(fileId);
    if (!file) {
      await ctx.reply('❌ File not found.');
      return;
    }

    const link = `${config.baseUrl}/d/${file.id}`;
    await ctx.reply(
      `📄 <b>File Details</b>\n\n` +
      `  🆔 ID: <code>${file.id}</code>\n` +
      `  📝 Name: ${escapeHtml(file.originalName)}\n` +
      `  📦 Type: ${file.mimeType}\n` +
      `  📏 Size: ${formatFileSize(file.size)}\n` +
      `  📤 Uploaded: ${formatDate(file.uploadedAt)}\n` +
      `  👤 By: ${escapeHtml(file.uploaderName)}${file.uploaderUsername ? ` (@${file.uploaderUsername})` : ''}\n` +
      `  ↕ Downloads: ${file.downloadCount}\n` +
      (file.expiresAt ? `  ⏰ Expires: ${formatDate(file.expiresAt)}\n` : '') +
      `  🔗 Link: ${link}`,
      { parse_mode: 'HTML' }
    );
  });

  // /delete - Delete own file
  bot.command('delete', async (ctx) => {
    if (!ctx.from) return;

    const fileId = ctx.message?.text?.split(' ')[1]?.trim();
    if (!fileId) {
      await ctx.reply('Usage: /delete <file_id>');
      return;
    }

    const file = getFile(fileId);
    if (!file) {
      await ctx.reply('❌ File not found.');
      return;
    }

    if (file.uploaderId !== ctx.from.id && !config.adminIds.includes(ctx.from.id)) {
      await ctx.reply('❌ You can only delete your own files.');
      return;
    }

    // Delete physical file
    try {
      await unlink(join(config.storageDir, file.storedName));
    } catch {
      // File may already be deleted
    }

    deleteFile(fileId);
    saveData();

    await ctx.reply(`✅ File "${truncate(file.originalName, 40)}" has been deleted.`);
  });

  // ─── Admin Commands ─────────────────────────────────────────

  // /stats
  bot.command('stats', async (ctx) => {
    if (!ctx.from || !config.adminIds.includes(ctx.from.id)) return;

    const stats = getBotStats();
    const expired = getExpiredFiles().length;

    await ctx.reply(
      `📊 <b>Bot Statistics</b>\n\n` +
      `  📁 Total Files: ${stats.totalFiles}\n` +
      `  👥 Total Users: ${stats.totalUsers}\n` +
      `  ↕ Total Downloads: ${stats.totalDownloads}\n` +
      `  💾 Total Storage: ${formatFileSize(stats.totalSize)}\n` +
      `  ⏰ Expired Files: ${expired}\n` +
      `  ⏱ Uptime: ${stats.uptime}`,
      { parse_mode: 'HTML' }
    );
  });

  // /allfiles
  bot.command('allfiles', async (ctx) => {
    if (!ctx.from || !config.adminIds.includes(ctx.from.id)) return;

    const files = getAllFiles();

    if (files.length === 0) {
      await ctx.reply('📂 No files uploaded yet.');
      return;
    }

    const fileList = files.slice(-15).reverse().map((f, i) => {
      return `${i + 1}. <code>${f.id}</code> — ${truncate(f.originalName, 25)} (${formatFileSize(f.size)}) by ${escapeHtml(f.uploaderName)} [↕${f.downloadCount}]`;
    }).join('\n');

    await ctx.reply(
      `📂 <b>All Files</b> (${files.length} total)\n\n${fileList}`,
      { parse_mode: 'HTML' }
    );
  });

  // /cleanup
  bot.command('cleanup', async (ctx) => {
    if (!ctx.from || !config.adminIds.includes(ctx.from.id)) return;

    const expired = getExpiredFiles();
    if (expired.length === 0) {
      await ctx.reply('✨ No expired files to clean up.');
      return;
    }

    for (const file of expired) {
      try {
        await unlink(join(config.storageDir, file.storedName));
      } catch { /* ignore */ }
      deleteFile(file.id);
    }
    saveData();

    await ctx.reply(`🧹 Cleaned up ${expired.length} expired file(s).`);
  });

  // /broadcast
  bot.command('broadcast', async (ctx) => {
    if (!ctx.from || !config.adminIds.includes(ctx.from.id)) return;

    const message = ctx.message?.text?.replace('/broadcast', '').trim();
    if (!message) {
      await ctx.reply('Usage: /broadcast <message>');
      return;
    }

    const allUsers = getAllUsers();
    let sent = 0;
    let failed = 0;

    for (const user of allUsers) {
      try {
        await bot.api.sendMessage(user.userId, `📢 <b>Broadcast</b>\n\n${message}`, { parse_mode: 'HTML' });
        sent++;
      } catch {
        failed++;
      }
    }

    await ctx.reply(`📢 Broadcast sent to ${sent} users (${failed} failed).`);
  });

  // /deletefile - Admin delete any file
  bot.command('deletefile', async (ctx) => {
    if (!ctx.from || !config.adminIds.includes(ctx.from.id)) return;

    const fileId = ctx.message?.text?.split(' ')[1]?.trim();
    if (!fileId) {
      await ctx.reply('Usage: /deletefile <file_id>');
      return;
    }

    const file = getFile(fileId);
    if (!file) {
      await ctx.reply('❌ File not found.');
      return;
    }

    try {
      await unlink(join(config.storageDir, file.storedName));
    } catch { /* ignore */ }

    deleteFile(fileId);
    saveData();

    await ctx.reply(`✅ Admin deleted file "${truncate(file.originalName, 40)}" (ID: ${fileId})`);
  });

  // ─── File Handlers ──────────────────────────────────────────

  // Handle documents
  bot.on('message:document', async (ctx) => {
    await handleFile(ctx, 'document');
  });

  // Handle photos (largest size)
  bot.on('message:photo', async (ctx) => {
    await handleFile(ctx, 'photo');
  });

  // Handle videos
  bot.on('message:video', async (ctx) => {
    await handleFile(ctx, 'video');
  });

  // Handle audio
  bot.on('message:audio', async (ctx) => {
    await handleFile(ctx, 'audio');
  });

  // Handle voice
  bot.on('message:voice', async (ctx) => {
    await handleFile(ctx, 'voice');
  });

  // Handle video notes
  bot.on('message:video_note', async (ctx) => {
    await handleFile(ctx, 'video_note');
  });

  return bot;
}

// ─── File Processing ──────────────────────────────────────────

async function handleFile(
  ctx: Context,
  fileType: FileEntry['fileType']
): Promise<void> {
  if (!ctx.from || !ctx.message) return;

  const user = ctx.from;
  trackUser(user.id, `${user.first_name} ${user.last_name || ''}`.trim(), user.username);

  // Get file info from context
  let fileInfo: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };

  switch (fileType) {
    case 'document':
      fileInfo = ctx.message.document!;
      break;
    case 'photo': {
      const photos = ctx.message.photo!;
      fileInfo = photos[photos.length - 1]; // Largest
      break;
    }
    case 'video':
      fileInfo = ctx.message.video!;
      break;
    case 'audio':
      fileInfo = ctx.message.audio!;
      break;
    case 'voice':
      fileInfo = ctx.message.voice!;
      break;
    case 'video_note':
      fileInfo = ctx.message.video_note!;
      break;
  }

  const fileSize = fileInfo.file_size || 0;
  const fileName = fileInfo.file_name || `${fileType}_${fileInfo.file_unique_id}.${getExtension(fileType, fileInfo.mime_type)}`;
  const mimeType = fileInfo.mime_type || 'application/octet-stream';

  // Check file size
  if (fileSize > config.maxFileSize) {
    await ctx.reply(
      `❌ File too large!\n\n` +
      `📏 File size: ${formatFileSize(fileSize)}\n` +
      `📏 Max allowed: ${formatFileSize(config.maxFileSize)}\n\n` +
      `Please send a smaller file.`
    );
    return;
  }

  // Check user file limit
  if (config.maxFilesPerUser > 0) {
    const userFiles = getUserFiles(user.id);
    if (userFiles.length >= config.maxFilesPerUser) {
      await ctx.reply(
        `❌ You've reached the file limit!\n\n` +
        `📁 Files: ${userFiles.length}/${config.maxFilesPerUser}\n` +
        `Delete some files with /delete <id>`
      );
      return;
    }
  }

  // Send processing message
  const processingMsg = await ctx.reply('⏳ Downloading file...');

  try {
    // Download file from Telegram
    const file = await ctx.api.getFile(fileInfo.file_id);
    if (!file.file_path) {
      await ctx.editMessageText(processingMsg.message_id, '❌ Failed to download file from Telegram.');
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      await ctx.editMessageText(processingMsg.message_id, '❌ Failed to download file.');
      return;
    }

    const buffer = await response.arrayBuffer();
    const fileId = generateFileId();
    const storedName = `${fileId}_${sanitizeFileName(fileName)}`;
    const storagePath = join(config.storageDir, storedName);

    // Ensure storage directory exists
    await mkdir(config.storageDir, { recursive: true });

    // Save file
    await writeFile(storagePath, Buffer.from(buffer));

    // Create file entry
    const entry: FileEntry = {
      id: fileId,
      originalName: fileName,
      storedName,
      mimeType,
      size: buffer.byteLength,
      uploaderId: user.id,
      uploaderName: `${user.first_name} ${user.last_name || ''}`.trim(),
      uploaderUsername: user.username || undefined,
      uploadedAt: new Date().toISOString(),
      downloadCount: 0,
      telegramFileId: fileInfo.file_id,
      fileType,
    };

    if (config.defaultExpiryHours > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + config.defaultExpiryHours);
      entry.expiresAt = expiresAt.toISOString();
    }

    addFile(entry);
    updateUserStats(user.id, buffer.byteLength);
    saveData();

    const downloadLink = `${config.baseUrl}/d/${fileId}`;
    const infoLink = `${config.baseUrl}/f/${fileId}`;

    // Build response
    const expiryText = entry.expiresAt
      ? `\n⏰ Expires: ${formatDate(entry.expiresAt)}`
      : '';

    await ctx.editMessageText(
      `✅ <b>File uploaded successfully!</b>\n\n` +
      `📄 <b>${escapeHtml(fileName)}</b>\n` +
      `📏 Size: ${formatFileSize(buffer.byteLength)}\n` +
      `📦 Type: ${mimeType}${expiryText}\n\n` +
      `🔗 <b>Download Link:</b>\n<code>${downloadLink}</code>\n\n` +
      `ℹ️ <b>Info Page:</b>\n<code>${infoLink}</code>\n\n` +
      `💡 Share the download link with anyone!`,
      { parse_mode: 'HTML' }
    );

  } catch (err) {
    console.error('Error processing file:', err);
    await ctx.editMessageText(
      processingMsg.message_id,
      '❌ An error occurred while processing your file. Please try again.'
    );
  }
}

// ─── Utility Functions ────────────────────────────────────────

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(isoStr: string): string {
  const date = new Date(isoStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getExtension(fileType: string, mimeType?: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
  };

  if (mimeType && mimeMap[mimeType]) return mimeMap[mimeType];

  const typeMap: Record<string, string> = {
    photo: 'jpg',
    video: 'mp4',
    audio: 'mp3',
    voice: 'ogg',
    video_note: 'mp4',
    document: 'bin',
  };

  return typeMap[fileType] || 'bin';
}

export { bot };
    
