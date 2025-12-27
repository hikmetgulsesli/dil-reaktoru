import { useState } from 'react';

function SettingsPanel({ settings, onSave }) {
  const [formData, setFormData] = useState(settings);
  const [saved, setSaved] = useState(false);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' }
  ];

  const aiProviders = [
    { id: 'mistral', name: 'Mistral AI' },
    { id: 'claude', name: 'Claude AI' },
    { id: 'gemini', name: 'Google Gemini' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Settings</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Target Language (Translation output)
        </label>
        <select
          value={formData.targetLang}
          onChange={(e) => setFormData({ ...formData, targetLang: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          AI Provider
        </label>
        <select
          value={formData.aiProvider}
          onChange={(e) => setFormData({ ...formData, aiProvider: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {aiProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Auto-translate on load
        </label>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, autoTranslate: !formData.autoTranslate })}
          className={`w-12 h-6 rounded-full transition-colors ${
            formData.autoTranslate ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
            formData.autoTranslate ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Show original subtitles
        </label>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, showOriginal: !formData.showOriginal })}
          className={`w-12 h-6 rounded-full transition-colors ${
            formData.showOriginal ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
            formData.showOriginal ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      <button
        type="submit"
        className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
      >
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </form>
  );
}

export default SettingsPanel;
