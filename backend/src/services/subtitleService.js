import axios from 'axios';
import { translationService } from './translationService.js';

const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://localhost:8000';

// Webshare Proxy configuration
const WEBSHARE_PROXY = {
  host: process.env.WEBSHARE_PROXY_HOST || 'p.webshare.io',
  port: parseInt(process.env.WEBSHARE_PROXY_PORT) || 80,
  username: process.env.WEBSHARE_PROXY_USERNAME || '',
  password: process.env.WEBSHARE_PROXY_PASSWORD || ''
};

// Check if Webshare proxy is configured
function isProxyConfigured() {
  return WEBSHARE_PROXY.username && WEBSHARE_PROXY.password;
}

// Get axios proxy config
function getAxiosProxyConfig() {
  if (isProxyConfigured()) {
    return {
      host: WEBSHARE_PROXY.host,
      port: WEBSHARE_PROXY.port,
      auth: {
        username: WEBSHARE_PROXY.username,
        password: WEBSHARE_PROXY.password
      }
    };
  }
  return null;
}

// Fetch YouTube transcript using timedtext API
async function getYouTubeTranscript(videoId, lang = 'en') {
  const proxyConfig = getAxiosProxyConfig();

  // First, get player response to find caption tracks
  const playerResponse = await axios.post(
    'https://www.youtube.com/youtubei/v1/player',
    {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240827.00.00'
        }
      },
      videoId
    },
    {
      proxy: proxyConfig,
      headers: { 'Content-Type': 'application/json' }
    }
  );

  // Find English caption track
  const captionTracks = playerResponse.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) {
    return { error: 'No captions available' };
  }

  // Prefer regular English over auto-generated
  let captionTrack = captionTracks.find(t => t.languageCode === 'en' && !t.vssId?.includes('a'));
  if (!captionTrack) {
    captionTrack = captionTracks[0];
  }

  // Fetch the actual caption XML
  const captionUrl = decodeURIComponent(captionTrack.baseUrl);
  const captionXml = await axios.get(captionUrl, { proxy: proxyConfig });

  // Parse XML to subtitles
  const subtitles = parseCaptionXml(captionXml.data);

  return {
    subtitles,
    sourceLang: captionTrack.languageCode || 'en'
  };
}

// Parse YouTube caption XML format
function parseCaptionXml(xml) {
  const subtitles = [];
  // Simple regex-based XML parsing (faster than DOMParser for large files)
  const textMatches = xml.matchAll(/<text[^>]+start="([^"]+)"[^>]+dur="([^"]+)"[^>]*>([^<]*)<\/text>/g);

  for (const match of textMatches) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    let text = match[3]
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (text) {
      subtitles.push({
        start,
        end: start + dur,
        text
      });
    }
  }

  return subtitles;
}

class SubtitleService {
  // Get YouTube captions
  async getYouTubeCaptions(videoId, lang = 'en') {
    try {
      const result = await getYouTubeTranscript(videoId, lang);
      if (result.error) {
        return [];
      }
      return result.subtitles.map(snippet => ({
        start: snippet.start,
        end: snippet.end,
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
