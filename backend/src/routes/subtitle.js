import express from 'express';
import pool from '../config/database.js';
import { subtitleService } from '../services/subtitleService.js';

const router = express.Router();

// Get subtitles for a YouTube video
router.get('/youtube/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { sourceLang = 'auto', targetLang = 'tr' } = req.query;

    // Check cache first
    const cached = await pool.query(
      'SELECT * FROM subtitles WHERE video_id = $1 AND source_lang = $2 AND target_lang = $3',
      [videoId, sourceLang, targetLang]
    );

    if (cached.rows.length > 0) {
      return res.json({ cached: true, subtitles: cached.rows[0].content });
    }

    // Extract and translate subtitles
    const subtitles = await subtitleService.extractAndTranslate(videoId, sourceLang, targetLang);

    // Cache the result
    await pool.query(
      `INSERT INTO subtitles (video_id, source_lang, target_lang, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (video_id, source_lang, target_lang)
       DO UPDATE SET content = $4, created_at = NOW()`,
      [videoId, sourceLang, targetLang, JSON.stringify(subtitles)]
    );

    res.json({ cached: false, subtitles });
  } catch (error) {
    console.error('Subtitle error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save user bookmark
router.post('/bookmark', async (req, res) => {
  try {
    const { videoId, timestamp, note, subtitleText } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Simple user extraction (in production, use proper JWT verification)
    await pool.query(
      `INSERT INTO bookmarks (video_id, timestamp, note, subtitle_text, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [videoId, timestamp, note, subtitleText]
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
