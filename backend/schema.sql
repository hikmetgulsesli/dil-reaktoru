-- Dil Reaktörü Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Subtitles cache table
CREATE TABLE IF NOT EXISTS subtitles (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(100) NOT NULL,
    source_lang VARCHAR(10) DEFAULT 'auto',
    target_lang VARCHAR(10) DEFAULT 'tr',
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(video_id, source_lang, target_lang)
);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    video_id VARCHAR(100) NOT NULL,
    timestamp DECIMAL(10, 3),
    note TEXT,
    subtitle_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vocabulary table (flashcards)
CREATE TABLE IF NOT EXISTS vocabulary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    word VARCHAR(500) NOT NULL,
    translation VARCHAR(500) NOT NULL,
    context TEXT,
    language VARCHAR(10) DEFAULT 'en',
    review_count INTEGER DEFAULT 0,
    next_review TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    target_language VARCHAR(10) DEFAULT 'tr',
    source_languages TEXT[] DEFAULT '{}',
    font_size INTEGER DEFAULT 16,
    show_original BOOLEAN DEFAULT true,
    auto_translate BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subtitles_video_id ON subtitles(video_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_video_id ON bookmarks(video_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_next_review ON vocabulary(next_review);
