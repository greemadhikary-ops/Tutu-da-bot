# 📎 File Link Generator Telegram Bot

A powerful Telegram bot that automatically generates shareable download links for any uploaded file. Built with TypeScript, Grammy (Telegram Bot framework), and Hono (web server).

## ✨ Features

### 🚀 Core
- **Auto Link Generation** — Send any file and instantly get a shareable download link
- **Multiple File Types** — Supports documents, photos, videos, audio, voice messages, and video notes
- **Beautiful Info Pages** — Each file gets a stylish info page with download button
- **Download Tracking** — Track how many times each file is downloaded

### 👤 User Commands
- `/start` — Welcome message with instructions
- `/help` — Show all available commands
- `/myfiles` — View your uploaded files
- `/info <id>` — Get details about a specific file
- `/delete <id>` — Delete your own files

### 🔒 Admin Commands
- `/stats` — View bot statistics (files, users, downloads, storage)
- `/allfiles` — List all uploaded files
- `/cleanup` — Remove expired files
- `/broadcast <msg>` — Send message to all users
- `/deletefile <id>` — Delete any file

### 🛡️ Reliability
- **File Size Limits** — Configurable max file size
- **User Quotas** — Limit files per user
- **File Expiration** — Optional auto-expiration
- **Data Persistence** — Files & metadata saved to disk
- **Graceful Shutdown** — Auto-saves on SIGINT/SIGTERM

## 🚀 Setup

### 1. Create a Telegram Bot
1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **Bot Token** you receive

### 2. Install Dependencies
```bash
cd file-link-bot
bun install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and set:
- `BOT_TOKEN` — Your bot token from BotFather
- `BASE_URL` — Your public URL (e.g., `https://yourdomain.com`)
- `ADMIN_IDS` — Your Telegram user ID (comma-separated for multiple)

### 4. Run the Bot
```bash
bun run dev
```

### 5. Test
Send any file to your bot on Telegram. You'll receive an instant download link!

## 📂 Project Structure

```
file-link-bot/
├── src/
│   ├── index.ts      # Entry point — starts bot & web server
│   ├── bot.ts        # Telegram bot handlers & commands
│   ├── server.ts     # Hono web server (download links & pages)
│   ├── store.ts      # File metadata storage & persistence
│   └── config.ts     # Configuration & environment variables
├── storage/           # Uploaded files stored here
├── data/              # JSON persistence files
├── .env.example       # Environment variables template
├── package.json
└── README.md
```

## 🔗 URL Structure

| URL | Description |
|-----|-------------|
| `/` | Landing page with bot stats |
| `/d/:id` | Direct file download |
| `/f/:id` | File info page with download button |

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_TOKEN` | *(required)* | Telegram bot token from @BotFather |
| `SERVER_PORT` | `3001` | Port for the web server |
| `BASE_URL` | `http://localhost:3001` | Public URL for download links |
| `ADMIN_IDS` | *(none)* | Comma-separated admin Telegram user IDs |
| `MAX_FILE_SIZE` | `52428800` (50MB) | Maximum upload file size in bytes |
| `DEFAULT_EXPIRY_HOURS` | `0` (never) | Auto-expire files after N hours |
| `MAX_FILES_PER_USER` | `0` (unlimited) | Max files per user |
| `SAVE_INTERVAL` | `30` | Auto-save interval in seconds |

## 🛠 Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Telegram Framework:** Grammy
- **Web Server:** Hono
- **Storage:** Local filesystem + JSON persistence
