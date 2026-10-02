import { describe, it, expect, vi } from 'vitest';
import { handleDayOfWeekPattern } from '../../../../../src/lib/ai/tools/handlers/dayOfWeekPattern.js';
import { ToolExecutionContext } from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import { NightscoutEntry } from '../../../../../src/lib/nightscout/types.js';

describe('Tool 5: check_day_of_week_pattern', () => {
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

  it('compares weekday vs weekend glycemic metrics (TIR, mean, CV)', async () => {
    // Monday (weekday): 110, 120, 130 -> mean 120 mg/dL (6.7 mmol/L), TIR 100%
    const weekdayEntries = [
      createEntry('2026-09-28T09:00:00', 110),
      createEntry('2026-09-28T12:00:00', 120),
      createEntry('2026-09-28T18:00:00', 130),
    ];

    // Saturday (weekend): 80, 200, 220 -> mean 166.7 mg/dL (9.3 mmol/L), TIR 33%
    const weekendEntries = [
      createEntry('2026-09-26T09:00:00', 80),
      createEntry('2026-09-26T12:00:00', 200),
      createEntry('2026-09-26T18:00:00', 220),
    ];

    const mockNsClient = {
      fetchEntries: vi
        .fn()
        .mockResolvedValue([...weekdayEntries, ...weekendEntries]),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleDayOfWeekPattern(
      { comparisonType: 'weekday_vs_weekend', lookbackWeeks: 2 },
      context,
    );

    expect(result.comparison).toBe('weekday_vs_weekend');
    expect(result.weekday).toBeDefined();
    expect(result.weekday.tir).toBe(100);
    expect(result.weekday.mean).toBe(6.7);
    expect(typeof result.weekday.cv).toBe('number');

    expect(result.weekend).toBeDefined();
    expect(result.weekend.tir).toBe(33);
    expect(result.weekend.mean).toBe(9.2);
    expect(result.keyObservation).toBeDefined();
  });

  it('aggregates metrics for a specific day of the week', async () => {
    // Two Mondays
    const mondayEntries = [
      createEntry('2026-09-21T10:00:00', 120),
      createEntry('2026-09-28T10:00:00', 140),
    ];

    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue(mondayEntries),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mg/dL',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleDayOfWeekPattern(
      { comparisonType: 'specific_day', specificDay: 'Monday' },
      context,
    );

    expect(result.comparison).toBe('specific_day');
    expect(result.day).toBe('Monday');
    expect(result.metrics.mean).toBe(130);
    expect(result.metrics.tir).toBe(100);
  });
});
