import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const COOKIES_PATH = process.env.COOKIES_PATH || '/tmp/yt_cookies.txt';

// Save YouTube cookies from extension
router.post('/youtube-cookies', async (req, res) => {
  try {
    const { cookies } = req.body;

    if (!cookies) {
      return res.status(400).json({ error: 'Cookies are required' });
    }

    // Validate cookies format (basic check)
    if (typeof cookies !== 'string' || cookies.length < 10) {
      return res.status(400).json({ error: 'Invalid cookies format' });
    }

    // Save cookies to file
    await fs.writeFile(COOKIES_PATH, cookies, 'utf-8');

    // Verify file was written
    const stats = await fs.stat(COOKIES_PATH);
    console.log(`[CookieManager] YouTube cookies saved (${stats.size} bytes)`);

    res.json({
      success: true,
      message: 'Cookies saved successfully',
      size: stats.size
    });

  } catch (error) {
    console.error('[CookieManager] Error saving cookies:', error);
    res.status(500).json({ error: 'Failed to save cookies' });
  }
});

// Get YouTube cookies status
router.get('/youtube-cookies/status', async (req, res) => {
  try {
    try {
      await fs.access(COOKIES_PATH);
      const stats = await fs.stat(COOKIES_PATH);
      
      res.json({
        exists: true,
        size: stats.size,
        lastModified: stats.mtime
      });
    } catch {
      res.json({
        exists: false,
        message: 'No cookies file found'
      });
    }
  } catch (error) {
    console.error('[CookieManager] Error checking cookies:', error);
    res.status(500).json({ error: 'Failed to check cookies' });
  }
});

// Delete YouTube cookies
router.delete('/youtube-cookies', async (req, res) => {
  try {
    try {
      await fs.unlink(COOKIES_PATH);
      console.log('[CookieManager] Cookies deleted');
    } catch {
      // File might not exist
    }

    res.json({
      success: true,
      message: 'Cookies deleted successfully'
    });
  } catch (error) {
    console.error('[CookieManager] Error deleting cookies:', error);
    res.status(500).json({ error: 'Failed to delete cookies' });
  }
});

export default router;
