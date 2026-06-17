import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateChatResponse,
  synthesizeChatInsight,
} from '../../../src/lib/ai/gemini';
import {
  GlucoseUnit,
  InsightPriority,
  type GlycemicCluster,
  type Insight,
} from '@goodnumbers/types';

// Hoist mock setup
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

// Mock prompt templates
vi.mock('../../../src/lib/ai/prompts', () => ({
  CLUSTER_AI_CHAT_PROMPT: vi.fn(() => 'mock-chat-prompt'),
  CLUSTER_AI_SYNTHESIS_PROMPT: vi.fn(() => 'mock-synthesis-prompt'),
  CLUSTER_AI_INSIGHT_PROMPT: vi.fn(() => 'mock-insight-prompt'),
  EXECUTIVE_SUMMARY_PROMPT: vi.fn(() => 'mock-executive-prompt'),
}));

// Mock Generative AI SDK
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
  SchemaType: {
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
  },
}));

describe('Gemini AI Chat and Synthesis Services', () => {
  const mockCluster: GlycemicCluster = {
    id: 'cluster-1',
    type: 'hyper',
    eventCount: 3,
    avgStartMinute: 600,
    events: [],
    meanTimeMinutes: 600,
    journalId: 'journal-1',
  };

  const mockInsights: Insight[] = [
    { note: 'Test insight', priority: InsightPriority.IMPORTANT },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  describe('generateChatResponse', () => {
    it('returns standard chat reply from the model', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'This is a mocked chat response.',
        },
      });

      const result = await generateChatResponse(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        { vibe: 'Sprouting', factors: 'Stress' },
        [],
        'Hello coach',
      );

      expect(result).toBe('This is a mocked chat response.');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('returns an offline warning message if the API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const result = await generateChatResponse(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        { vibe: 'Sprouting', factors: 'Stress' },
        [],
        'Hello coach',
      );

      expect(result).toContain('offline');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('returns a standard error fallback if the generation call fails', async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new Error('API rate limit exceeded'),
      );

      const result = await generateChatResponse(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        { vibe: 'Sprouting', factors: 'Stress' },
        [],
        'Hello coach',
      );

      expect(result).toContain('error');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('synthesizeChatInsight', () => {
    it('returns synthesized POV insight from the model', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            '> "I realized I spiked after lunch."\n* **Resolution:** Bolus earlier.',
        },
      });

      const result = await synthesizeChatInsight(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        [
          { role: 'user', content: 'Lunch makes me spike' },
          { role: 'model', content: 'Have you tried bolusing earlier?' },
        ],
      );

      expect(result).toContain('> "I realized I spiked after lunch."');
      expect(result).toContain('* **Resolution:** Bolus earlier.');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('returns a warning message if the API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const result = await synthesizeChatInsight(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        [],
      );

      expect(result).toContain('unavailable');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('returns a fallback message if the generation call fails', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Syntax Error'));

      const result = await synthesizeChatInsight(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        [],
      );

      expect(result).toContain('unable to synthesize');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });
});
