import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dispatchToolCall,
  ToolExecutionContext,
  getCachedNightscoutEntries,
  clearToolCache,
} from '../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../src/lib/nightscout/client.js';

describe('Tool Dispatcher Core', () => {
  let mockNsClient: NightscoutClient;
  let context: ToolExecutionContext;

  beforeEach(() => {
    clearToolCache();
    mockNsClient = {
      fetchEntries: vi
        .fn()
        .mockResolvedValue([
          { date: 1727500000000, sgv: 110, direction: 'Flat' },
        ]),
      fetchTreatments: vi.fn().mockResolvedValue([]),
      fetchProfile: vi.fn().mockResolvedValue([]),
    } as unknown as NightscoutClient;

    context = {
      userId: 'user-123',
      preferredUnits: 'mmol/L',
      timezone: 'America/New_York',
      nsClient: mockNsClient,
    };
  });

  it('routes recognized tool call to registered handler', async () => {
    const mockHandler = vi
      .fn()
      .mockResolvedValue({ success: true, result: 'test-data' });
    const handlers = {
      compare_recurring_time_window: mockHandler,
    };

    const result = await dispatchToolCall(
      'compare_recurring_time_window',
      { timeWindow: 'morning' },
      context,
      { handlers },
    );

    expect(mockHandler).toHaveBeenCalledWith(
      { timeWindow: 'morning' },
      context,
    );
    expect(result).toEqual({ success: true, result: 'test-data' });
  });

  it('throws an error for unknown tool names', async () => {
    await expect(
      dispatchToolCall('non_existent_tool', {}, context),
    ).rejects.toThrow(/Unknown tool: non_existent_tool/);
  });

  it('triggers circuit breaker when handler exceeds timeout threshold', async () => {
    const hangingHandler = () =>
      new Promise((resolve) => setTimeout(() => resolve({ done: true }), 100));

    await expect(
      dispatchToolCall('compare_recurring_time_window', {}, context, {
        handlers: { compare_recurring_time_window: hangingHandler },
        timeoutMs: 20, // Low timeout to verify circuit breaker
      }),
    ).rejects.toThrow(/timed out after 20ms/);
  });

  it('caches Nightscout entries within TTL to prevent duplicate network calls', async () => {
    const from = new Date('2026-09-20T00:00:00Z');
    const to = new Date('2026-09-27T00:00:00Z');

    const firstResult = await getCachedNightscoutEntries(context, from, to);
    expect(mockNsClient.fetchEntries).toHaveBeenCalledTimes(1);

    const secondResult = await getCachedNightscoutEntries(context, from, to);
    expect(mockNsClient.fetchEntries).toHaveBeenCalledTimes(1); // Cached!
    expect(secondResult).toEqual(firstResult);
  });
});
