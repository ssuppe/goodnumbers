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
  SchemaType: {
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
  },
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
              reflection_for_doctor: 'Pro reflection.',
              quick_log_suggestions: ['Hint 1', 'Hint 2'],
              initial_prompt:
                'How do you think you can improve this in the future?',
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
      expect(result.reflectionForDoctor).toBe('Pro reflection.');
      expect(result.quickLogSuggestions).toEqual(['Hint 1', 'Hint 2']);
      expect(result.initialPrompt).toBe(
        'How do you think you can improve this in the future?',
      );
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
                reflection_for_doctor: 'Flash reflection.',
                quick_log_suggestions: ['Flash Hint'],
                initial_prompt: 'Flash initial question?',
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
      expect(result.reflectionForDoctor).toBe('Flash reflection.');
      expect(result.initialPrompt).toBe('Flash initial question?');
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

    it('passes patterns to the prompt generator', async () => {
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
        ['Largest positive variance: Afternoon (11:00 AM - 5:00 PM)'],
      );

      expect(result).toEqual(mockHighlights);
    });

    it('enforces the clinical hypo rule override by swapping the hypo card to first position if lowPercentage > 4', async () => {
      const mockHighlights = [
        {
          type: 'win',
          icon: '🎉',
          title: 'Averages Look Good',
          short_description: 'Celebrate your nice average blood sugar.',
        },
        {
          type: 'opportunity',
          icon: '⚠️',
          title: 'Low Blood Sugar Opportunity',
          short_description: 'You had a few lows this week.',
        },
      ];
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(mockHighlights),
        },
      });

      const result = await generateExecutiveSummary(
        { avgGlucose: 120, timeInRange: 80, stability: 90, lowPercentage: 5 },
        null,
        GlucoseUnit.MGDL,
      );

      expect(result[0].type).toBe('opportunity');
      expect(result[0].title).toBe('Low Blood Sugar Opportunity');
      expect(result[1].type).toBe('win');
    });

    it('enforces the clinical hypo rule override by creating a new hypo card if lowPercentage > 4 and none exists', async () => {
      const mockHighlights = [
        {
          type: 'win',
          icon: '🎉',
          title: 'Averages Look Good',
          short_description: 'Celebrate your nice average blood sugar.',
        },
      ];
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(mockHighlights),
        },
      });

      const result = await generateExecutiveSummary(
        { avgGlucose: 120, timeInRange: 80, stability: 90, lowPercentage: 5 },
        null,
        GlucoseUnit.MGDL,
      );

      expect(result[0].type).toBe('opportunity');
      expect(result[0].title).toBe('Lows Focus Opportunity');
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
