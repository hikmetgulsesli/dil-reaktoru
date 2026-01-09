import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import subtitleRoutes from './routes/subtitle.js';
import translateRoutes from './routes/translate.js';
import userRoutes from './routes/user.js';
import cookieRoutes from './routes/cookie.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['chrome-extension://*', 'moz-extension://*', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(rateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/subtitle', subtitleRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/user', userRoutes);
app.use('/api/cookie', cookieRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public config endpoint (YouTube API key)
app.get('/api/config', (req, res) => {
  res.json({
    youtubeApiKey: process.env.YOUTUBE_API_KEY || ''
  });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Dil Reaktörü API running on port ${PORT}`);
});

export default app;
