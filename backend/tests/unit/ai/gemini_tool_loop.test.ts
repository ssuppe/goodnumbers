import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateChatResponse } from '../../../src/lib/ai/gemini.js';
import { ToolExecutionContext } from '../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../src/lib/nightscout/client.js';
import {
  GlucoseUnit,
  type GlycemicCluster,
  type Insight,
} from '@goodnumbers/types';

// Mock dispatchToolCall
const { mockDispatchToolCall } = vi.hoisted(() => ({
  mockDispatchToolCall: vi.fn(),
}));

vi.mock('../../../src/lib/ai/tools/dispatcher.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../src/lib/ai/tools/dispatcher.js')
    >();
  return {
    ...actual,
    dispatchToolCall: mockDispatchToolCall,
  };
});

// Mock Generative AI SDK
const { mockSendMessage, mockStartChat, mockGetGenerativeModel } = vi.hoisted(
  () => {
    const mockSendMessage = vi.fn();
    const mockStartChat = vi.fn(() => ({
      sendMessage: mockSendMessage,
    }));
    const mockGetGenerativeModel = vi.fn(() => ({
      startChat: mockStartChat,
      generateContent: vi.fn(),
    }));
    return { mockSendMessage, mockStartChat, mockGetGenerativeModel };
  },
);

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

describe('generateChatResponse with Tool Calling Loop', () => {
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
  const weeklyContext = { vibe: 'Steady', factors: 'Sleep' };

  let context: ToolExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';

    context = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone: 'America/New_York',
      nsClient: {} as NightscoutClient,
    };
  });

  it('executes function call returned by model and feeds response back into chat', async () => {
    // Turn 1: Model requests compare_recurring_time_window
    mockSendMessage.mockResolvedValueOnce({
      response: {
        functionCalls: () => [
          {
            name: 'compare_recurring_time_window',
            args: { timeWindow: 'morning', days: 7 },
          },
        ],
        text: () => '',
      },
    });

    mockDispatchToolCall.mockResolvedValueOnce({
      window: 'morning (06:00-10:00)',
      daysEvaluated: 5,
      consistency: 'Pattern occurs primarily on weekdays',
    });

    // Turn 2: Model gives final conversational answer
    mockSendMessage.mockResolvedValueOnce({
      response: {
        functionCalls: () => undefined,
        text: () =>
          'On earlier mornings this week, your blood sugar was steady around 6.5.',
      },
    });

    const reply = await generateChatResponse(
      mockCluster,
      mockInsights,
      GlucoseUnit.MMOL,
      weeklyContext,
      [],
      'How did my mornings look this week?',
      context,
    );

    expect(mockStartChat).toHaveBeenCalled();
    expect(mockDispatchToolCall).toHaveBeenCalledWith(
      'compare_recurring_time_window',
      { timeWindow: 'morning', days: 7 },
      context,
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(reply).toBe(
      'On earlier mornings this week, your blood sugar was steady around 6.5.',
    );
  });

  it('stops tool loop if max iterations (3) is exceeded', async () => {
    // Repeatedly return a function call
    mockSendMessage.mockResolvedValue({
      response: {
        functionCalls: () => [
          { name: 'search_treatment_notes', args: { query: 'loop' } },
        ],
        text: () => 'Looping reply...',
      },
    });

    mockDispatchToolCall.mockResolvedValue({ matchesCount: 0 });

    const reply = await generateChatResponse(
      mockCluster,
      mockInsights,
      GlucoseUnit.MMOL,
      weeklyContext,
      [],
      'Check something repeatedly',
      context,
    );

    // Initial message + 3 iterations = 4 total sendMessage calls
    expect(mockSendMessage).toHaveBeenCalledTimes(4);
    expect(reply).toBe('Looping reply...');
  });

  it('catches tool dispatch errors and passes error payload back to Gemini', async () => {
    mockSendMessage.mockResolvedValueOnce({
      response: {
        functionCalls: () => [
          {
            name: 'compare_recurring_time_window',
            args: { timeWindow: 'morning' },
          },
        ],
        text: () => '',
      },
    });

    mockDispatchToolCall.mockRejectedValueOnce(
      new Error('Nightscout unreachable'),
    );

    mockSendMessage.mockResolvedValueOnce({
      response: {
        functionCalls: () => undefined,
        text: () => 'I could not access your past data right now.',
      },
    });

    const reply = await generateChatResponse(
      mockCluster,
      mockInsights,
      GlucoseUnit.MMOL,
      weeklyContext,
      [],
      'Check morning',
      context,
    );

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(reply).toBe('I could not access your past data right now.');
  });
});
