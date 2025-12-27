import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dil-reaktoru-secret-key-2024';

// Helper function to extract user ID from JWT
function getUserIdFromRequest(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || decoded.id || decoded.sub;
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

// Get user preferences
router.get('/preferences', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'SELECT preferences FROM users WHERE id = $1',
      [userId]
    );

    res.json({ preferences: result.rows[0]?.preferences || {} });
  } catch (error) {
    console.error('Preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user preferences
router.put('/preferences', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { preferences } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await pool.query(
      'UPDATE users SET preferences = $1 WHERE id = $2',
      [JSON.stringify(preferences), userId]
    );

    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user vocabulary
router.get('/vocabulary', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT * FROM vocabulary WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ words: result.rows });
  } catch (error) {
    console.error('Vocabulary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add word to vocabulary
router.post('/vocabulary', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { word, translation, context, language } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `INSERT INTO vocabulary (user_id, word, translation, context, language, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [userId, word, translation, context, language]
    );

    res.status(201).json({ word: result.rows[0] });
  } catch (error) {
    console.error('Add word error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
