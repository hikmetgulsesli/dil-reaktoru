import { useState, useEffect } from 'react';
import { Settings, Play, Languages, BookOpen, User } from 'lucide-react';
import ApiService from './services/api';
import SettingsPanel from './components/SettingsPanel';
import VocabularyPanel from './components/VocabularyPanel';
import LoginPanel from './components/LoginPanel';

function App() {
  const [activeTab, setActiveTab] = useState('translate');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [settings, setSettings] = useState({
    sourceLang: 'auto',
    targetLang: 'tr',
    aiProvider: 'mistral',
    autoTranslate: true
  });

  useEffect(() => {
    // Load settings from storage
    chrome.storage.sync.get(['settings', 'token'], (result) => {
      if (result.settings) setSettings(result.settings);
      if (result.token) setIsLoggedIn(true);
    });
  }, []);

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    chrome.storage.sync.set({ settings: newSettings });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Languages className="w-6 h-6" />
            Dil Reaktörü
          </h1>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <button
                onClick={() => setActiveTab('vocabulary')}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <BookOpen className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('login')}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <User className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className="p-2 hover:bg-white/20 rounded-lg"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      {isLoggedIn && activeTab !== 'login' && (
        <nav className="flex border-b bg-white">
          <button
            onClick={() => setActiveTab('translate')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'translate'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500'
            }`}
          >
            Translate
          </button>
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'vocabulary'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500'
            }`}
          >
            Vocabulary
          </button>
        </nav>
      )}

      {/* Main Content */}
      <main className="p-4">
        {activeTab === 'translate' && (
          <TranslatePanel settings={settings} isLoggedIn={isLoggedIn} />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel settings={settings} onSave={handleSaveSettings} />
        )}
        {activeTab === 'vocabulary' && isLoggedIn && <VocabularyPanel />}
        {activeTab === 'vocabulary' && !isLoggedIn && <LoginPanel onLogin={() => setIsLoggedIn(true)} />}
        {activeTab === 'login' && <LoginPanel onLogin={() => {
          setIsLoggedIn(true);
          setActiveTab('translate');
        }} />}
      </main>

      {/* Footer */}
      <footer className="p-3 text-center text-xs text-gray-400 border-t">
        Powered by AI Translation
      </footer>
    </div>
  );
}

function TranslatePanel({ settings, isLoggedIn }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const extractVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  const handleTranslate = async () => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.getSubtitles(videoId, settings.sourceLang, settings.targetLang);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Paste YouTube URL..."
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleTranslate}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? '...' : <Play className="w-4 h-4" />}
          Translate
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-700">
            {result.cached ? 'Loaded from cache' : 'Translation complete!'}
          </p>
          <p className="text-xs text-green-600 mt-1">
            {result.subtitles?.length || 0} subtitles processed
          </p>
          <button className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg text-sm">
            Apply Subtitles to Video
          </button>
        </div>
      )}

      {!isLoggedIn && (
        <p className="text-xs text-gray-500 text-center">
          Sign in to save translations and track vocabulary
        </p>
      )}
    </div>
  );
}

export default App;
