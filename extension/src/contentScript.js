// Dil Reaktörü - YouTube Content Script

console.log('Dil Reaktörü: Content script loaded v1.0.1');

let controlPanel = null;
let subtitlesOverlay = null;
let currentSubtitles = [];
let currentVideoId = null;
let currentSettings = {};

// Debug logging
function log(msg, data = '') {
  console.log(`[Dil Reaktörü] ${msg}`, data);
}

// Get video ID from URL
function getVideoId() {
  const match = window.location.href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// Initialize
async function init() {
  log('Initializing...');

  const { settings } = await chrome.storage.sync.get('settings');
  currentSettings = settings || {
    targetLang: 'tr',
    showOriginal: true,
    autoTranslate: false
  };

  log('Settings loaded:', currentSettings);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      currentSettings = changes.settings.newValue;
      log('Settings updated:', currentSettings);
    }
  });

  // Watch for YouTube navigation
  let lastUrl = window.location.href;

  // Check URL every second (YouTube SPA detection)
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      log('URL changed to:', window.location.href);
      onPageChange();
    }
  }, 1000);

  // Initial load
  setTimeout(onPageChange, 2000);
}

function onPageChange() {
  const videoId = getVideoId();
  log('onPageChange - videoId:', videoId, 'path:', window.location.pathname);

  if (window.location.pathname === '/watch' && videoId) {
    if (videoId !== currentVideoId) {
      currentVideoId = videoId;
      log('New video detected:', videoId);
      // Wait for YouTube to fully load
      setTimeout(() => injectControlPanel(videoId), 3000);
    }
  } else {
    removeControlPanel();
  }
}

// Inject control panel
function injectControlPanel(videoId) {
  if (controlPanel) {
    log('Panel already exists, skipping');
    return;
  }

  log('Looking for movie_player...');

  // Try multiple selectors
  const moviePlayer = document.querySelector('#movie_player') ||
                      document.querySelector('.html5-video-player') ||
                      document.querySelector('ytd-watch-flexy');

  if (!moviePlayer) {
    log('movie_player not found, retrying in 2s...');
    setTimeout(() => injectControlPanel(videoId), 2000);
    return;
  }

  log('movie_player found, creating panel');

  controlPanel = document.createElement('div');
  controlPanel.id = 'dil-reaktoru-control-panel';
  controlPanel.innerHTML = `
    <div class="dr-panel-content">
      <button id="dr-translate-btn" class="dr-btn dr-btn-primary">
        <span class="dr-icon">🌐</span>
        Translate
      </button>
      <select id="dr-lang-select" class="dr-select">
        <option value="tr">Türkçe</option>
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="fr">Français</option>
        <option value="de">Deutsch</option>
        <option value="ja">日本語</option>
        <option value="ko">한국어</option>
      </select>
      <span id="dr-status" class="dr-status">Ready</span>
    </div>
  `;

  // Styles - BRIGHT AND VISIBLE
  const style = document.createElement('style');
  style.textContent = `
    #dil-reaktoru-control-panel {
      position: fixed !important;
      top: 100px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 999999 !important;
      background: linear-gradient(135deg, #ef4444, #f97316) !important;
      border-radius: 12px !important;
      padding: 12px 16px !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
      font-family: Arial, sans-serif !important;
    }
    .dr-panel-content {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
    }
    .dr-btn {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 10px 16px !important;
      border: none !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: bold !important;
      transition: all 0.2s !important;
    }
    .dr-btn-primary {
      background: white !important;
      color: #ef4444 !important;
    }
    .dr-btn-primary:hover {
      background: #fee2e2 !important;
      transform: scale(1.05) !important;
    }
    .dr-btn:disabled {
      opacity: 0.6 !important;
      cursor: not-allowed !important;
    }
    .dr-select {
      padding: 10px 12px !important;
      border-radius: 8px !important;
      border: 2px solid rgba(255,255,255,0.3) !important;
      background: rgba(255,255,255,0.1) !important;
      color: white !important;
      font-size: 14px !important;
      cursor: pointer !important;
    }
    .dr-select option {
      background: #1a1a1a !important;
      color: white !important;
    }
    .dr-status {
      font-size: 12px !important;
      color: white !important;
      font-weight: bold !important;
    }
    .dr-icon {
      font-size: 18px !important;
    }
  `;
  document.head.appendChild(style);

  // Append to body (most reliable)
  document.body.appendChild(controlPanel);
  log('Panel appended to body');

  // Event listeners
  document.getElementById('dr-translate-btn').addEventListener('click', () => {
    log('Translate button clicked');
    translateSubtitles(videoId);
  });

  const langSelect = document.getElementById('dr-lang-select');
  langSelect.value = currentSettings.targetLang || 'tr';
  langSelect.addEventListener('change', (e) => {
    currentSettings.targetLang = e.target.value;
    chrome.storage.sync.set({ settings: currentSettings });
    log('Language changed to:', e.target.value);
  });

  // Auto-translate if enabled
  if (currentSettings.autoTranslate) {
    log('Auto-translate enabled, starting translation...');
    translateSubtitles(videoId);
  }

  log('Panel created successfully!');
}

function removeControlPanel() {
  if (controlPanel) {
    controlPanel.remove();
    controlPanel = null;
    log('Panel removed');
  }
  if (subtitlesOverlay) {
    subtitlesOverlay.remove();
    subtitlesOverlay = null;
  }
  currentVideoId = null;
}

// Fetch and display subtitles
async function translateSubtitles(videoId) {
  const status = document.getElementById('dr-status');
  const btn = document.getElementById('dr-translate-btn');
  const targetLang = currentSettings.targetLang || 'tr';

  if (!status || !btn) {
    log('ERROR: Status or button not found');
    return;
  }

  status.textContent = 'Loading...';
  status.className = 'dr-status';
  btn.disabled = true;

  log('Starting translation for video:', videoId, 'target lang:', targetLang);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SUBTITLES',
      videoId,
      sourceLang: 'auto',
      targetLang
    });

    log('API response:', response);

    if (response.error) {
      throw new Error(response.error);
    }

    if (response.subtitles && response.subtitles.length > 0) {
      currentSubtitles = response.subtitles;
      showSubtitlesOverlay();
      syncSubtitlesWithVideo();
      status.textContent = response.cached ? '✓ Cached' : '✓ Done';
      status.className = 'dr-status';
    } else {
      status.textContent = 'No subs!';
      status.className = 'dr-status';
    }
  } catch (error) {
    console.error('Translation error:', error);
    status.textContent = 'Error!';
    status.className = 'dr-status';
  } finally {
    btn.disabled = false;
  }
}

// Create subtitles overlay
function showSubtitlesOverlay() {
  if (subtitlesOverlay) return;

  const moviePlayer = document.querySelector('#movie_player');
  if (!moviePlayer) return;

  subtitlesOverlay = document.createElement('div');
  subtitlesOverlay.id = 'dil-reaktoru-subtitles';
  subtitlesOverlay.innerHTML = `
    <div class="dr-subs-container">
      <div class="dr-sub-original"></div>
      <div class="dr-sub-translated"></div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #dil-reaktoru-subtitles {
      position: fixed !important;
      bottom: 120px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 80% !important;
      max-width: 800px !important;
      z-index: 999998 !important;
    }
    .dr-subs-container {
      background: rgba(0, 0, 0, 0.95) !important;
      border-radius: 12px !important;
      padding: 20px 24px !important;
      text-align: center !important;
      border: 2px solid #6366f1 !important;
    }
    .dr-sub-original {
      color: #ffffff !important;
      font-size: 22px !important;
      margin-bottom: 12px !important;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    }
    .dr-sub-translated {
      color: #a5b4fc !important;
      font-size: 24px !important;
      font-weight: bold !important;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(subtitlesOverlay);
}

// Sync subtitles with video
function syncSubtitlesWithVideo() {
  const video = document.querySelector('video');
  if (!video || !subtitlesOverlay) return;

  const update = () => {
    const currentTime = video.currentTime;
    const currentSub = currentSubtitles.find(
      sub => currentTime >= sub.start && currentTime <= sub.end
    );

    const container = subtitlesOverlay.querySelector('.dr-subs-container');
    const originalEl = container.querySelector('.dr-sub-original');
    const translatedEl = container.querySelector('.dr-sub-translated');

    if (currentSub) {
      originalEl.textContent = currentSettings.showOriginal ? currentSub.text : '';
      translatedEl.textContent = currentSub.translatedText || '';
      subtitlesOverlay.style.display = 'block';
    } else {
      subtitlesOverlay.style.display = 'none';
    }
  };

  video.removeEventListener('timeupdate', update);
  video.addEventListener('timeupdate', update);
  update();
}

// Add keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'T') {
    e.preventDefault();
    if (controlPanel) {
      controlPanel.style.display = controlPanel.style.display === 'none' ? 'flex' : 'none';
    }
  }
});

// Start
init();
console.log('Dil Reaktörü: Content script initialized');
