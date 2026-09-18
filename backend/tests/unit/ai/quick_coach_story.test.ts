import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QUICK_COACH_STORY_PROMPT } from '../../../src/lib/ai/prompts.js';
import { generateQuickCoachStory } from '../../../src/lib/ai/gemini.js';
import { GlucoseUnit, GlycemicCluster } from '@goodnumbers/types';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

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

describe('Quick Coach Story Prompt & Generator', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    vi.clearAllMocks();
  });

  const mockCluster: GlycemicCluster = {
    id: 'cluster-post-lunch',
    type: 'hyper',
    avgStartMinute: 13 * 60 + 30, // 1:30 PM
    avgDurationMinutes: 120,
    eventCount: 3,
    activeDays: [1, 3, 5],
    events: [
      {
        id: 'ev-1',
        type: 'hyper',
        startTime: '2026-09-14T13:30:00Z',
        endTime: '2026-09-14T15:30:00Z',
        startMinuteOfDay: 810,
        durationMinutes: 120,
        readings: [
          { timestamp: '2026-09-14T13:30:00Z', value: 160 },
          { timestamp: '2026-09-14T14:30:00Z', value: 230 },
        ],
      },
    ],
  };

  it('QUICK_COACH_STORY_PROMPT should compile prompt string with cluster context', () => {
    const prompt = QUICK_COACH_STORY_PROMPT(
      mockCluster,
      [],
      GlucoseUnit.MGDL,
      'America/New_York',
      'neutral',
      ['Work Stress'],
    );

    expect(prompt).toContain('High Blood Sugar');
    expect(prompt).toContain('13:30');
    expect(prompt).toContain('audio_script');
    expect(prompt).toContain('animation_cues');
    expect(prompt).toContain('DRAW_MEAN');
  });

  it('generateQuickCoachStory should call Gemini and return parsed QuickCoachStory payload', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            audio_script:
              "Let's look at your post-lunch patterns. We noticed repeating highs around 1:30 PM.",
            animation_cues: [
              { time_ms: 0, action: 'DRAW_MEAN', label: 'Mean Trend' },
              {
                time_ms: 4000,
                action: 'DRAW_DAY',
                day_index: 0,
                label: 'Monday',
              },
              {
                time_ms: 8000,
                action: 'DRAW_TREATMENTS',
                day_index: 0,
                label: 'Bolus',
              },
            ],
          }),
      },
    });

    const story = await generateQuickCoachStory(
      mockCluster,
      [],
      GlucoseUnit.MGDL,
      'America/New_York',
      'neutral',
      ['Work Stress'],
    );

    expect(story).toBeDefined();
    expect(story.audio_script).toContain('post-lunch');
    expect(story.animation_cues).toHaveLength(3);
    expect(story.animation_cues[0].action).toBe('DRAW_MEAN');
    expect(story.animation_cues[1].action).toBe('DRAW_DAY');
  });

  it('generateQuickCoachStory should return default fallback if API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const story = await generateQuickCoachStory(
      mockCluster,
      [],
      GlucoseUnit.MGDL,
      'America/New_York',
    );

    expect(story).toBeDefined();
    expect(story.animation_cues.length).toBeGreaterThan(0);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
