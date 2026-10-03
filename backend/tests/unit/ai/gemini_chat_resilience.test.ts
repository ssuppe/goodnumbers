import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateChatResponse,
  GEMINI_REASONING_MODEL,
  GEMINI_FLASH_MODEL,
} from '../../../src/lib/ai/gemini.js';
import { ToolExecutionContext } from '../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../src/lib/nightscout/client.js';
import {
  GlucoseUnit,
  type GlycemicCluster,
  type Insight,
} from '@goodnumbers/types';

// Hoist mocks
const { modelChatMocks, mockGetGenerativeModel } = vi.hoisted(() => {
  const modelChatMocks: Record<
    string,
    {
      sendMessage: ReturnType<typeof vi.fn>;
      startChat: ReturnType<typeof vi.fn>;
      generateContent: ReturnType<typeof vi.fn>;
    }
  > = {};

  const mockGetGenerativeModel = vi.fn((opts: { model: string }) => {
    if (!modelChatMocks[opts.model]) {
      const sendMessage = vi.fn();
      const generateContent = vi.fn();
      const startChat = vi.fn(() => ({
        sendMessage,
      }));
      modelChatMocks[opts.model] = {
        sendMessage,
        startChat,
        generateContent,
      };
    }
    const m = modelChatMocks[opts.model];
    return {
      generateContent: m.generateContent,
      startChat: m.startChat,
    };
  });

  return { modelChatMocks, mockGetGenerativeModel };
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

describe('Gemini Chat Resilience & Fallback Circuit Breaker', () => {
  const mockCluster: GlycemicCluster = {
    id: 'cluster-1',
    type: 'hyper',
    eventCount: 3,
    avgStartMinute: 600,
    events: [],
    meanTimeMinutes: 600,
    journalId: 'journal-1',
  };

  const mockInsights: Insight[] = [];
  const weeklyContext = { vibe: 'Steady', factors: 'None' };
  let context: ToolExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';

    context = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone: 'UTC',
      nsClient: {} as NightscoutClient,
    };
  });

  it('falls back to flash model when reasoning model encounters a 503 / rate limit in tool loop', async () => {
    // Reasoning model fails
    modelChatMocks[GEMINI_REASONING_MODEL].sendMessage.mockRejectedValueOnce(
      new Error('503 Service Unavailable'),
    );

    // Flash model succeeds
    modelChatMocks[GEMINI_FLASH_MODEL].sendMessage.mockResolvedValueOnce({
      response: {
        functionCalls: () => null,
        text: () => 'Flash fallback response: Try a 10 minute walk.',
      },
    });

    const reply = await generateChatResponse(
      mockCluster,
      mockInsights,
      GlucoseUnit.MMOL,
      weeklyContext,
      [],
      'What should I do?',
      context,
    );

    expect(reply).toBe('Flash fallback response: Try a 10 minute walk.');
    expect(
      modelChatMocks[GEMINI_REASONING_MODEL].sendMessage,
    ).toHaveBeenCalled();
    expect(modelChatMocks[GEMINI_FLASH_MODEL].sendMessage).toHaveBeenCalled();
  });
});
