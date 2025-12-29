// Dil Reaktörü - YouTube Player Integration
// Research: YouTube uses Shadow DOM and dynamic element injection

let isOpen = false;
let subtitlesOverlay = null;
let translationPopup = null;
let controlButton = null;
let settingsMenu = null;
let currentSubtitles = [];
let currentVideoId = null;
let currentSettings = {};
let currentVideo = null;
let playerReady = false;

// Get video ID
function getVideoId() {
  const match = window.location.href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// Initialize
async function init() {
  const { settings } = await chrome.storage.sync.get('settings');
  currentSettings = settings || {
    targetLang: 'tr',
    autoTranslate: true,
    showOriginal: true,
    showTranslated: true
  };

  // Check for video on initial load
  onPageChange();

  // Watch URL changes
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      playerReady = false;
      removeButton();
      onPageChange();
    }
  }, 1000);

  // Start watching for player
  watchForPlayer();
}

// Watch for YouTube player
function watchForPlayer() {
  // Use MutationObserver to detect when player elements change
  const observer = new MutationObserver((mutations) => {
    if (!playerReady) {
      tryInjectButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Periodic check as fallback
  setInterval(() => {
    if (!playerReady) {
      tryInjectButton();
    }
  }, 500);
}

// Try multiple injection strategies
function tryInjectButton() {
  if (playerReady) return;
  if (window.location.pathname !== '/watch') return;

  // Strategy 1: Try to find movie_player
  const moviePlayer = document.getElementById('movie_player');
  if (moviePlayer && !document.getElementById('dr-control-btn')) {
    injectIntoPlayer(moviePlayer);
    return;
  }

  // Strategy 2: Look for ytp-right-controls in shadow DOM
  const ytpRightControls = findYtpRightControls();
  if (ytpRightControls && !document.getElementById('dr-control-btn')) {
    injectIntoControls(ytpRightControls);
    return;
  }

  // Strategy 3: Find the settings button
  const settingsBtn = document.querySelector('.ytp-settings-button');
  if (settingsBtn && settingsBtn.parentElement && !document.getElementById('dr-control-btn')) {
    injectNextToElement(settingsBtn);
    return;
  }

  // Strategy 4: Find any button in the control bar
  const controlButtons = document.querySelectorAll('.ytp-chrome-bottom button, .ytp-controls button');
  if (controlButtons.length > 0 && !document.getElementById('dr-control-btn')) {
    injectNextToElement(controlButtons[controlButtons.length - 1]);
    return;
  }
}

// Find ytp-right-controls (may be in shadow DOM)
function findYtpRightControls() {
  // Try regular DOM
  let controls = document.querySelector('.ytp-right-controls');
  if (controls) return controls;

  // Try inside movie_player
  const moviePlayer = document.getElementById('movie_player');
  if (moviePlayer) {
    controls = moviePlayer.querySelector('.ytp-right-controls');
    if (controls) return controls;
  }

  // Try all possible locations
  const allElements = document.querySelectorAll('*');
  for (let el of allElements) {
    if (el.className && el.className.includes('ytp-right-controls')) {
      return el;
    }
    // Check shadow roots if any
    if (el.shadowRoot) {
      const shadowControls = el.shadowRoot.querySelector('.ytp-right-controls');
      if (shadowControls) return shadowControls;
    }
  }

  return null;
}

// Inject into player container
function injectIntoPlayer(container) {
  // Create a button that's styled to look like it's part of the player
  controlButton = document.createElement('button');
  controlButton.id = 'dr-control-btn';
  controlButton.className = 'ytp-button';
  controlButton.title = 'Dil Reaktörü - Çeviri Ayarları';

  // Button style to match YouTube player buttons
  controlButton.style.cssText = `
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    margin: 0 2px !important;
    background: transparent !important;
    border: none !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    overflow: hidden !important;
  `;

  updateButtonAppearance();

  controlButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSettingsMenu();
  });

  // Try to insert into controls area
  const controlsArea = findControlsArea();
  if (controlsArea) {
    controlsArea.insertBefore(controlButton, controlsArea.firstChild);
    playerReady = true;
    console.log('Dil Reaktörü: Button injected into controls area');
  } else {
    // Fallback: append to player
    container.appendChild(controlButton);
    playerReady = true;
    console.log('Dil Reaktörü: Button appended to player');
  }
}

// Inject into controls element
function injectIntoControls(controls) {
  injectIntoPlayer(controls);
}

// Inject next to a specific element
function injectNextToElement(element) {
  controlButton = document.createElement('button');
  controlButton.id = 'dr-control-btn';
  controlButton.className = 'ytp-button';
  controlButton.title = 'Dil Reaktörü - Çeviri Ayarları';

  controlButton.style.cssText = `
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    margin: 0 2px !important;
    background: transparent !important;
    border: none !important;
    border-radius: 4px !important;
    cursor: pointer !important;
  `;

  updateButtonAppearance();

  controlButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSettingsMenu();
  });

  const parent = element.parentElement;
  if (parent) {
    parent.insertBefore(controlButton, element.nextSibling);
    playerReady = true;
    console.log('Dil Reaktörü: Button injected next to element');
  }
}

// Find the controls area in YouTube's DOM
function findControlsArea() {
  // Try multiple selectors
  const selectors = [
    '.ytp-right-controls',
    '.ytp-chrome-bottom .ytp-right',
    '.ytp-controls-right',
    '.ytp-chrome-controls .ytp-right',
    '.ytp-bottom-right-controls'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  // Fallback: find settings button's parent
  const settingsBtn = document.querySelector('.ytp-settings-button');
  if (settingsBtn && settingsBtn.parentElement) {
    return settingsBtn.parentElement;
  }

  return null;
}

// Update button appearance based on state
function updateButtonAppearance() {
  if (!controlButton) return;

  if (isOpen) {
    controlButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `;
    controlButton.style.color = '#22c55e';
  } else {
    controlButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12.87 15.07L10.33 12.56L10.36 12.53C12.1 10.59 13.34 8.05 13.34 5.33C13.34 2.56 11.04 0.67 8.26 0.66C5.48 0.65 3.24 2.5 3.23 5.28H1.23C1.24 1.97 4.13 0.06 7.27 0.05C10.5 0.04 13.34 2.02 13.34 5.33C13.34 7.71 12.43 9.85 10.94 11.44L6.5 16L7.96 17.46L12.87 12.53L12.87 15.07ZM2.23 7.33H6.23C6.18 8.76 6.92 10.09 8.05 11.02L9.64 12.61L8.18 14.07L6.23 12.12C5.21 13.16 4.31 14.17 4.31 15.79C4.31 17.43 5.67 18.79 7.31 18.79C8.93 18.79 10.29 17.43 10.29 15.79C10.29 14.17 9.39 13.16 8.37 12.12L11.8 8.69L10.34 7.23L6.91 10.66C5.78 9.73 5.04 8.4 5.01 6.97H1.23C1.26 8.82 2.23 10.57 3.63 11.81L2.23 7.33Z"/>
      </svg>
    `;
    controlButton.style.color = 'white';
  }
}

// Toggle settings menu
function toggleSettingsMenu() {
  if (settingsMenu) {
    closeSettingsMenu();
  } else {
    openSettingsMenu();
  }
}

// Open settings menu
function openSettingsMenu() {
  if (settingsMenu) return;

  settingsMenu = document.createElement('div');
  settingsMenu.id = 'dr-settings-menu';

  const autoTranslateChecked = currentSettings.autoTranslate ? 'checked' : '';
  const showOriginalChecked = currentSettings.showOriginal ? 'checked' : '';
  const showTranslatedChecked = currentSettings.showTranslated ? 'checked' : '';

  settingsMenu.innerHTML = `
    <div class="dr-menu-header">Dil Reaktörü</div>
    <div class="dr-menu-divider"></div>
    <label class="dr-menu-item">
      <input type="checkbox" id="dr-opt-auto" ${autoTranslateChecked}>
      <span>Otomatik Çeviri</span>
    </label>
    <label class="dr-menu-item">
      <input type="checkbox" id="dr-opt-original" ${showOriginalChecked}>
      <span>Orijinal Alt Yazı</span>
    </label>
    <label class="dr-menu-item">
      <input type="checkbox" id="dr-opt-translated" ${showTranslatedChecked}>
      <span>Çevrilmiş Alt Yazı</span>
    </label>
    <div class="dr-menu-divider"></div>
    <div class="dr-menu-item" id="dr-btn-toggle">
      ${isOpen ? 'Kapat' : 'Aç'}
    </div>
    <div class="dr-menu-item" id="dr-btn-vocab">
      Kelime Defteri
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #dr-settings-menu {
      position: fixed !important;
      bottom: 70px !important;
      right: 60px !important;
      background: #1f1f1f !important;
      border-radius: 8px !important;
      padding: 8px 0 !important;
      min-width: 180px !important;
      z-index: 9999999 !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      color: white !important;
    }
    #dr-settings-menu .dr-menu-header {
      padding: 10px 14px 6px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      color: #6366f1 !important;
    }
    #dr-settings-menu .dr-menu-divider {
      height: 1px !important;
      background: #333 !important;
      margin: 6px 0 !important;
    }
    #dr-settings-menu .dr-menu-item {
      display: flex !important;
      align-items: center !important;
      padding: 8px 14px !important;
      color: #fff !important;
      font-size: 13px !important;
      cursor: pointer !important;
      transition: background 0.15s !important;
    }
    #dr-settings-menu .dr-menu-item:hover {
      background: #333 !important;
    }
    #dr-settings-menu .dr-menu-item input[type="checkbox"] {
      margin-right: 10px !important;
      width: 16px !important;
      height: 16px !important;
      accent-color: #6366f1 !important;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(settingsMenu);

  // Add event listeners
  document.getElementById('dr-opt-auto').addEventListener('change', (e) => {
    currentSettings.autoTranslate = e.target.checked;
    saveSettings();
    if (e.target.checked && currentVideoId) {
      checkAndAutoTranslate();
    }
  });

  document.getElementById('dr-opt-original').addEventListener('change', (e) => {
    currentSettings.showOriginal = e.target.checked;
    saveSettings();
    if (isOpen) translateAndShow();
  });

  document.getElementById('dr-opt-translated').addEventListener('change', (e) => {
    currentSettings.showTranslated = e.target.checked;
    saveSettings();
    if (isOpen) translateAndShow();
  });

  document.getElementById('dr-btn-toggle').addEventListener('click', () => {
    closeSettingsMenu();
    toggleTranslation();
  });

  document.getElementById('dr-btn-vocab').addEventListener('click', () => {
    closeSettingsMenu();
    chrome.runtime.sendMessage({ type: 'OPEN_VOCABULARY' });
  });

  console.log('Dil Reaktörü: Settings menu opened');
}

// Close settings menu
function closeSettingsMenu() {
  if (settingsMenu) {
    settingsMenu.remove();
    settingsMenu = null;
  }
}

// Save settings
async function saveSettings() {
  await chrome.storage.sync.set({ settings: currentSettings });
}

function onPageChange() {
  const videoId = getVideoId();
  console.log('Dil Reaktörü: Page changed, videoId:', videoId, 'path:', window.location.pathname);

  if (window.location.pathname === '/watch' && videoId) {
    currentVideoId = videoId;
    currentVideo = document.querySelector('video');
    console.log('Dil Reaktörü: New video detected:', currentVideoId);

    if (currentSettings.autoTranslate) {
      checkAndAutoTranslate();
    }
  } else if (window.location.pathname !== '/watch') {
    removeOverlay();
    closeSettingsMenu();
    removeButton();
  }
}

// Check if we should auto-translate
async function checkAndAutoTranslate() {
  if (currentSettings.autoTranslate && currentVideoId) {
    isOpen = true;
    updateButtonAppearance();
    translateAndShow();
  }
}

function toggleTranslation() {
  isOpen = !isOpen;
  updateButtonAppearance();

  if (isOpen) {
    if (currentVideoId) {
      translateAndShow();
    }
  } else {
    removeOverlay();
  }
}

// Fetch and show translation
async function translateAndShow() {
  const videoId = currentVideoId;
  const targetLang = currentSettings.targetLang || 'tr';

  if (!videoId) {
    console.error('Dil Reaktörü: No video ID');
    return;
  }

  try {
    console.log('Dil Reaktörü: Fetching subtitles for', videoId);
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SUBTITLES',
      videoId,
      sourceLang: 'auto',
      targetLang
    });

    console.log('Dil Reaktörü: Response', response);

    if (response.subtitles && response.subtitles.length > 0) {
      currentSubtitles = response.subtitles;
      showOverlay();
      syncWithVideo();
      console.log('Dil Reaktörü: Showing', response.subtitles.length, 'subtitles');
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
  `;
  document.head.appendChild(style);

  subtitlesOverlay.innerHTML = `
    <div class="dr-sub-box">
      <div class="dr-sub-original">No captions available</div>
      <div class="dr-sub-translated">Processing with AI...</div>
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
      display: ${currentSettings.showOriginal ? 'block' : 'none'};
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
      display: ${currentSettings.showTranslated ? 'block' : 'none'};
    }
    #dr-sub-overlay .dr-sub-translated:hover {
      background: rgba(99, 102, 241, 0.3) !important;
    }
  `;
  document.head.appendChild(style);

  subtitlesOverlay.innerHTML = `
    <div class="dr-sub-box">
      <div class="dr-sub-original"></div>
      <div class="dr-sub-translated" title="Click to translate word"></div>
    </div>
  `;

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

function removeButton() {
  if (controlButton) {
    controlButton.remove();
    controlButton = null;
  }
  playerReady = false;
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
    if (!box) return;

    const orig = box.querySelector('.dr-sub-original');
    const trans = box.querySelector('.dr-sub-translated');

    if (sub) {
      if (orig) orig.textContent = sub.text;
      if (trans) {
        trans.textContent = sub.translatedText || '...';
        trans.dataset.fullText = sub.translatedText || '';
      }
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

  const selection = window.getSelection();
  let word = selection.toString().trim();

  if (!word) {
    const clickedText = target.textContent;
    word = clickedText;
  }

  if (word.length < 2) return;

  const videoTime = currentVideo ? currentVideo.currentTime : 0;

  const currentSub = currentSubtitles.find(
    s => videoTime >= s.start && videoTime <= s.end
  );

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

  positionPopup(x, y);

  document.getElementById('dr-close-popup').addEventListener('click', removePopup);
  document.getElementById('dr-save-btn').addEventListener('click', () => saveToVocabulary(word, translation, contextSub));

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
