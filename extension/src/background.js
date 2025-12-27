// Background service worker for Dil Reaktörü extension

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open the popup when icon is clicked
  // This is default behavior, but we can add analytics here
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

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

async function handleGetSubtitles(message, sender, sendResponse) {
  try {
    const { videoId, sourceLang, targetLang } = message;

    // Get auth token from storage
    const { token } = await chrome.storage.sync.get('token');

    const response = await fetch(
      `http://localhost:3000/api/subtitle/youtube/${videoId}?sourceLang=${sourceLang}&targetLang=${targetLang}`,
      {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        }
      }
    );

    const data = await response.json();
    sendResponse(data);
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

async function handleTranslateText(message, sender, sendResponse) {
  try {
    const { text, sourceLang, targetLang, context } = message;

    const { token } = await chrome.storage.sync.get('token');

    const response = await fetch('http://localhost:3000/api/translate', {
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

    if (!token) {
      sendResponse({ error: 'Not authenticated' });
      return;
    }

    // Save to vocabulary
    await fetch('http://localhost:3000/api/user/vocabulary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ word, translation, context, language })
    });

    // Also save bookmark
    await fetch('http://localhost:3000/api/subtitle/bookmark', {
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

// Check if we're on a YouTube page and update icon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com')) {
    chrome.action.setBadgeText({ text: 'YT', tabId });
  }
});
