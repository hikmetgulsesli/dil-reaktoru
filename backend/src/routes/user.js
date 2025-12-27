import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Get user preferences
router.get('/preferences', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'SELECT preferences FROM users WHERE id = 1' // TODO: Extract from JWT
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
    const { preferences } = req.body;

    await pool.query(
      'UPDATE users SET preferences = $1 WHERE id = 1', // TODO: Extract from JWT
      [JSON.stringify(preferences)]
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
    const result = await pool.query(
      `SELECT * FROM vocabulary WHERE user_id = 1 ORDER BY created_at DESC` // TODO: Extract from JWT
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
    const { word, translation, context, language } = req.body;

    const result = await pool.query(
      `INSERT INTO vocabulary (user_id, word, translation, context, language, created_at)
       VALUES (1, $1, $2, $3, $4, NOW()) RETURNING *`,
      [word, translation, context, language]
    );

    res.status(201).json({ word: result.rows[0] });
  } catch (error) {
    console.error('Add word error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
