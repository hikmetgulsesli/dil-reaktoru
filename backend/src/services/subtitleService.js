import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { translationService } from './translationService.js';

const execAsync = promisify(exec);

// yt-dlp path - can be configured via environment
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';
const COOKIES_PATH = process.env.COOKIES_PATH || '/tmp/yt_cookies.txt';

// Proxy configuration
const WEBSHARE_API_TOKEN = process.env.WEBSHARE_API_TOKEN;
let proxyList = [];
let lastProxyFetch = 0;
const PROXY_CACHE_MS = 5 * 60 * 1000;

// Fetch proxy list from Webshare
async function fetchProxyList() {
  if (!WEBSHARE_API_TOKEN) return [];

  const now = Date.now();
  if (proxyList.length > 0 && (now - lastProxyFetch) < PROXY_CACHE_MS) {
    return proxyList;
  }

  try {
    const response = await axios.get(
      'https://proxy.webshare.io/api/v2/proxy/list/',
      {
        headers: { 'Authorization': `Token ${WEBSHARE_API_TOKEN}` },
        timeout: 30000
      }
    );

    if (response.data && Array.isArray(response.data)) {
      proxyList = response.data.map(p => ({
        host: p.proxy_address || p.host,
        port: p.port,
        username: process.env.WEBSHARE_PROXY_USERNAME,
        password: process.env.WEBSHARE_PROXY_PASSWORD
      }));
      lastProxyFetch = now;
      console.log(`[SubtitleService] Loaded ${proxyList.length} proxies`);
    }
  } catch (error) {
    console.warn('[SubtitleService] Failed to fetch proxy list:', error.message);
  }

  return proxyList;
}

// Get random proxy URL
async function getProxyUrl() {
  const proxies = await fetchProxyList();
  if (proxies.length === 0) return null;

  const proxy = proxies[Math.floor(Math.random() * proxies.length)];
  return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
}

// Check if cookies file exists and is valid
async function ensureCookiesFile() {
  try {
    await fs.access(COOKIES_PATH);
    const stats = await fs.stat(COOKIES_PATH);
    if (stats.size > 0) {
      return true;
    }
  } catch {
    // File doesn't exist or is empty
  }
  return false;
}

// Fetch YouTube transcript using yt-dlp (most reliable method)
async function fetchTranscriptWithYtDlp(videoId, lang = 'en') {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `yt_sub_${videoId}_${Date.now()}`);

  console.log(`[SubtitleService] Fetching transcript for ${videoId} using yt-dlp (lang: ${lang})`);

  // Check for cookies
  const hasCookies = await ensureCookiesFile();
  const cookiesArg = hasCookies ? `--cookies "${COOKIES_PATH}"` : '';
  if (hasCookies) {
    console.log('[SubtitleService] Using YouTube cookies for authentication');
  }

  try {
    // Get yt-dlp version for debugging
    try {
      const version = await execAsync(`${YT_DLP_PATH} --version`);
      console.log(`[SubtitleService] yt-dlp version: ${version.stdout.trim()}`);
    } catch {
      console.warn('[SubtitleService] yt-dlp not found in PATH');
    }

    // Build yt-dlp command
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Use --remote-components for JS challenge solving
    const remoteComponents = '--remote-components ejs:github';
    const sleepSubtitles = '--sleep-subtitles 3';
    
    // Try manual subtitles first, then auto-generated
    let command = `${YT_DLP_PATH} ${remoteComponents} ${sleepSubtitles} --rm-cache-dir --skip-download --write-sub --sub-lang "${lang}" --sub-format json3 ${cookiesArg} -o "${tempFile}" "${url}" 2>&1`;
    
    let result;
    try {
      result = await execAsync(command, { timeout: 60000 });
      console.log(`[SubtitleService] yt-dlp output:`, result.stdout?.substring(0, 200));
    } catch (e) {
      console.log(`[SubtitleService] Manual subtitles not available, trying auto-generated...`);
      
      // Try auto-generated subtitles
      command = `${YT_DLP_PATH} ${remoteComponents} ${sleepSubtitles} --rm-cache-dir --skip-download --write-auto-sub --sub-lang "${lang}" --sub-format json3 ${cookiesArg} -o "${tempFile}" "${url}" 2>&1`;
      result = await execAsync(command, { timeout: 60000 });
    }

    // Check for bot detection
    if (result.stdout?.includes('Sign in to confirm') || result.stdout?.includes('not a bot')) {
      console.warn('[SubtitleService] Bot detection triggered');
      return { error: 'youtube_auth_required', message: 'YouTube oturumu gerekli veya süresi dolmuş' };
    }

    // Find generated subtitle file
    const possibleFiles = [
      `${tempFile}.${lang}.json3`,
      `${tempFile}.${lang}-orig.json3`,
    ];

    let subtitleContent = null;
    let foundFile = null;

    for (const file of possibleFiles) {
      try {
        subtitleContent = await fs.readFile(file, 'utf-8');
        foundFile = file;
        break;
      } catch { /* file doesn't exist */ }
    }

    // Also check for files with different naming patterns
    if (!subtitleContent) {
      try {
        const files = await fs.readdir(tempDir);
        const matchingFiles = files.filter(f => f.startsWith(`yt_sub_${videoId}`) && f.endsWith('.json3'));
        if (matchingFiles.length > 0) {
          foundFile = path.join(tempDir, matchingFiles[0]);
          subtitleContent = await fs.readFile(foundFile, 'utf-8');
        }
      } catch { /* ignore */ }
    }

    if (!subtitleContent) {
      console.log(`[SubtitleService] No subtitle file found for ${videoId}`);
      return null;
    }

    console.log(`[SubtitleService] Found subtitle file: ${foundFile}`);

    // Parse JSON3 format
    const json = JSON.parse(subtitleContent);
    const events = json.events || [];

    const segments = [];
    for (const event of events) {
      if (event.segs) {
        const text = event.segs.map(s => s.utf8 || '').join('').trim();
        if (text) {
          segments.push({
            text: text.replace(/\n/g, ' '),
            start: (event.tStartMs || 0) / 1000,
            duration: ((event.dDurationMs || 0) / 1000)
          });
        }
      }
    }

    // Cleanup temp files
    try {
      if (foundFile) await fs.unlink(foundFile);
    } catch { /* ignore cleanup errors */ }

    console.log(`[SubtitleService] Parsed ${segments.length} segments`);

    return {
      segments,
      fullText: segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim(),
      language: lang,
      source: 'yt-dlp'
    };

  } catch (error) {
    console.error(`[SubtitleService] yt-dlp error:`, error.message);
    return null;
  }
}

// Fallback: Fetch transcript using YouTube API with proxy rotation
async function fetchTranscriptWithApi(videoId, lang = 'en') {
  console.log(`[SubtitleService] Using API fallback for ${videoId}`);

  const proxyUrl = await getProxyUrl();
  const proxyConfig = proxyUrl ? { https: proxyUrl } : undefined;

  try {
    // First, get player response
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

    const captionTracks = playerResponse.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      return { error: 'no_captions', message: 'No captions available' };
    }

    // Find preferred language track
    const preferredTrack = captionTracks.find(t => 
      t.languageCode.toLowerCase().startsWith(lang.toLowerCase())
    ) || captionTracks[0];

    // Fetch caption XML
    const captionUrl = decodeURIComponent(preferredTrack.baseUrl);
    const captionXml = await axios.get(captionUrl, {
      proxy: proxyConfig,
      timeout: 30000
    });

    // Parse XML
    const segments = parseCaptionXml(captionXml.data);

    return {
      segments,
      fullText: segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim(),
      language: preferredTrack.languageCode,
      source: 'youtube_api'
    };

  } catch (error) {
    console.error(`[SubtitleService] API fallback error:`, error.message);
    return { error: 'api_error', message: error.message };
  }
}

// Parse YouTube caption XML format
function parseCaptionXml(xml) {
  const subtitles = [];
  const textMatches = xml.matchAll(/<text[^>]+start="([^"]+)"[^>]+dur="([^"]+)"[^>]*>([^<]*)<\/text>/g);

  for (const match of textMatches) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    let text = match[3]
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (text) {
      subtitles.push({ start, end: start + dur, text });
    }
  }

  return subtitles;
}

class SubtitleService {
  // Main method: get translated subtitles for a video
  async getTranslatedSubtitles(videoId, sourceLang = 'en', targetLang = 'tr') {
    console.log(`[SubtitleService] Getting subtitles for ${videoId} (${sourceLang} -> ${targetLang})`);

    // Step 1: Try yt-dlp first (most reliable)
    let result = await fetchTranscriptWithYtDlp(videoId, sourceLang);

    // Step 2: If yt-dlp fails, try API fallback
    if (!result || result.error) {
      console.log('[SubtitleService] yt-dlp failed, trying API fallback...');
      result = await fetchTranscriptWithApi(videoId, sourceLang);
    }

    // Step 3: If still no segments, try with proxy
    if (!result || !result.segments || result.segments.length === 0) {
      console.log('[SubtitleService] Trying with proxy rotation...');
      result = await fetchTranscriptWithApi(videoId, sourceLang);
    }

    if (!result || !result.segments || result.segments.length === 0) {
      return {
        needsExtraction: true,
        message: result?.message || 'No captions available for this video'
      };
    }

    // Step 4: Translate subtitles if needed
    if (targetLang !== sourceLang && result.segments.length > 0) {
      console.log(`[SubtitleService] Translating ${result.segments.length} segments to ${targetLang}`);
      
      const translatedSegments = await this.translateSegments(
        result.segments,
        sourceLang,
        targetLang
      );

      return {
        subtitles: translatedSegments,
        sourceLang: result.language,
        targetLang,
        cached: false
      };
    }

    return {
      subtitles: result.segments.map(s => ({
        ...s,
        translatedText: s.text
      })),
      sourceLang: result.language,
      targetLang,
      cached: false
    };
  }

  // Translate subtitle segments in batch
  async translateSegments(segments, sourceLang, targetLang) {
    const translated = [];
    const batchSize = 10;

    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = segments.slice(i, i + batchSize);
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
        console.error(`[SubtitleService] Batch translation failed:`, error.message);
        // Keep original if translation fails
        translated.push(...batch.map(s => ({ ...s, translatedText: s.text })));
      }
    }

    return translated;
  }

  // Get available subtitle languages for a video
  async getAvailableLanguages(videoId) {
    console.log(`[SubtitleService] Getting available languages for ${videoId}`);

    // Try yt-dlp first
    const tempFile = path.join(os.tmpdir(), `yt_info_${videoId}_${Date.now()}`);

    try {
      const command = `${process.env.YT_DLP_PATH || 'yt-dlp'} --rm-cache-dir --skip-download --list-subs ${videoId} 2>&1`;
      const result = await execAsync(command, { timeout: 30000 });

      // Parse output to extract languages
      const languages = [];
      const lines = result.stdout.split('\n');
      
      for (const line of lines) {
        const langMatch = line.match(/\[info\] (.+): available\)/);
        if (langMatch) {
          languages.push(langMatch[1]);
        }
      }

      if (languages.length > 0) {
        console.log(`[SubtitleService] Found ${languages.length} available languages`);
        return languages;
      }
    } catch (error) {
      console.warn('[SubtitleService] Could not get subtitles list via yt-dlp');
    }

    // Fallback to API
    try {
      const response = await axios.post(
        'https://www.youtube.com/youtubei/v1/player',
        {
          context: { client: { clientName: 'WEB', clientVersion: '2.20240827.00.00' } },
          videoId
        },
        { timeout: 30000 }
      );

      const captionTracks = response.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captionTracks) {
        return captionTracks.map(t => t.languageCode);
      }
    } catch (error) {
      console.warn('[SubtitleService] API fallback also failed');
    }

    return [];
  }
}

export const subtitleService = new SubtitleService();
