// Dil Reaktörü - Simple YouTube Toggle

let isOpen = false;
let subtitlesOverlay = null;
let currentSubtitles = [];
let currentVideoId = null;
let currentSettings = {};

// Get video ID
function getVideoId() {
  const match = window.location.href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// Initialize
async function init() {
  const { settings } = await chrome.storage.sync.get('settings');
  currentSettings = settings || { targetLang: 'tr' };

  // Watch URL changes
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      onPageChange();
    }
  }, 1000);

  // Create button immediately
  createButton();

  setTimeout(onPageChange, 2000);
}

function onPageChange() {
  const videoId = getVideoId();
  if (window.location.pathname === '/watch' && videoId && videoId !== currentVideoId) {
    currentVideoId = videoId;
    if (isOpen) {
      translateAndShow();
    }
  } else if (window.location.pathname !== '/watch') {
    removeOverlay();
    removeButton();
  }
}

// Create simple toggle button
function createButton() {
  if (document.getElementById('dr-toggle-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'dr-toggle-btn';
  btn.innerHTML = '🌐 TR';
  btn.title = 'Dil Reaktörü - Click to toggle translation';

  const style = document.createElement('style');
  style.textContent = `
    #dr-toggle-btn {
      position: fixed !important;
      bottom: 80px !important;
      right: 20px !important;
      z-index: 999999 !important;
      background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
      color: white !important;
      border: none !important;
      border-radius: 50% !important;
      width: 56px !important;
      height: 56px !important;
      font-size: 24px !important;
      cursor: pointer !important;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.5) !important;
      transition: all 0.3s !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    #dr-toggle-btn:hover {
      transform: scale(1.1) !important;
      box-shadow: 0 6px 30px rgba(99, 102, 241, 0.7) !important;
    }
    #dr-toggle-btn.active {
      background: linear-gradient(135deg, #22c55e, #16a34a) !important;
      box-shadow: 0 4px 20px rgba(34, 197, 94, 0.5) !important;
    }
  `;
  document.head.appendChild(style);

  btn.addEventListener('click', toggleTranslation);

  document.body.appendChild(btn);
}

function removeButton() {
  const btn = document.getElementById('dr-toggle-btn');
  if (btn) btn.remove();
}

function toggleTranslation() {
  isOpen = !isOpen;
  const btn = document.getElementById('dr-toggle-btn');

  if (isOpen) {
    btn.classList.add('active');
    btn.innerHTML = '✕';
    if (currentVideoId) {
      translateAndShow();
    }
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '🌐 TR';
    removeOverlay();
  }
}

// Fetch and show translation
async function translateAndShow() {
  const videoId = currentVideoId;
  const targetLang = currentSettings.targetLang || 'tr';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SUBTITLES',
      videoId,
      sourceLang: 'auto',
      targetLang
    });

    if (response.subtitles && response.subtitles.length > 0) {
      currentSubtitles = response.subtitles;
      showOverlay();
      syncWithVideo();
    }
  } catch (error) {
    console.error('Dil Reaktörü error:', error);
  }
}

// Show subtitle overlay
function showOverlay() {
  if (subtitlesOverlay) return;

  subtitlesOverlay = document.createElement('div');
  subtitlesOverlay.id = 'dr-sub-overlay';

  const style = document.createElement('style');
  style.textContent = `
    #dr-sub-overlay {
      position: fixed !important;
      bottom: 150px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 999998 !important;
      width: 90% !important;
      max-width: 800px !important;
    }
    #dr-sub-overlay .dr-sub-box {
      background: rgba(0, 0, 0, 0.9) !important;
      border-radius: 12px !important;
      padding: 16px 24px !important;
      border: 2px solid #6366f1 !important;
    }
    #dr-sub-overlay .dr-sub-original {
      color: #ffffff !important;
      font-size: 18px !important;
      text-align: center !important;
      margin-bottom: 8px !important;
    }
    #dr-sub-overlay .dr-sub-translated {
      color: #a5b4fc !important;
      font-size: 22px !important;
      text-align: center !important;
      font-weight: bold !important;
    }
  `;
  document.head.appendChild(style);

  subtitlesOverlay.innerHTML = `
    <div class="dr-sub-box">
      <div class="dr-sub-original"></div>
      <div class="dr-sub-translated"></div>
    </div>
  `;

  document.body.appendChild(subtitlesOverlay);
}

function removeOverlay() {
  if (subtitlesOverlay) {
    subtitlesOverlay.remove();
    subtitlesOverlay = null;
  }
  currentSubtitles = [];
}

// Sync with video playback
function syncWithVideo() {
  const video = document.querySelector('video');
  if (!video || !subtitlesOverlay) return;

  const update = () => {
    if (!isOpen || !subtitlesOverlay) return;

    const time = video.currentTime;
    const sub = currentSubtitles.find(s => time >= s.start && time <= s.end);

    const box = subtitlesOverlay.querySelector('.dr-sub-box');
    const orig = box.querySelector('.dr-sub-original');
    const trans = box.querySelector('.dr-sub-translated');

    if (sub) {
      orig.textContent = sub.text;
      trans.textContent = sub.translatedText || '...';
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
