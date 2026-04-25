import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateClusterAIInsight,
  generateExecutiveSummary,
  type TreatmentContext,
} from '../../../src/lib/ai/gemini';
import {
  GlucoseUnit,
  InsightPriority,
  type GlycemicCluster,
  type Insight,
} from '@goodnumbers/types';

// Use vi.hoisted to ensure the mock is available before vi.mock executes
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

// Mock the prompt templates to avoid dependency on their complex logic
vi.mock('../../../src/lib/ai/prompts', () => ({
  CLUSTER_AI_INSIGHT_PROMPT: vi.fn(() => 'mock-cluster-prompt'),
  EXECUTIVE_SUMMARY_PROMPT: vi.fn(() => 'mock-executive-prompt'),
}));

// Mock the Google Generative AI SDK
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

describe('Gemini AI Service', () => {
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
  const mockTreatments: TreatmentContext[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  describe('generateClusterAIInsight', () => {
    it('returns a successful assessment from the Pro model', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              assessment: 'Pro model assessment.',
              quick_log_suggestions: ['Hint 1', 'Hint 2'],
            }),
        },
      });

      const result = await generateClusterAIInsight(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        mockTreatments,
        'UTC',
        'Sprouting',
        ['Diet:FatProtein'],
      );

      expect(result.assessment).toBe('Pro model assessment.');
      expect(result.quickLogSuggestions).toEqual(['Hint 1', 'Hint 2']);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('falls back to the Flash model if the Pro model fails', async () => {
      // First call (Pro) fails, second call (Flash fallback) succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Pro model overloaded'))
        .mockResolvedValueOnce({
          response: {
            text: () =>
              JSON.stringify({
                assessment: 'Flash model assessment.',
                quick_log_suggestions: ['Flash Hint'],
              }),
          },
        });

      const result = await generateClusterAIInsight(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        mockTreatments,
        'UTC',
        null,
        [],
      );

      expect(result.assessment).toContain('Flash model assessment.');
      expect(result.assessment).toContain('fallback model');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('returns a default result if both models fail', async () => {
      mockGenerateContent.mockRejectedValue(new Error('All models down'));

      const result = await generateClusterAIInsight(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        mockTreatments,
        'UTC',
        null,
        [],
      );

      expect(result.assessment).toBe('AI assessment unavailable.');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('returns a specific message if the API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      // Re-import or re-initialize if needed, but since it's checked per-call:
      const result = await generateClusterAIInsight(
        mockCluster,
        mockInsights,
        GlucoseUnit.MGDL,
        mockTreatments,
        'UTC',
        null,
        [],
      );
      expect(result.assessment).toContain('API Key missing');
    });
  });

  describe('generateExecutiveSummary', () => {
    it('generates an executive summary using the Flash model', async () => {
      const mockHighlights = [
        {
          type: 'win',
          icon: '✅',
          title: 'Good Job',
          short_description: 'TIR is up.',
        },
      ];
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(mockHighlights),
        },
      });

      const result = await generateExecutiveSummary(
        { avgGlucose: 120, timeInRange: 80, stability: 90, lowPercentage: 1 },
        null,
        GlucoseUnit.MGDL,
      );

      expect(result).toEqual(mockHighlights);
    });

    it('returns an empty array if generation fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Flash failed'));
      const result = await generateExecutiveSummary(
        { avgGlucose: 120, timeInRange: 80, stability: 90, lowPercentage: 1 },
        null,
        GlucoseUnit.MGDL,
      );
      expect(result).toEqual([]);
    });
  });
});
