import { describe, it, expect, vi } from 'vitest';
import { handleCompareTimeWindow } from '../../../../../src/lib/ai/tools/handlers/compareTimeWindow.js';
import { ToolExecutionContext } from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import { NightscoutEntry } from '../../../../../src/lib/nightscout/types.js';

describe('Tool 1: compare_recurring_time_window', () => {
  const timezone = 'America/New_York';

  function createEntry(isoString: string, sgvMgdl: number): NightscoutEntry {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `entry-${dt.toMillis()}`,
      date: dt.toMillis(),
      sgv: sgvMgdl,
      direction: 'Flat',
    } as unknown as NightscoutEntry;
  }

  it('slices readings for morning window (06:00-10:00) in local timezone and converts to mmol/L', async () => {
    // 2 days of mock data: 2026-09-28 (Mon) and 2026-09-29 (Tue)
    const mockEntries = [
      // Monday inside morning (07:00 and 08:30)
      createEntry('2026-09-28T07:00:00', 120), // 6.7 mmol/L
      createEntry('2026-09-28T08:30:00', 130), // 7.2 mmol/L
      // Monday outside morning (13:00)
      createEntry('2026-09-28T13:00:00', 180),
      // Tuesday inside morning (06:30 and 09:00)
      createEntry('2026-09-29T06:30:00', 200), // 11.1 mmol/L
      createEntry('2026-09-29T09:00:00', 220), // 12.2 mmol/L
    ];

    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue(mockEntries),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleCompareTimeWindow(
      { timeWindow: 'morning', days: 7 },
      context,
    );

    expect(result.window).toContain('morning');
    expect(result.daysEvaluated).toBe(2);
    expect(result.dailyBreakdown).toHaveLength(2);

    const mon = result.dailyBreakdown[0];
    expect(mon.date).toContain('2026-09-28');
    expect(mon.mean).toBe(6.9); // (120+130)/2 = 125 / 18.0182 = 6.9 mmol/L
    expect(mon.min).toBe(6.7);
    expect(mon.max).toBe(7.2);
    expect(mon.tir).toBe(100);

    const tue = result.dailyBreakdown[1];
    expect(tue.date).toContain('2026-09-29');
    expect(tue.mean).toBe(11.7); // 210 / 18.0182 = 11.7 mmol/L
    expect(tue.tir).toBe(0);
  });

  it('preserves mg/dL when preferredUnits is mg/dL', async () => {
    const mockEntries = [
      createEntry('2026-09-28T07:00:00', 120),
      createEntry('2026-09-28T08:30:00', 130),
    ];

    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue(mockEntries),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mg/dL',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleCompareTimeWindow(
      { timeWindow: 'morning' },
      context,
    );
    expect(result.dailyBreakdown[0].mean).toBe(125);
    expect(result.dailyBreakdown[0].min).toBe(120);
    expect(result.dailyBreakdown[0].max).toBe(130);
  });

  it('handles empty data gracefully when no readings match the window', async () => {
    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue([]),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleCompareTimeWindow(
      { timeWindow: 'afternoon' },
      context,
    );
    expect(result.daysEvaluated).toBe(0);
    expect(result.dailyBreakdown).toEqual([]);
    expect(result.consistency).toContain('No readings found');
  });
});
