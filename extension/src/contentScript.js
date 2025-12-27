// Dil Reaktörü - YouTube Content Script

console.log('Dil Reaktörü: Content script loaded');

let controlPanel = null;
let subtitlesOverlay = null;
let currentSubtitles = [];
let currentVideoId = null;
let currentSettings = {};

// Get video ID from URL
function getVideoId() {
  const match = window.location.href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// Initialize
async function init() {
  const { settings } = await chrome.storage.sync.get('settings');
  currentSettings = settings || {
    targetLang: 'tr',
    showOriginal: true,
    autoTranslate: false
  };

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      currentSettings = changes.settings.newValue;
      updateControlPanel();
    }
  });

  // Watch for navigation (YouTube is SPA)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      onPageChange();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial load
  onPageChange();
}

function onPageChange() {
  const videoId = getVideoId();

  // Only on watch pages (not shorts, not home, etc.)
  if (window.location.pathname === '/watch' && videoId && videoId !== currentVideoId) {
    currentVideoId = videoId;
    setTimeout(() => injectControlPanel(videoId), 1000);
  }

  // Remove if not on watch page
  if (window.location.pathname !== '/watch') {
    removeControlPanel();
  }
}

// Inject control panel near video
function injectControlPanel(videoId) {
  if (controlPanel) return;

  // Find YouTube's control bar
  const moviePlayer = document.querySelector('#movie_player');
  if (!moviePlayer) return;

  controlPanel = document.createElement('div');
  controlPanel.id = 'dil-reaktoru-control-panel';
  controlPanel.innerHTML = `
    <div class="dr-panel-content">
      <button id="dr-translate-btn" class="dr-btn dr-btn-primary">
        <span class="dr-icon">🌐</span>
        Translate Subtitles
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
      <span id="dr-status" class="dr-status"></span>
    </div>
  `;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #dil-reaktoru-control-panel {
      position: absolute;
      top: -55px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: rgba(30, 30, 30, 0.95);
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .dr-panel-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .dr-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .dr-btn-primary {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
    }
    .dr-btn-primary:hover {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
    }
    .dr-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .dr-select {
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #444;
      background: #1a1a1a;
      color: white;
      font-size: 14px;
      cursor: pointer;
    }
    .dr-select:focus {
      outline: none;
      border-color: #6366f1;
    }
    .dr-status {
      font-size: 12px;
      color: #aaa;
    }
    .dr-status.loading {
      color: #fbbf24;
    }
    .dr-status.success {
      color: #34d399;
    }
    .dr-status.error {
      color: #f87171;
    }
    .dr-icon {
      font-size: 16px;
    }
  `;
  document.head.appendChild(style);

  // Insert after video controls
  const rightControls = moviePlayer.querySelector('.ytp-right-controls');
  if (rightControls) {
    moviePlayer.insertBefore(controlPanel, rightControls);
  } else {
    // Fallback: append to movie player
    moviePlayer.appendChild(controlPanel);
  }

  // Event listeners
  document.getElementById('dr-translate-btn').addEventListener('click', () => translateSubtitles(videoId));
  document.getElementById('dr-lang-select').value = currentSettings.targetLang;
  document.getElementById('dr-lang-select').addEventListener('change', (e) => {
    currentSettings.targetLang = e.target.value;
    chrome.storage.sync.set({ settings: currentSettings });
  });

  // Auto-translate if enabled
  if (currentSettings.autoTranslate) {
    translateSubtitles(videoId);
  }
}

function removeControlPanel() {
  if (controlPanel) {
    controlPanel.remove();
    controlPanel = null;
  }
  if (subtitlesOverlay) {
    subtitlesOverlay.remove();
    subtitlesOverlay = null;
  }
  currentVideoId = null;
}

function updateControlPanel() {
  if (controlPanel) {
    const langSelect = document.getElementById('dr-lang-select');
    if (langSelect) {
      langSelect.value = currentSettings.targetLang || 'tr';
    }
  }
}

// Fetch and display subtitles
async function translateSubtitles(videoId) {
  const status = document.getElementById('dr-status');
  const btn = document.getElementById('dr-translate-btn');
  const targetLang = currentSettings.targetLang || 'tr';

  if (!status || !btn) return;

  status.textContent = 'Loading...';
  status.className = 'dr-status loading';
  btn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SUBTITLES',
      videoId,
      sourceLang: 'auto',
      targetLang
    });

    if (response.error) {
      throw new Error(response.error);
    }

    if (response.subtitles && response.subtitles.length > 0) {
      currentSubtitles = response.subtitles;
      showSubtitlesOverlay();
      syncSubtitlesWithVideo();
      status.textContent = response.cached ? 'Cached' : 'Done';
      status.className = 'dr-status success';
    } else {
      status.textContent = 'No subtitles';
      status.className = 'dr-status error';
    }
  } catch (error) {
    console.error('Translation error:', error);
    status.textContent = 'Error: ' + error.message;
    status.className = 'dr-status error';
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
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 900px;
      z-index: 9998;
      pointer-events: none;
    }
    .dr-subs-container {
      background: rgba(0, 0, 0, 0.85);
      border-radius: 8px;
      padding: 16px 20px;
      text-align: center;
    }
    .dr-sub-original {
      color: #ffffff;
      font-size: 20px;
      margin-bottom: 8px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    .dr-sub-translated {
      color: #a5b4fc;
      font-size: 20px;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);

  moviePlayer.appendChild(subtitlesOverlay);
}

// Sync subtitles with video playback
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

// Start
init();
