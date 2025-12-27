import axios from 'axios';
import { translationService } from './translationService.js';

const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://localhost:8000';

class SubtitleService {
  // YouTube caption tracks API
  async getYouTubeCaptions(videoId, lang = 'en') {
    try {
      // Get caption tracks for the video
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}`,
        {
          headers: {
            // In production, use OAuth token from environment
          }
        }
      );

      return response.data.items || [];
    } catch (error) {
      console.warn('Could not fetch YouTube captions:', error.message);
      return [];
    }
  }

  // Download caption file and parse it
  async downloadAndParseCaption(captionId, lang = 'en') {
    try {
      // Note: Downloading captions requires OAuth token with proper scopes
      // This is a simplified version that would need proper authentication
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/captions/${captionId}?tfmt=srt`,
        {
          headers: {
            // Authorization: Bearer ${accessToken}
          },
          responseType: 'text'
        }
      );

      return this.parseSRT(response.data);
    } catch (error) {
      console.warn('Could not download caption:', error.message);
      return [];
    }
  }

  // Parse SRT subtitle format
  // Format:
  // 1
  // 00:00:01,000 --> 00:00:04,000
  // Hello world
  parseSRT(srtContent) {
    const subtitles = [];
    const blocks = srtContent.trim().split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 3) continue;

      // Skip index number line
      const timeLineIndex = lines[1]?.includes('-->') ? 1 : lines[0]?.includes('-->') ? 0 : -1;
      if (timeLineIndex === -1) continue;

      const timeLine = lines[timeLineIndex];
      const textLines = lines.slice(timeLineIndex + 1);

      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
      if (!timeMatch) continue;

      const startTime = this.parseSRTTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const endTime = this.parseSRTTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

      subtitles.push({
        start: startTime,
        end: endTime,
        text: textLines.join(' ').replace(/<[^>]*>/g, '') // Remove HTML tags
      });
    }

    return subtitles;
  }

  parseSRTTime(hours, minutes, seconds, millis) {
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(millis) / 1000;
  }

  // Parse YouTube XML caption format (TTML)
  // YouTube captions are in TTML format with <p> tags containing timing
  async parseCaptions(captions) {
    if (!captions || captions.length === 0) return [];

    // For each caption track, we need to download and parse
    // This is a placeholder - in production you'd need OAuth
    console.log('Processing', captions.length, 'caption tracks');

    // Return empty for now - actual implementation requires OAuth
    // See downloadAndParseCaption for SRT parsing
    return [];
  }

  // Extract subtitles using local Whisper (if audio is available)
  async extractWithWhisper(audioUrl, options = {}) {
    try {
      const { model = 'base', language = null } = options;

      // Option 1: Local Whisper instance
      try {
        const response = await axios.post(
          `${WHISPER_API_URL}/transcriptions`,
          {
            audio_url: audioUrl,
            model: model,
            language: language,
            response_format: 'verbose_json',
            timestamps: true
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 120000 // 2 minutes timeout
          }
        );

        return this.convertWhisperToSubtitles(response.data);
      } catch (whisperError) {
        console.warn('Local Whisper not available:', whisperError.message);
      }

      // Option 2: OpenAI Whisper API as fallback
      try {
        // First download audio
        const audioBuffer = await this.downloadAudio(audioUrl);

        const formData = new FormData();
        formData.append('file', Buffer.from(audioBuffer), 'audio.wav');
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'segment');

        const openaiResponse = await axios.post(
          'https://api.openai.com/v1/audio/transcriptions',
          formData,
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              ...formData.getHeaders()
            },
            timeout: 120000
          }
        );

        return this.convertWhisperToSubtitles(openaiResponse.data);
      } catch (openaiError) {
        console.warn('OpenAI Whisper API not available:', openaiError.message);
      }

      return [];
    } catch (error) {
      console.error('Whisper extraction error:', error);
      return [];
    }
  }

  // Download audio from URL
  async downloadAudio(url) {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    return response.data;
  }

  // Convert Whisper response to our subtitle format
  convertWhisperToSubtitles(whisperData) {
    const subtitles = [];

    if (whisperData.segments) {
      for (const segment of whisperData.segments) {
        subtitles.push({
          start: segment.start,
          end: segment.end,
          text: segment.text.trim()
        });
      }
    } else if (whisperData.chunks) {
      // OpenAI verbose_json format
      for (const chunk of whisperData.chunks) {
        subtitles.push({
          start: chunk.timestamp?.start || 0,
          end: chunk.timestamp?.end || 0,
          text: chunk.text.trim()
        });
      }
    }

    return subtitles;
  }

  async extractAndTranslate(videoId, sourceLang, targetLang) {
    // First try to get existing captions
    let subtitles = [];

    try {
      const captions = await this.getYouTubeCaptions(videoId, sourceLang);
      if (captions.length > 0) {
        // Download and parse caption (first available track)
        const captionId = captions[0].id;
        subtitles = await this.downloadAndParseCaption(captionId, sourceLang);
      }
    } catch (error) {
      console.warn('Could not get captions, would need Whisper:', error.message);
    }

    // If no captions found, try Whisper
    if (subtitles.length === 0) {
      // Get audio URL from YouTube video
      const audioUrl = this.getYouTubeAudioUrl(videoId);
      if (audioUrl) {
        subtitles = await this.extractWithWhisper(audioUrl, { language: sourceLang });
      }
    }

    // If still no subtitles, return needsExtraction flag
    if (subtitles.length === 0) {
      return {
        needsExtraction: true,
        message: 'No captions available. Whisper processing required.'
      };
    }

    // Translate subtitles in batch for efficiency
    const translatedSubtitles = await this.translateSubtitles(subtitles, sourceLang, targetLang);

    return translatedSubtitles;
  }

  // Get direct audio URL from YouTube video
  getYouTubeAudioUrl(videoId) {
    // This is a placeholder - in production you'd need to extract
    // the audio stream URL from YouTube's player response
    return `https://www.youtube.com/watch?v=${videoId}`;
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
