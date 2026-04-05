import { createBot } from './bot.js';
import { config, printConfig } from './config.js';
import { loadData, saveData } from './store.js';
import { serve } from '@hono/node-server';
import app from './server.js';
import { mkdir } from 'fs/promises';

async function main() {
  // Print config banner
  printConfig();

  // Load persisted data
  loadData();

  // Ensure storage directory exists
  await mkdir(config.storageDir, { recursive: true });
  await mkdir('./data', { recursive: true });
  console.log(`📁 Storage directory: ${config.storageDir}`);

  // Start web server for download links
  serve(
    {
      fetch: app.fetch,
      port: config.serverPort,
    },
    (info) => {
      console.log(`🌐 Web server running on http://localhost:${info.port}`);
    }
  );

  // Create and start Telegram bot
  const bot = createBot();

  // Auto-save data periodically
  setInterval(() => {
    saveData();
  }, config.saveIntervalSeconds * 1000);

  // Start bot with long polling
  console.log('🤖 Starting Telegram bot...');
  await bot.start({
    onStart: (info) => {
      console.log(`✅ Bot @${info.username} is running!`);
      console.log(`\n📋 Setup your bot with these environment variables:`);
      console.log(`   BOT_TOKEN=${config.botToken ? '***' : '(not set)'}`);
      console.log(`   BASE_URL=${config.baseUrl}`);
      console.log(`   ADMIN_IDS=${config.adminIds.join(',') || '(none)'}`);
      console.log(`   SERVER_PORT=${config.serverPort}`);
      console.log(`\n🎯 Send a file to your bot to generate a shareable link!\n`);
    },
  });
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  saveData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  saveData();
  process.exit(0);
});
