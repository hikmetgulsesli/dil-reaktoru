import { jest } from '@jest/globals';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('TranslationService', () => {
  let translationService;

  beforeAll(async () => {
    // Dynamic import to get fresh module with mocked axios
    const module = await import('../src/services/translationService.js');
    translationService = module.translationService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Set environment variables
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  describe('translateWithMistral', () => {
    it('should translate text successfully', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Hola Mundo' } }]
        }
      });

      const result = await translationService.translateWithMistral(
        'Hello World',
        'en',
        'es'
      );

      expect(result).toBe('Hola Mundo');
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/chat/completions',
        expect.objectContaining({
          model: 'mistral-tiny',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' })
          ])
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-mistral-key'
          })
        })
      );
    });

    it('should throw error on API failure', async () => {
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        translationService.translateWithMistral('test', 'en', 'es')
      ).rejects.toThrow('API Error');
    });
  });

  describe('translateWithClaude', () => {
    it('should translate text successfully', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          content: [{ text: 'Bonjour le monde' }]
        }
      });

      const result = await translationService.translateWithClaude(
        'Hello World',
        'en',
        'fr'
      );

      expect(result).toBe('Bonjour le monde');
    });
  });

  describe('translateWithGemini', () => {
    it('should translate text successfully', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          candidates: [{ content: { parts: [{ text: 'Hallo Welt' }] } }]
        }
      });

      const result = await translationService.translateWithGemini(
        'Hello World',
        'en',
        'de'
      );

      expect(result).toBe('Hallo Welt');
    });
  });

  describe('translate (main method)', () => {
    it('should use Mistral as primary provider', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Test translation' } }]
        }
      });

      const result = await translationService.translate('test', 'en', 'tr');

      expect(result).toBe('Test translation');
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('should fallback to Claude if Mistral fails', async () => {
      axios.post
        .mockRejectedValueOnce(new Error('Mistral failed'))
        .mockResolvedValueOnce({
          data: { content: [{ text: 'Claude fallback' }] }
        });

      const result = await translationService.translate('test', 'en', 'tr');

      expect(result).toBe('Claude fallback');
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('should throw error if all providers fail', async () => {
      axios.post.mockRejectedValue(new Error('All providers failed'));

      await expect(
        translationService.translate('test', 'en', 'tr')
      ).rejects.toThrow('No translation provider available');
    });
  });
});
