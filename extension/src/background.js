// Background service worker for Dil Reaktörü extension

const DEFAULT_API_URL = 'http://localhost:3000';
const PRODUCTION_API_URL = 'https://dil.setrox.net/api';

// Get API URL from storage or use default
async function getApiUrl() {
  const { apiUrl } = await chrome.storage.sync.get('apiUrl');
  if (apiUrl) return apiUrl;

  // Check if we're in production mode
  const { productionMode } = await chrome.storage.sync.get('productionMode');
  if (productionMode) {
    return PRODUCTION_API_URL.replace(/\/$/, '');
  }

  return DEFAULT_API_URL.replace(/\/$/, '');
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SUBTITLES':
      handleGetSubtitles(message, sender, sendResponse);
      return true; // Async response

    case 'TRANSLATE_TEXT':
      handleTranslateText(message, sender, sendResponse);
      return true; // Async response

    case 'ADD_TO_VOCABULARY':
      handleAddToVocabulary(message, sender, sendResponse);
      return true; // Async response

    case 'GET_SETTINGS':
      handleGetSettings(sendResponse);
      return true;

    case 'SET_API_URL':
      handleSetApiUrl(message, sendResponse);
      return true;

    case 'GET_API_URL':
      handleGetApiUrl(sendResponse);
      return true;

    case 'SAVE_YOUTUBE_COOKIES':
      handleSaveYouTubeCookies(sendResponse);
      return true; // Async response

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Get subtitles from backend (uses Webshare proxy)
async function handleGetSubtitles(message, sender, sendResponse) {
  try {
    const { videoId, sourceLang, targetLang } = message;

    console.log('Dil Reaktörü BG: Getting subtitles for', videoId);

    const { token } = await chrome.storage.sync.get('token');
    const apiUrl = await getApiUrl();

    const response = await fetch(
      `${apiUrl}/api/subtitle/youtube/${videoId}?sourceLang=${sourceLang}&targetLang=${targetLang}`,
      {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        }
      }
    );

    const data = await response.json();
    console.log('Dil Reaktörü BG: Response', data);
    sendResponse(data);
  } catch (error) {
    console.error('Dil Reaktörü BG: Error', error);
    sendResponse({ error: error.message });
  }
}

async function handleTranslateText(message, sender, sendResponse) {
  try {
    const { text, sourceLang, targetLang, context } = message;

    const { token } = await chrome.storage.sync.get('token');
    const apiUrl = await getApiUrl();

    const response = await fetch(`${apiUrl}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: JSON.stringify({ text, sourceLang, targetLang, context })
    });

    const data = await response.json();
    sendResponse(data);
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

async function handleAddToVocabulary(message, sender, sendResponse) {
  try {
    const { word, translation, context, language, videoId, timestamp } = message;

    const { token } = await chrome.storage.sync.get('token');
    const apiUrl = await getApiUrl();

    if (!token) {
      sendResponse({ error: 'Not authenticated' });
      return;
    }

    // Save to vocabulary
    await fetch(`${apiUrl}/api/user/vocabulary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ word, translation, context, language })
    });

    // Also save bookmark
    await fetch(`${apiUrl}/api/subtitle/bookmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ videoId, timestamp, subtitleText: context })
    });

    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

async function handleGetSettings(sendResponse) {
  const { settings } = await chrome.storage.sync.get('settings');
  sendResponse({ settings: settings || {} });
}

async function handleSetApiUrl(message, sendResponse) {
  const { url, productionMode } = message;

  if (productionMode !== undefined) {
    await chrome.storage.sync.set({ productionMode });
  }

  if (url) {
    await chrome.storage.sync.set({ apiUrl: url });
  }

  sendResponse({ success: true });
}

async function handleGetApiUrl(sendResponse) {
  const apiUrl = await getApiUrl();
  sendResponse({ apiUrl });
}

// Collect YouTube cookies and save to backend
async function handleSaveYouTubeCookies(sendResponse) {
  try {
    console.log('Dil Reaktörü BG: Collecting YouTube cookies...');

    // Get all YouTube cookies
    const cookies = await chrome.cookies.getAll({ domain: 'youtube.com' });

    if (cookies.length === 0) {
      console.log('Dil Reaktörü BG: No YouTube cookies found');
      sendResponse({ success: false, message: 'No YouTube cookies found' });
      return;
    }

    // Format cookies as Netscape cookie file format (what yt-dlp expects)
    let cookieString = '';
    for (const cookie of cookies) {
      const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
      const secure = cookie.secure ? 'TRUE' : 'FALSE';
      const expires = cookie.expires || 0;
      const path = cookie.path || '/';

      cookieString += `${domain}\tTRUE\t${path}\t${secure}\t${expires}\t${cookie.name}\t${cookie.value}\n`;
    }

    console.log(`Dil Reaktörü BG: Collected ${cookies.length} cookies`);

    // Send to backend
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/api/cookie/youtube-cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies: cookieString })
    });

    if (!response.ok) {
      throw new Error('Failed to save cookies to backend');
    }

    const result = await response.json();
    console.log('Dil Reaktörü BG: Cookies saved to backend');

    sendResponse({ success: true, message: `Saved ${cookies.length} cookies` });
  } catch (error) {
    console.error('Dil Reaktörü BG: Error saving cookies:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Check if we're on a YouTube page and update icon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com')) {
    chrome.action.setBadgeText({ text: 'YT', tabId });
  }
});
