import axios from 'axios';
import { translationService } from './translationService.js';

class SubtitleService {
  // YouTube caption tracks API
  async getYouTubeCaptions(videoId, lang = 'en') {
    // Using YouTube's oembed API to get info, actual captions
    // require OAuth in production. This is a simplified version.
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}`,
        {
          headers: {
            // In production, use OAuth token
          }
        }
      );

      return response.data.items;
    } catch (error) {
      console.warn('Could not fetch YouTube captions:', error.message);
      return [];
    }
  }

  // Extract subtitles using local Whisper (if audio is available)
  async extractWithWhisper(audioUrl) {
    // In production, this would:
    // 1. Download audio from video URL
    // 2. Send to local Whisper instance or API
    // 3. Return timed segments

    // Placeholder for Whisper integration
    console.log('Whisper extraction would process:', audioUrl);
    return [];
  }

  async extractAndTranslate(videoId, sourceLang, targetLang) {
    // First try to get existing captions
    let subtitles = [];

    try {
      const captions = await this.getYouTubeCaptions(videoId, sourceLang);
      if (captions.length > 0) {
        // Download and parse caption
        subtitles = await this.parseCaptions(captions);
      }
    } catch (error) {
      console.warn('Could not get captions, would need Whisper:', error.message);
    }

    // If no captions found, return empty (extension can handle this)
    if (subtitles.length === 0) {
      return {
        needsExtraction: true,
        message: 'No captions available. Would need Whisper processing.'
      };
    }

    // Translate subtitles in batch for efficiency
    const translatedSubtitles = await this.translateSubtitles(subtitles, sourceLang, targetLang);

    return translatedSubtitles;
  }

  async parseCaptions(captions) {
    // Parse YouTube caption format (XML)
    // Return array of { start, end, text }
    return [];
  }

  async translateSubtitles(subtitles, sourceLang, targetLang) {
    // Group subtitles for batch translation (e.g., every 10 lines)
    const batchSize = 10;
    const translated = [];

    for (let i = 0; i < subtitles.length; i += batchSize) {
      const batch = subtitles.slice(i, i + batchSize);
      const textToTranslate = batch.map(s => s.text).join('\n');

      try {
        const translatedText = await translationService.translate(
          textToTranslate,
          sourceLang,
          targetLang
        );

        const translatedLines = translatedText.split('\n');
        batch.forEach((sub, idx) => {
          translated.push({
            ...sub,
            translatedText: translatedLines[idx] || sub.text
          });
        });
      } catch (error) {
        console.error('Batch translation failed:', error);
        // Keep original if translation fails
        translated.push(...batch.map(s => ({ ...s, translatedText: s.text })));
      }
    }

    return translated;
  }
}

export const subtitleService = new SubtitleService();
