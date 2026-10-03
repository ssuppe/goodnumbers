import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const { modelSpies, mockGetGenerativeModel } = vi.hoisted(() => {
  const modelSpies: Record<
    string,
    {
      generateContent: ReturnType<typeof vi.fn>;
      sendMessage: ReturnType<typeof vi.fn>;
    }
  > = {};

  const mockGetGenerativeModel = vi.fn((opts: { model: string }) => {
    if (!modelSpies[opts.model]) {
      modelSpies[opts.model] = {
        generateContent: vi.fn(),
        sendMessage: vi.fn(),
      };
    }
    const spy = modelSpies[opts.model];
    return {
      generateContent: spy.generateContent,
      startChat: vi.fn(() => ({
        sendMessage: spy.sendMessage,
      })),
    };
  });

  return { modelSpies, mockGetGenerativeModel };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
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

vi.mock('../../../src/lib/ai/prompts', () => ({
  CLUSTER_AI_CHAT_PROMPT: vi.fn(() => 'mock-chat-prompt'),
  CLUSTER_AI_SYNTHESIS_PROMPT: vi.fn(() => 'mock-synthesis-prompt'),
  CLUSTER_AI_INSIGHT_PROMPT: vi.fn(() => 'mock-insight-prompt'),
  EXECUTIVE_SUMMARY_PROMPT: vi.fn(() => 'mock-executive-prompt'),
  QUICK_COACH_STORY_PROMPT: vi.fn(() => 'mock-story-prompt'),
  JOURNAL_TITLE_PROMPT: vi.fn(() => 'mock-title-prompt'),
}));

import {
  GEMINI_REASONING_MODEL,
  GEMINI_FLASH_MODEL,
  generateQuickCoachStory,
  generateChatResponse,
  synthesizeChatInsight,
  generateExecutiveSummary,
} from '../../../src/lib/ai/gemini.js';
import { GlucoseUnit, type GlycemicCluster } from '@goodnumbers/types';
import { ToolExecutionContext } from '../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../src/lib/nightscout/client.js';

describe('Gemini Model Architecture & Configuration', () => {
  const mockCluster: GlycemicCluster = {
    id: 'cluster-1',
    type: 'hyper',
    eventCount: 3,
    avgStartMinute: 600,
    events: [],
    meanTimeMinutes: 600,
    journalId: 'journal-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('exports standard reasoning and flash model constants', () => {
    expect(GEMINI_REASONING_MODEL).toBe('gemini-3.1-pro-preview');
    expect(GEMINI_FLASH_MODEL).toBe('gemini-3.8-flash');
  });

  it('powers generateQuickCoachStory with the reasoning model', async () => {
    modelSpies[GEMINI_REASONING_MODEL].generateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            audio_script: 'Hello from Pro reasoning',
            animation_cues: [{ time_ms: 0, action: 'DRAW_MEAN' }],
          }),
      },
    });

    await generateQuickCoachStory(
      mockCluster,
      [],
      GlucoseUnit.MMOL,
      'UTC',
      'Sprouting',
      ['Work stress'],
    );

    expect(
      modelSpies[GEMINI_REASONING_MODEL].generateContent,
    ).toHaveBeenCalled();
  });

  it('powers Quick Coach conversational tool loop with the reasoning model', async () => {
    modelSpies[GEMINI_REASONING_MODEL].sendMessage.mockResolvedValueOnce({
      response: {
        functionCalls: () => null,
        text: () => 'Pro coach advice',
      },
    });

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone: 'UTC',
      nsClient: {} as NightscoutClient,
    };

    await generateChatResponse(
      mockCluster,
      [],
      GlucoseUnit.MMOL,
      { vibe: 'Sprouting', factors: 'None' },
      [],
      'How do I improve this?',
      context,
    );

    const chatModelCalls = mockGetGenerativeModel.mock.calls.filter(
      (call) =>
        call[0].model === GEMINI_REASONING_MODEL &&
        Array.isArray(call[0].tools),
    );
    expect(chatModelCalls.length).toBeGreaterThanOrEqual(1);
    expect(modelSpies[GEMINI_REASONING_MODEL].sendMessage).toHaveBeenCalled();
  });

  it('powers synthesizeChatInsight with the reasoning model', async () => {
    modelSpies[GEMINI_REASONING_MODEL].generateContent.mockResolvedValueOnce({
      response: {
        text: () => 'Synthesized habit recommendation.',
      },
    });

    await synthesizeChatInsight(mockCluster, [], GlucoseUnit.MMOL, [
      { role: 'user', content: 'I walk after lunch' },
      { role: 'model', content: 'Great choice' },
    ]);

    expect(
      modelSpies[GEMINI_REASONING_MODEL].generateContent,
    ).toHaveBeenCalled();
  });

  it('powers generateExecutiveSummary with the flash model', async () => {
    modelSpies[GEMINI_FLASH_MODEL].generateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify([
            {
              type: 'highlight',
              icon: 'star',
              title: 'Good job',
              short_description: 'Summary',
            },
          ]),
      },
    });

    await generateExecutiveSummary({
      timeInRange: 75,
      timeBelowRange: 2,
      timeAboveRange: 23,
      meanGlucose: 6.5,
      gmi: 6.1,
      totalTreatments: 10,
    });

    expect(modelSpies[GEMINI_FLASH_MODEL].generateContent).toHaveBeenCalled();
  });
});
