import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { join } from 'path';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { getFile, incrementDownload, formatFileSize, getAllFiles, getBotStats } from './store.js';
import { config } from './config.js';

const app = new Hono();

// ─── Landing Page ─────────────────────────────────────────────
app.get('/', async (c) => {
  const stats = getBotStats();

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📎 File Link Generator Bot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      text-align: center;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 1.1rem;
      color: #a0a0b0;
      margin-bottom: 30px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 30px 0;
    }
    .stat-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 20px;
      backdrop-filter: blur(10px);
    }
    .stat-number {
      font-size: 2rem;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label {
      font-size: 0.85rem;
      color: #888;
      margin-top: 5px;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin: 30px 0;
    }
    .feature {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 15px 10px;
      font-size: 0.9rem;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .feature-icon { font-size: 24px; margin-bottom: 8px; }
    .cta {
      display: inline-block;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 14px 40px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: bold;
      font-size: 1.1rem;
      margin-top: 20px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
    }
    .footer {
      margin-top: 40px;
      font-size: 0.8rem;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">📎</div>
    <h1>File Link Generator</h1>
    <p class="subtitle">Upload files to Telegram, get instant shareable download links</p>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-number">${stats.totalFiles}</div>
        <div class="stat-label">Files Hosted</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.totalDownloads}</div>
        <div class="stat-label">Downloads</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.totalUsers}</div>
        <div class="stat-label">Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${formatFileSize(stats.totalSize)}</div>
        <div class="stat-label">Total Storage</div>
      </div>
    </div>

    <div class="features">
      <div class="feature">
        <div class="feature-icon">📄</div>
        Any File Type
      </div>
      <div class="feature">
        <div class="feature-icon">🔗</div>
        Instant Links
      </div>
      <div class="feature">
        <div class="feature-icon">📊</div>
        Download Stats
      </div>
      <div class="feature">
        <div class="feature-icon">🔐</div>
        No Login Required
      </div>
    </div>

    <a href="https://t.me/BotFather" class="cta">Get Your Bot</a>

    <p class="footer">Powered by File Link Generator Bot</p>
  </div>
</body>
</html>`);
});

// ─── File Info Page ───────────────────────────────────────────
app.get('/f/:id', async (c) => {
  const fileId = c.req.param('id');
  const file = getFile(fileId);

  if (!file) {
    return c.html(errorPage('File Not Found', 'This file may have been deleted or expired.'));
  }

  // Check expiry
  if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
    return c.html(errorPage('File Expired', 'This file has expired and is no longer available.'));
  }

  const downloadLink = `${config.baseUrl}/d/${fileId}`;
  const icon = getFileIcon(file.fileType);

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(file.originalName)} — File Link</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      max-width: 500px;
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px;
      padding: 40px;
      backdrop-filter: blur(20px);
      text-align: center;
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 {
      font-size: 1.4rem;
      word-break: break-all;
      margin-bottom: 20px;
      line-height: 1.4;
    }
    .meta {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    .meta-item {
      background: rgba(255,255,255,0.08);
      padding: 10px 18px;
      border-radius: 12px;
      font-size: 0.85rem;
    }
    .meta-label { color: #888; font-size: 0.75rem; }
    .meta-value { font-weight: bold; margin-top: 4px; }
    .download-btn {
      display: inline-block;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 14px 40px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: bold;
      font-size: 1rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
    }
    .uploader {
      margin-top: 20px;
      font-size: 0.8rem;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${escapeHtml(file.originalName)}</h1>
    <div class="meta">
      <div class="meta-item">
        <div class="meta-label">Size</div>
        <div class="meta-value">${formatFileSize(file.size)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Type</div>
        <div class="meta-value">${escapeHtml(file.mimeType.split('/')[1]?.toUpperCase() || 'FILE')}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Downloads</div>
        <div class="meta-value">${file.downloadCount}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Uploaded</div>
        <div class="meta-value">${formatDate(file.uploadedAt)}</div>
      </div>
    </div>
    <a href="${downloadLink}" class="download-btn">⬇️ Download File</a>
    <p class="uploader">Uploaded by ${escapeHtml(file.uploaderName)}</p>
  </div>
</body>
</html>`);
});

// ─── Download Endpoint ────────────────────────────────────────
app.get('/d/:id', async (c) => {
  const fileId = c.req.param('id');
  const file = getFile(fileId);

  if (!file) {
    return c.notFound();
  }

  // Check expiry
  if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
    return c.html(errorPage('File Expired', 'This file has expired.'));
  }

  const filePath = join(config.storageDir, file.storedName);

  if (!existsSync(filePath)) {
    return c.notFound();
  }

  try {
    const fileBuffer = await readFile(filePath);
    incrementDownload(fileId);

    // Import saveData dynamically to avoid circular dependency
    const { saveData } = await import('./store.js');
    saveData();

    // Determine content disposition
    const encodedFileName = encodeURIComponent(file.originalName).replace(/['()]/g, escape);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': file.size.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return c.notFound();
  }
});

// ─── 404 Handler ──────────────────────────────────────────────
app.notFound((c) => {
  return c.html(errorPage('404 Not Found', 'The page you are looking for does not exist.'));
});

// ─── Utility Functions ────────────────────────────────────────

function errorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      text-align: center;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px;
      padding: 40px;
      backdrop-filter: blur(20px);
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { font-size: 1.5rem; margin-bottom: 10px; }
    p { color: #888; }
    a { color: #667eea; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">😔</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <br>
    <a href="/">← Go Home</a>
  </div>
</body>
</html>`;
}

function getFileIcon(fileType: string): string {
  const icons: Record<string, string> = {
    document: '📄',
    photo: '🖼️',
    video: '🎬',
    audio: '🎵',
    voice: '🎤',
    video_note: '🎥',
  };
  return icons[fileType] || '📎';
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
  });
}

export default app;
