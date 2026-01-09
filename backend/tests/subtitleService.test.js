import { jest } from '@jest/globals';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('SubtitleService', () => {
  let subtitleService;

  beforeAll(async () => {
    // Clear module cache and reimport
    const module = await import('../src/services/subtitleService.js');
    subtitleService = module.subtitleService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset proxy list
    process.env.WEBSHARE_API_TOKEN = 'test-token';
  });

  describe('parseCaptionXml', () => {
    it('should parse YouTube caption XML correctly', async () => {
      const { parseCaptionXml } = await import('../src/services/subtitleService.js');
      
      const xml = `
        <transcript>
          <text start="0.0" dur="2.5">Hello world</text>
          <text start="2.5" dur="3.0">This is a test</text>
          <text start="5.5" dur="4.0">Goodbye world</text>
        </transcript>
      `;

      const result = parseCaptionXml(xml);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ start: 0, end: 2.5, text: 'Hello world' });
      expect(result[1]).toEqual({ start: 2.5, end: 5.5, text: 'This is a test' });
      expect(result[2]).toEqual({ start: 5.5, end: 9.5, text: 'Goodbye world' });
    });

    it('should handle HTML entities', async () => {
      const { parseCaptionXml } = await import('../src/services/subtitleService.js');
      
      const xml = `<text start="0" dur="1">Hello & World 'test'</text>`;
      const result = parseCaptionXml(xml);

      expect(result[0].text).toBe("Hello & World 'test'");
    });

    it('should skip empty text elements', async () => {
      const { parseCaptionXml } = await import('../src/services/subtitleService.js');
      
      const xml = `
        <text start="0" dur="1">Valid text</text>
        <text start="1" dur="1"></text>
        <text start="2" dur="1">Another valid</text>
      `;
      const result = parseCaptionXml(xml);

      expect(result).toHaveLength(2);
    });
  });

  describe('convertWhisperToSubtitles', () => {
    it('should convert Whisper segments to subtitles', async () => {
      const { subtitleService } = await import('../src/services/subtitleService.js');
      
      const whisperData = {
        segments: [
          { start: 0, end: 5, text: ' Hello there' },
          { start: 5, end: 10, text: ' General Kenobi' }
        ]
      };

      const result = subtitleService.convertWhisperToSubtitles(whisperData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ start: 0, end: 5, text: 'Hello there' });
      expect(result[1]).toEqual({ start: 5, end: 10, text: 'General Kenobi' });
    });

    it('should handle OpenAI chunks format', async () => {
      const { subtitleService } = await import('../src/services/subtitleService.js');
      
      const whisperData = {
        chunks: [
          { text: ' Test chunk', timestamp: { start: 0, end: 2 } },
          { text: ' Another chunk', timestamp: { start: 2, end: 4 } }
        ]
      };

      const result = subtitleService.convertWhisperToSubtitles(whisperData);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Test chunk');
    });
  });

  describe('getYouTubeCaptions', () => {
    it('should return empty array on error', async () => {
      const { subtitleService } = await import('../src/services/subtitleService.js');
      
      axios.post.mockRejectedValue(new Error('Network error'));

      const result = await subtitleService.getYouTubeCaptions('invalid-video-id');

      expect(result).toEqual([]);
    });
  });
});
