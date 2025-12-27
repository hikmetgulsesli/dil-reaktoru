import { useState, useEffect } from 'react';
import { Trash2, Volume2 } from 'lucide-react';
import ApiService from '../services/api';

function VocabularyPanel() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVocabulary();
  }, []);

  const loadVocabulary = async () => {
    try {
      const response = await ApiService.getVocabulary();
      setWords(response.words || []);
    } catch (error) {
      console.error('Failed to load vocabulary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    // In production, call API to delete
    setWords(words.filter(w => w.id !== id));
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-500 mt-2">Loading...</p>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Volume2 className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-800">No words yet</h3>
        <p className="text-gray-500 mt-1 text-sm">
          Click on translated words in video to add them
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">
        Your Vocabulary ({words.length})
      </h2>

      <div className="max-h-80 overflow-y-auto space-y-2">
        {words.map((item) => (
          <div
            key={item.id}
            className="p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-800">{item.word}</p>
                <p className="text-sm text-indigo-600">{item.translation}</p>
                {item.context && (
                  <p className="text-xs text-gray-500 mt-1 italic">
                    "{item.context}"
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VocabularyPanel;
