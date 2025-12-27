// Dil Reaktörü - Simple YouTube Toggle with Click-to-Translate

let isOpen = false;
let subtitlesOverlay = null;
let translationPopup = null;
let currentSubtitles = [];
let currentVideoId = null;
let currentSettings = {};
let currentVideo = null;

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
    currentVideo = document.querySelector('video');
    if (isOpen) {
      translateAndShow();
    }
  } else if (window.location.pathname !== '/watch') {
    removeOverlay();
    removeButton();
    removePopup();
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
    } else if (response.needsExtraction) {
      showNoCaptionsMessage();
    }
  } catch (error) {
    console.error('Dil Reaktörü error:', error);
  }
}

function showNoCaptionsMessage() {
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
      cursor: pointer !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      transition: background 0.2s !important;
    }
    #dr-sub-overlay .dr-sub-translated:hover {
      background: rgba(99, 102, 241, 0.3) !important;
    }
    #dr-sub-overlay .dr-sub-translated.loading {
      color: #9ca3af !important;
      cursor: wait !important;
    }
  `;
  document.head.appendChild(style);

  subtitlesOverlay.innerHTML = `
    <div class="dr-sub-box">
      <div class="dr-sub-original">No captions available</div>
      <div class="dr-sub-translated loading">Processing with AI...</div>
    </div>
  `;

  document.body.appendChild(subtitlesOverlay);
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
      cursor: pointer !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      transition: background 0.2s !important;
    }
    #dr-sub-overlay .dr-sub-translated:hover {
      background: rgba(99, 102, 241, 0.3) !important;
    }
    #dr-sub-overlay .dr-sub-translated.loading {
      color: #9ca3af !important;
      cursor: wait !important;
    }
  `;
  document.head.appendChild(style);

  subtitlesOverlay.innerHTML = `
    <div class="dr-sub-box">
      <div class="dr-sub-original"></div>
      <div class="dr-sub-translated" title="Click to translate word"></div>
    </div>
  `;

  // Add click handler for word translation
  const translatedElement = subtitlesOverlay.querySelector('.dr-sub-translated');
  translatedElement.addEventListener('click', handleWordClick);

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
  currentVideo = document.querySelector('video');
  if (!currentVideo || !subtitlesOverlay) return;

  const update = () => {
    if (!isOpen || !subtitlesOverlay) return;

    const time = currentVideo.currentTime;
    const sub = currentSubtitles.find(s => time >= s.start && time <= s.end);

    const box = subtitlesOverlay.querySelector('.dr-sub-box');
    const orig = box.querySelector('.dr-sub-original');
    const trans = box.querySelector('.dr-sub-translated');

    if (sub) {
      orig.textContent = sub.text;
      trans.textContent = sub.translatedText || '...';
      trans.dataset.fullText = sub.translatedText || '';
      subtitlesOverlay.style.display = 'block';
    } else {
      subtitlesOverlay.style.display = 'none';
    }
  };

  currentVideo.removeEventListener('timeupdate', update);
  currentVideo.addEventListener('timeupdate', update);
  update();
}

// Handle word click for translation popup
async function handleWordClick(event) {
  event.stopPropagation();

  const target = event.target;
  const fullText = target.dataset.fullText || target.textContent;

  // Get selected word or use clicked element
  const selection = window.getSelection();
  let word = selection.toString().trim();

  if (!word) {
    // If no selection, try to get word under cursor
    const clickedText = target.textContent;
    word = clickedText;
  }

  if (word.length < 2) return;

  // Get current video time for context
  const videoTime = currentVideo ? currentVideo.currentTime : 0;

  // Find current subtitle for context
  const currentSub = currentSubtitles.find(
    s => videoTime >= s.start && videoTime <= s.end
  );

  // Show loading state
  showTranslationPopup(event.clientX, event.clientY, 'Loading...', word);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_TEXT',
      text: word,
      sourceLang: 'auto',
      targetLang: currentSettings.targetLang || 'tr',
      context: currentSub?.text || ''
    });

    if (response.translation) {
      showTranslationPopup(event.clientX, event.clientY, response.translation, word, currentSub);
    } else {
      showTranslationPopup(event.clientX, event.clientY, 'Translation not available', word, currentSub);
    }
  } catch (error) {
    showTranslationPopup(event.clientX, event.clientY, 'Error: ' + error.message, word);
  }
}

// Show translation popup
function showTranslationPopup(x, y, translation, word, contextSub = null) {
  removePopup();

  translationPopup = document.createElement('div');
  translationPopup.id = 'dr-translation-popup';

  const style = document.createElement('style');
  style.textContent = `
    #dr-translation-popup {
      position: fixed !important;
      z-index: 9999999 !important;
      background: white !important;
      border-radius: 12px !important;
      padding: 12px 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
      max-width: 300px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    #dr-translation-popup .dr-popup-word {
      font-weight: bold !important;
      font-size: 16px !important;
      color: #1f2937 !important;
      margin-bottom: 4px !important;
    }
    #dr-translation-popup .dr-popup-translation {
      font-size: 18px !important;
      color: #6366f1 !important;
      margin-bottom: 8px !important;
    }
    #dr-translation-popup .dr-popup-actions {
      display: flex !important;
      gap: 8px !important;
      margin-top: 8px !important;
    }
    #dr-translation-popup .dr-popup-btn {
      flex: 1 !important;
      padding: 8px 12px !important;
      border: none !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      transition: all 0.2s !important;
    }
    #dr-translation-popup .dr-popup-save {
      background: #6366f1 !important;
      color: white !important;
    }
    #dr-translation-popup .dr-popup-save:hover {
      background: #4f46e5 !important;
    }
    #dr-translation-popup .dr-popup-close {
      background: #f3f4f6 !important;
      color: #6b7280 !important;
    }
    #dr-translation-popup .dr-popup-close:hover {
      background: #e5e7eb !important;
    }
    #dr-translation-popup .dr-popup-loading {
      color: #9ca3af !important;
      font-size: 14px !important;
    }
  `;
  document.head.appendChild(style);

  translationPopup.innerHTML = `
    <div class="dr-popup-word">${escapeHtml(word)}</div>
    <div class="dr-popup-translation">${escapeHtml(translation)}</div>
    <div class="dr-popup-actions">
      <button class="dr-popup-btn dr-popup-save" id="dr-save-btn">Save</button>
      <button class="dr-popup-btn dr-popup-close" id="dr-close-popup">Close</button>
    </div>
  `;

  document.body.appendChild(translationPopup);

  // Position popup
  positionPopup(x, y);

  // Add event listeners
  document.getElementById('dr-close-popup').addEventListener('click', removePopup);
  document.getElementById('dr-save-btn').addEventListener('click', () => saveToVocabulary(word, translation, contextSub));

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', closePopupOnClickOutside);
  }, 100);
}

function positionPopup(x, y) {
  if (!translationPopup) return;

  const popupRect = translationPopup.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let posX = x + 10;
  let posY = y + 10;

  // Adjust if going off screen
  if (posX + popupRect.width > viewportWidth) {
    posX = x - popupRect.width - 10;
  }
  if (posY + popupRect.height > viewportHeight) {
    posY = y - popupRect.height - 10;
  }

  translationPopup.style.left = posX + 'px';
  translationPopup.style.top = posY + 'px';
}

function removePopup() {
  if (translationPopup) {
    translationPopup.remove();
    translationPopup = null;
  }
  document.removeEventListener('click', closePopupOnClickOutside);
}

function closePopupOnClickOutside(event) {
  if (translationPopup && !translationPopup.contains(event.target)) {
    removePopup();
  }
}

// Save word to vocabulary
async function saveToVocabulary(word, translation, contextSub = null) {
  try {
    await chrome.runtime.sendMessage({
      type: 'ADD_TO_VOCABULARY',
      word,
      translation,
      context: contextSub?.text || '',
      language: currentSettings.targetLang || 'tr',
      videoId: currentVideoId,
      timestamp: currentVideo ? currentVideo.currentTime : 0
    });

    // Show saved feedback
    const saveBtn = document.getElementById('dr-save-btn');
    if (saveBtn) {
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      saveBtn.style.background = '#22c55e';

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = '';
        removePopup();
      }, 1000);
    }
  } catch (error) {
    console.error('Error saving to vocabulary:', error);
    const saveBtn = document.getElementById('dr-save-btn');
    if (saveBtn) {
      saveBtn.textContent = 'Error';
    }
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start
init();
