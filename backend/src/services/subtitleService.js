import axios from 'axios';
import { translationService } from './translationService.js';

const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://localhost:8000';

// Webshare API configuration
const WEBSHARE_API_TOKEN = process.env.WEBSHARE_API_TOKEN || 'dc2cr9xf3xc8sy3yrjk1rnn41ocne4o0fes9uu4p';

// Proxy cache for rotation
let proxyList = [];
let lastProxyFetch = 0;
const PROXY_CACHE_MS = 5 * 60 * 1000; // 5 minutes

// Fetch fresh proxy list from Webshare API
async function fetchProxyList() {
  const now = Date.now();
  if (proxyList.length > 0 && (now - lastProxyFetch) < PROXY_CACHE_MS) {
    return proxyList;
  }

  try {
    console.log('Fetching fresh proxy list from Webshare...');
    const response = await axios.get(
      'https://proxy.webshare.io/api/v2/list/free',
      {
        headers: {
          'Authorization': `Token ${WEBSHARE_API_TOKEN}`
        },
        timeout: 30000
      }
    );

    // Parse proxy list from response
    if (response.data?.results) {
      proxyList = response.data.results.map(p => ({
        host: p.proxy_address,
        port: p.port,
        username: process.env.WEBSHARE_PROXY_USERNAME || 'phddludz',
        password: process.env.WEBSHARE_PROXY_PASSWORD || 'rdrrj1a3iqok'
      }));
      lastProxyFetch = now;
      console.log(`Loaded ${proxyList.length} proxies for rotation`);
    }
  } catch (error) {
    console.error('Failed to fetch proxy list:', error.message);
    // Fallback to default proxy if API fails
    proxyList = [{
      host: 'p.webshare.io',
      port: 80,
      username: process.env.WEBSHARE_PROXY_USERNAME || 'phddludz',
      password: process.env.WEBSHARE_PROXY_PASSWORD || 'rdrrj1a3iqok'
    }];
  }

  return proxyList;
}

// Get a random proxy from the list
async function getRandomProxy() {
  const proxies = await fetchProxyList();
  if (proxies.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * proxies.length);
  const proxy = proxies[randomIndex];
  console.log(`Using proxy: ${proxy.host}:${proxy.port} (${randomIndex + 1}/${proxies.length})`);
  return proxy;
}

// Get axios proxy config from proxy object
function getProxyConfig(proxy) {
  if (!proxy) return null;
  return {
    protocol: 'http',
    host: proxy.host,
    port: proxy.port,
    auth: {
      username: proxy.username,
      password: proxy.password
    }
  };
}

// Track failed proxies to avoid retrying them
const failedProxies = new Set();

async function getWorkingProxy() {
  const proxies = await fetchProxyList();
  const maxAttempts = Math.min(proxies.length, 5);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    const proxyKey = `${proxy.host}:${proxy.port}`;

    if (failedProxies.has(proxyKey)) {
      continue;
    }

    return proxy;
  }

  // All proxies failed, reset failed list and try again
  failedProxies.clear();
  return getWorkingProxy();
}

// Mark a proxy as failed
function markProxyFailed(proxy) {
  if (proxy) {
    failedProxies.add(`${proxy.host}:${proxy.port}`);
    console.log(`Proxy ${proxy.host}:${proxy.port} marked as failed`);
  }
}

// Fetch YouTube transcript using timedtext API with proxy rotation
async function getYouTubeTranscript(videoId, lang = 'en') {
  let lastError = null;

  // Try up to 3 different proxies
  for (let attempt = 0; attempt < 3; attempt++) {
    const proxy = await getWorkingProxy();
    if (!proxy) {
      console.log('No proxy available, trying direct connection');
    }

    const proxyConfig = getProxyConfig(proxy);

    try {
      console.log(`[Attempt ${attempt + 1}] Fetching YouTube player for video: ${videoId}${proxy ? ' via proxy' : ''}`);

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
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      console.log('Player response received');

      // Find English caption track
      const captionTracks = playerResponse.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) {
        console.log('No captions available for this video');
        return { error: 'No captions available' };
      }

      // Prefer regular English over auto-generated
      let captionTrack = captionTracks.find(t => t.languageCode === 'en' && !t.vssId?.includes('a'));
      if (!captionTrack) {
        captionTrack = captionTracks[0];
      }

      console.log('Using caption track:', captionTrack.languageCode);

      // Fetch the actual caption XML
      const captionUrl = decodeURIComponent(captionTrack.baseUrl);
      console.log('Fetching caption XML...');

      const captionXml = await axios.get(captionUrl, {
        proxy: proxyConfig,
        timeout: 30000
      });

      console.log('Caption XML received, parsing...');

      // Parse XML to subtitles
      const subtitles = parseCaptionXml(captionXml.data);
      console.log('Parsed', subtitles.length, 'subtitles');

      // Clear failed proxies on success
      failedProxies.clear();

      return {
        subtitles,
        sourceLang: captionTrack.languageCode || 'en'
      };
    } catch (error) {
      console.error(`[Attempt ${attempt + 1}] YouTube transcript error:`, error.message);
      lastError = error;

      // Mark this proxy as failed if it's a proxy-related error
      if (proxy && (error.code === 'ECONNABORTED' ||
          error.message.includes('407') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT'))) {
        markProxyFailed(proxy);
      }

      // If this was the last attempt, return the error
      if (attempt === 2) {
        return { error: error.message };
      }
    }
  }

  return { error: lastError?.message || 'Unknown error' };
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
    let subtitles = [];

    try {
      subtitles = await this.getYouTubeCaptions(videoId, sourceLang);
      console.log('Got', subtitles.length, 'subtitles from YouTube');
    } catch (error) {
      console.warn('Could not get captions:', error.message);
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
