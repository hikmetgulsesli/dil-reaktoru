const API_BASE = import.meta.env.VITE_API_URL || 'https://dil.setrox.net/api';

class ApiService {
  async request(endpoint, options = {}) {
    const token = await this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getToken() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['token'], (result) => {
        resolve(result.token);
      });
    });
  }

  // Auth
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async register(email, password, name) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
  }

  // Subtitles
  async getSubtitles(videoId, sourceLang = 'auto', targetLang = 'tr') {
    return this.request(`/subtitle/youtube/${videoId}?sourceLang=${sourceLang}&targetLang=${targetLang}`);
  }

  async saveBookmark(videoId, timestamp, note, subtitleText) {
    return this.request('/subtitle/bookmark', {
      method: 'POST',
      body: JSON.stringify({ videoId, timestamp, note, subtitleText })
    });
  }

  // Translation
  async translate(text, sourceLang, targetLang, context = '') {
    return this.request('/translate', {
      method: 'POST',
      body: JSON.stringify({ text, sourceLang, targetLang, context })
    });
  }

  // User
  async getVocabulary() {
    return this.request('/user/vocabulary');
  }

  async addWord(word, translation, context, language) {
    return this.request('/user/vocabulary', {
      method: 'POST',
      body: JSON.stringify({ word, translation, context, language })
    });
  }

  async getPreferences() {
    return this.request('/user/preferences');
  }

  async updatePreferences(preferences) {
    return this.request('/user/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences })
    });
  }
}

export default new ApiService();
