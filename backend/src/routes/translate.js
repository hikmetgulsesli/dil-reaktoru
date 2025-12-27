import express from 'express';
import { translationService } from '../services/translationService.js';

const router = express.Router();

// Translate text
router.post('/', async (req, res) => {
  try {
    const { text, sourceLang, targetLang, context } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const translation = await translationService.translate(text, sourceLang, targetLang, context);

    res.json({ original: text, translation, sourceLang, targetLang });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Translate batch
router.post('/batch', async (req, res) => {
  try {
    const { texts, sourceLang, targetLang } = req.body;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const translations = await Promise.all(
      texts.map(text => translationService.translate(text, sourceLang, targetLang))
    );

    res.json({ translations });
  } catch (error) {
    console.error('Batch translation error:', error);
    res.status(500).json({ error: 'Batch translation failed' });
  }
});

export default router;
