# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dil Reaktörü is a browser extension that translates YouTube video subtitles using AI. Users can watch videos with translated subtitles, click words for instant translation, and build a vocabulary notebook.

## Tech Stack

### Extension (Chrome + Firefox)
- **React 18** - UI components
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Manifest V3** - Extension platform

### Backend
- **Node.js + Express** - REST API server
- **PostgreSQL** - User data, cached subtitles, vocabulary (remote server)
- **Docker** - Container deployment (Coolify)

### AI Services
- **Primary:** Mistral AI (cost-effective, good quality)
- **Fallback:** Claude API, Google Gemini API
- **Whisper:** Local or API-based speech-to-text

## Common Commands

```bash
# Install dependencies
cd extension && npm install
cd ../backend && npm install

# Development (extension popup)
cd extension && npm run dev

# Build extension for production
cd extension && npm run build

# Start backend locally
cd backend && npm run dev

# Backend with Docker
cd backend && docker build -t dil-reaktoru-api .
docker run -p 3000:3000 --env-file .env dil-reaktoru-api
```

## Project Structure

```
├── extension/
│   ├── public/
│   │   ├── manifest.json       # Extension config
│   │   └── contentStyle.css    # YouTube overlay styles
│   ├── src/
│   │   ├── main.jsx            # Entry point
│   │   ├── App.jsx             # Main popup UI
│   │   ├── background.js       # Service worker
│   │   ├── contentScript.js    # YouTube page script
│   │   ├── components/         # React components
│   │   └── services/api.js     # API client
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── index.js            # Express app entry
│   │   ├── config/database.js  # PostgreSQL connection
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   └── middleware/         # Error handling, rate limiting
│   ├── schema.sql              # Database schema
│   ├── Dockerfile
│   └── docker-compose.yml
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | User registration |
| POST | /api/auth/login | User login |
| GET | /api/subtitle/youtube/:id | Get translated subtitles |
| POST | /api/translate | Single text translation |
| POST | /api/translate/batch | Batch translation |
| GET/POST | /api/user/vocabulary | Vocabulary CRUD |
| GET/PUT | /api/user/preferences | User settings |

## Environment Variables

Backend `.env`:
```
DATABASE_URL=postgresql://user:pass@host:5432/dil_reaktoru
JWT_SECRET=your-secret
MISTRAL_API_KEY=your-key
CLAUDE_API_KEY=your-key
GEMINI_API_KEY=your-key
PORT=3000
```

## Database Schema

Key tables:
- `users` - Account data
- `subtitles` - Cached translations (video_id, source_lang, target_lang)
- `bookmarks` - Timestamped notes
- `vocabulary` - Saved words with translations
- `user_settings` - Preferences

## Coolify Deployment

1. Create new service from Git repository
2. Set Docker Compose file path: `backend/docker-compose.yml`
3. Add environment variables in Coolify secrets
4. Configure health check: `GET /health`
