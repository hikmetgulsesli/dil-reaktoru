// Content script for YouTube - injects translated subtitles overlay

console.log('Dil Reaktörü: Content script loaded');

// State
let subtitlesOverlay = null;
let currentSubtitles = [];
let currentSettings = {};

// Initialize
async function init() {
  // Load settings
  const { settings } = await chrome.storage.sync.get('settings');
  currentSettings = settings || {
    targetLang: 'tr',
    showOriginal: true,
    autoTranslate: false
  };

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      currentSettings = changes.settings.newValue;
      updateOverlay();
    }
  });
}

init();

// Create overlay element
function createOverlay() {
  if (subtitlesOverlay) return;

  const overlay = document.createElement('div');
  overlay.id = 'dil-reaktoru-overlay';
  overlay.innerHTML = `
    <div class="dr-overlay-container">
      <div class="dr-subtitle-row">
        <span class="dr-original"></span>
        <span class="dr-translated"></span>
      </div>
    </div>
  `;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #dil-reaktoru-overlay {
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 800px;
      z-index: 9999;
      pointer-events: none;
    }
    .dr-overlay-container {
      background: rgba(0, 0, 0, 0.85);
      border-radius: 8px;
      padding: 12px 16px;
    }
    .dr-subtitle-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dr-original {
      color: #ffffff;
      font-size: 18px;
      text-align: center;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    .dr-translated {
      color: #a5b4fc;
      font-size: 18px;
      text-align: center;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);

  subtitlesOverlay = overlay;
}

// Update overlay with current subtitles
function updateOverlay() {
  if (!subtitlesOverlay) return;

  const container = subtitlesOverlay.querySelector('.dr-subtitle-row');
  const originalEl = container.querySelector('.dr-original');
  const translatedEl = container.querySelector('.dr-translated');

  const currentSub = currentSubtitles.find(
    sub => {
      const video = document.querySelector('video');
      if (!video) return false;
      const currentTime = video.currentTime;
      return currentTime >= sub.start && currentTime <= sub.end;
    }
  );

  if (currentSub) {
    originalEl.textContent = currentSettings.showOriginal ? currentSub.text : '';
    translatedEl.textContent = currentSub.translatedText || '';
    subtitlesOverlay.style.display = 'block';
  } else {
    subtitlesOverlay.style.display = 'none';
  }
}

// Sync subtitles with video time
function syncSubtitles() {
  const video = document.querySelector('video');
  if (!video) return;

  video.addEventListener('timeupdate', updateOverlay);
}

// Message handler from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_SUBTITLES') {
    createOverlay();
    currentSubtitles = message.subtitles;
    syncSubtitles();
    updateOverlay();
    sendResponse({ success: true });
  }

  if (message.type === 'HIDE_SUBTITLES') {
    if (subtitlesOverlay) {
      subtitlesOverlay.style.display = 'none';
    }
    sendResponse({ success: true });
  }

  if (message.type === 'TRANSLATE_CLICKED_WORD') {
    // Handle word click for translation popup
    translateWordAtPosition(message.word, message.x, message.y);
    sendResponse({ success: true });
  }
});

async function translateWordAtPosition(word, x, y) {
  // Create translation popup
  const popup = document.createElement('div');
  popup.className = 'dr-translation-popup';
  popup.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: white;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    z-index: 10000;
    max-width: 300px;
  `;
  popup.innerHTML = `
    <p class="dr-word" style="font-weight: bold; margin: 0 0 8px 0;">${word}</p>
    <p class="dr-loading" style="color: #666; margin: 0;">Translating...</p>
  `;
  document.body.appendChild(popup);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_TEXT',
      text: word,
      sourceLang: 'auto',
      targetLang: currentSettings.targetLang || 'tr'
    });

    if (response.translation) {
      popup.querySelector('.dr-loading').textContent = response.translation;
    }
  } catch (error) {
    popup.querySelector('.dr-loading').textContent = 'Translation failed';
  }

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', function closePopup(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', closePopup);
      }
    });
  }, 0);
}
