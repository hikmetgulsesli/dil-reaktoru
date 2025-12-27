import axios from 'axios';

class TranslationService {
  constructor() {
    this.mistralApiKey = process.env.MISTRAL_API_KEY;
    this.claudeApiKey = process.env.CLAUDE_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  async translate(text, sourceLang, targetLang, context = '') {
    // Try Mistral first (as per user preference)
    if (this.mistralApiKey) {
      try {
        return await this.translateWithMistral(text, sourceLang, targetLang, context);
      } catch (error) {
        console.warn('Mistral translation failed, trying Claude:', error.message);
      }
    }

    // Fallback to Claude
    if (this.claudeApiKey) {
      try {
        return await this.translateWithClaude(text, sourceLang, targetLang, context);
      } catch (error) {
        console.warn('Claude translation failed:', error.message);
      }
    }

    // Fallback to Gemini
    if (this.geminiApiKey) {
      try {
        return await this.translateWithGemini(text, sourceLang, targetLang);
      } catch (error) {
        console.warn('Gemini translation failed:', error.message);
      }
    }

    throw new Error('No translation provider available');
  }

  async translateWithMistral(text, sourceLang, targetLang, context) {
    const prompt = context
      ? `Context: ${context}\n\nTranslate this text from ${sourceLang} to ${targetLang}:\n"${text}"`
      : `Translate this text from ${sourceLang} to ${targetLang}:\n"${text}"`;

    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: 'mistral-tiny',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${this.mistralApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  async translateWithClaude(text, sourceLang, targetLang, context) {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Translate this text from ${sourceLang} to ${targetLang}: "${text}"`
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${this.claudeApiKey}`,
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey
        }
      }
    );

    return response.data.content[0].text.trim();
  }

  async translateWithGemini(text, sourceLang, targetLang) {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiApiKey}`,
      {
        contents: [{
          parts: [{
            text: `Translate this text from ${sourceLang} to ${targetLang}: "${text}"`
          }]
        }]
      }
    );

    return response.data.candidates[0].content.parts[0].text.trim();
  }
}

export const translationService = new TranslationService();
