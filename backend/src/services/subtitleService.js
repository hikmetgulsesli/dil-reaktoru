import axios from 'axios';
import { YouTubeTranscriptApi } from 'youtube-transcript-ts';
import { translationService } from './translationService.js';

const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://localhost:8000';

// Webshare API Token (get from https://proxy.webshare.io/userapi/keys)
const WEBSHARE_API_TOKEN = process.env.WEBSHARE_API_TOKEN || '';

// Get proxy list from Webshare API
async function getWebshareProxyList() {
  if (!WEBSHARE_API_TOKEN) {
    console.warn('Webshare API token not configured');
    return null;
  }

  try {
    const response = await axios.get(
      'https://proxy.webshare.io/api/v2/proxy/list/',
      {
        headers: { 'Authorization': `Token ${WEBSHARE_API_TOKEN}` },
        params: { 'page': 1, 'page_size': 5, 'mode': 'rotating' }
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    }
    return null;
  } catch (error) {
    console.error('Failed to get Webshare proxy:', error.message);
    return null;
  }
}

// Initialize YouTube Transcript API with proxy support
async function createTranscriptApi() {
  const proxyInfo = await getWebshareProxyList();

  if (proxyInfo) {
    const proxyUrl = `http://${proxyInfo.username}:${proxyInfo.password}@${proxyInfo.proxy_address}:${proxyInfo.port}`;
    console.log('Using Webshare proxy:', proxyInfo.proxy_address);

    return new YouTubeTranscriptApi({
      proxy: {
        enabled: true,
        http: proxyUrl,
        https: proxyUrl
      }
    });
  }

  // Fallback without proxy
  console.log('No proxy available, fetching directly');
  return new YouTubeTranscriptApi();
}

class SubtitleService {
  constructor() {
    this.api = null;
  }

  async getTranscriptApi() {
    if (!this.api) {
      this.api = await createTranscriptApi();
    }
    return this.api;
  }

  // Get YouTube captions using youtube-transcript-ts
  async getYouTubeCaptions(videoId, lang = 'en') {
    try {
      const api = await this.getTranscriptApi();
      const transcript = await api.fetchTranscript(videoId, [lang]);

      return transcript.snippets.map(snippet => ({
        start: snippet.offset,
        end: snippet.offset + snippet.duration,
        text: snippet.text
      }));
    } catch (error) {
      console.warn('Could not fetch YouTube captions:', error.message);
      return [];
    }
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
    // First try to get existing captions using youtube-transcript-ts
    let subtitles = [];

    try {
      subtitles = await this.getYouTubeCaptions(videoId, sourceLang);
      console.log('Got', subtitles.length, 'subtitles from YouTube');
    } catch (error) {
      console.warn('Could not get captions:', error.message);
    }

    // If no captions found, try Whisper
    if (subtitles.length === 0) {
      console.log('No captions found, Whisper not implemented in this version');
    }

    // If still no subtitles, return needsExtraction flag
    if (subtitles.length === 0) {
      return {
        needsExtraction: true,
        message: 'No captions available for this video.'
      };
    }

    // Translate subtitles in batch for efficiency
    const translatedSubtitles = await this.translateSubtitles(subtitles, sourceLang, targetLang);

    return translatedSubtitles;
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
