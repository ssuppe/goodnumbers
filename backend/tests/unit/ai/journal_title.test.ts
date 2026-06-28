import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateJournalTitle } from '../../../src/lib/ai/gemini';
import { GlucoseUnit } from '@goodnumbers/types';

// Use vi.hoisted to ensure the mock is available before vi.mock executes
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

// Mock the prompt templates
vi.mock('../../../src/lib/ai/prompts', () => ({
  JOURNAL_TITLE_PROMPT: vi.fn(() => 'mock-title-prompt'),
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

describe('generateJournalTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  it('returns a title and description from the Flash model', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            title: 'Late-Night Highs & Dawn Drift',
            description: 'Consistent blood sugar spikes after 8 PM dinners, likely driven by high-fat meals.',
          }),
      },
    });

    const result = await generateJournalTitle({
      scoreCardData: { avgGlucose: 150, stability: 35, timeInRange: 70, timeInTightRange: 45, timeBelowRange: 2 },
      executiveSummary: [{ type: 'win', icon: '✅', title: 'Good TIR', short_description: 'TIR is 70%.' }],
      clusters: [
        { eventType: 'hyper', eventCount: 3, meanTimeMinutes: 1200, userNotes: 'Late dinner.' },
      ],
      weeklyVibe: 'Sprouting',
      influencingFactors: ['Diet:FatProtein'],
      preferredUnits: GlucoseUnit.MGDL,
    });

    expect(result.title).toBe('Late-Night Highs & Dawn Drift');
    expect(result.description).toBe('Consistent blood sugar spikes after 8 PM dinners, likely driven by high-fat meals.');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('returns default values when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await generateJournalTitle({
      scoreCardData: null,
      executiveSummary: null,
      clusters: [],
      weeklyVibe: null,
      influencingFactors: null,
      preferredUnits: GlucoseUnit.MGDL,
    });

    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns null values when AI generation fails', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API error'));

    const result = await generateJournalTitle({
      scoreCardData: { avgGlucose: 150, stability: 35, timeInRange: 70, timeInTightRange: 45, timeBelowRange: 2 },
      executiveSummary: null,
      clusters: [],
      weeklyVibe: null,
      influencingFactors: null,
      preferredUnits: GlucoseUnit.MGDL,
    });

    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
  });

  it('returns null values when AI returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => 'not valid json at all',
      },
    });

    const result = await generateJournalTitle({
      scoreCardData: null,
      executiveSummary: null,
      clusters: [],
      weeklyVibe: null,
      influencingFactors: null,
      preferredUnits: GlucoseUnit.MGDL,
    });

    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
  });
});
