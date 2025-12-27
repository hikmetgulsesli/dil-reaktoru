# Dil Reaktörü - PRD

## 1. Amaç ve Vizyon
YouTube videoları için AI destekli subtitle translator browser extension geliştirmek. Kullanıcılar videoları izlerken otomatik olarak çevrilmiş altyazıları görebilsin ve kelime defteri oluşturabilsin.

## 2. Hedef Kullanıcılar
- Dil öğrenenler (özellikle İngilizce, İspanyolca, Fransızca, Almanca, Japonca, Kore)
- YouTube'da yabancı dil içerik izleyenler
- Altyazısı olmayan videoları çevirmek isteyenler

## 3. Özellikler

### 3.1 Core Features
- **Video URL'den Subtitle Çıkarma** - YouTube videolarından altyazı çıkarma veya Whisper ile sesden metin
- **AI Çeviri** - Mistral AI, Claude, Gemini ile context-aware çeviri
- **Dual Subtitle Overlay** - Orijinal + çevrilmiş altyazıları video üzerinde gösterme
- **Click-to-Translate** - Kelimeye tıklayınca anında çeviri popup'ı
- **Vocabulary Notebook** - Öğrenilen kelimeleri kaydetme ve listeleme
- **User Authentication** - JWT ile kullanıcı kayıt/giriş

### 3.2 Bonus Features
- Bookmark ve timestamp ile not alma
- Batch translation (birden fazla cümleyi aynı anda çevirme)
- Translation history
- Font size ve style özelleştirme

## 4. Teknik Mimari

### 4.1 Frontend (Browser Extension)
- **React 18** - UI components
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Chrome Extension Manifest V3**
- **Firefox WebExtension API**

### 4.2 Backend (Docker/Coolify)
- **Node.js + Express** - API server
- **PostgreSQL** - User data, cached subtitles, vocabulary (remote)
- **Redis** - Rate limiting cache (opsiyonel)

### 4.3 AI Services (External APIs)
- **Primary:** Mistral AI (uygun fiyat/kalite)
- **Fallback:** Claude API, Google Gemini API
- **Whisper:** Local Whisper veya OpenAI Whisper API

### 4.4 Database Schema
```sql
users, subtitles, bookmarks, vocabulary, user_settings
```

## 5. Deployment

### 5.1 Coolify (Docker)
- Backend container
- PostgreSQL (external remote)
- Environment variables via Coolify secrets

### 5.2 Extension Distribution
- Chrome Web Store
- Firefox Add-ons

## 6. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auth/register | POST | User registration |
| /api/auth/login | POST | User login |
| /api/subtitle/youtube/:id | GET | Get translated subtitles |
| /api/translate | POST | Single text translation |
| /api/translate/batch | POST | Batch translation |
| /api/user/vocabulary | GET/POST | Vocabulary CRUD |
| /api/user/preferences | GET/PUT | User settings |
| /api/subtitle/bookmark | POST | Save bookmark |

## 7. Success Metrics
- Active extension users
- Translation requests per user
- Vocabulary growth
- Translation accuracy feedback
