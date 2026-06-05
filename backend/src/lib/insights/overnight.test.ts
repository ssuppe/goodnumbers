import { describe, it, expect } from 'vitest';
import { createOvernightInsight } from './overnight.js';
import { GlucoseEntry, GlucoseUnit } from '@goodnumbers/types';
import { DateTime } from 'luxon';

describe('Overnight Glucose Control Insight', () => {
  const timezone = 'Europe/London';

  // Helper to create a date in London time and return UTC millis
  const createDate = (hour: number, minute: number, day = 15, month = 5) => {
    // Luxon fromObject is strict. We must ensure minute is 0-59.
    const normalizedHour = hour + Math.floor(minute / 60);
    const normalizedMinute = minute % 60;
    return DateTime.fromObject(
      {
        year: 2024,
        month,
        day,
        hour: normalizedHour,
        minute: normalizedMinute,
      },
      { zone: timezone },
    ).toMillis();
  };

  it('should only process entries between 23:00 and 06:59 local time', () => {
    const validEntries: GlucoseEntry[] = [];
    for (let i = 0; i < 20; i++) {
      validEntries.push({
        sgv: 90,
        date: createDate(1, i * 5),
        dateString: '',
      });
    }
    // Add one outside
    validEntries.push({ sgv: 200, date: createDate(10, 0), dateString: '' });

    const insight = createOvernightInsight(
      validEntries,
      timezone,
      GlucoseUnit.MGDL,
    )?.generate();
    expect(insight).not.toBeNull();
    // If it included the 200, it wouldn't be Mastery (Tier 1)
    expect(insight?.note).toContain('Mastery Achieved');
  });

  it('should handle exact boundary hours (22:59 vs 23:00 and 06:59 vs 07:00)', () => {
    const entries: GlucoseEntry[] = [
      { sgv: 200, date: createDate(22, 59), dateString: '' }, // Out
      { sgv: 90, date: createDate(23, 0), dateString: '' }, // In
      { sgv: 90, date: createDate(6, 59), dateString: '' }, // In
      { sgv: 200, date: createDate(7, 0), dateString: '' }, // Out
    ];
    // Add padding to reach 12
    for (let i = 0; i < 10; i++)
      entries.push({ sgv: 90, date: createDate(1, i), dateString: '' });

    const insight = createOvernightInsight(
      entries,
      timezone,
      GlucoseUnit.MGDL,
    )?.generate();
    expect(insight?.note).toContain('Mastery Achieved');
    expect(insight?.note).toContain('100%');
  });

  it('should return null if there are fewer than 12 readings in the overnight window', () => {
    const entries: GlucoseEntry[] = [];
    for (let i = 0; i < 11; i++) {
      entries.push({ sgv: 90, date: createDate(1, i * 5), dateString: '' });
    }
    const generator = createOvernightInsight(
      entries,
      timezone,
      GlucoseUnit.MGDL,
    );
    expect(generator).toBeNull();
  });

  it('Tier 1 Mastery: Exact 70% boundary and Glucose boundaries (81, 99)', () => {
    const entries: GlucoseEntry[] = [];
    // 70 entries at 81 (inclusive)
    for (let i = 0; i < 70; i++)
      entries.push({ sgv: 81, date: createDate(1, i), dateString: '' });
    // 30 entries at 120 (out)
    for (let i = 0; i < 30; i++)
      entries.push({ sgv: 120, date: createDate(2, i), dateString: '' });

    const insight = createOvernightInsight(
      entries,
      timezone,
      GlucoseUnit.MGDL,
    )?.generate();
    expect(insight?.note).toContain('Mastery Achieved');
    expect(insight?.note).toContain('70%');
  });

  it('Tier 1 Mastery: 69% fallback to Tier 2', () => {
    const entries: GlucoseEntry[] = [];
    // 69 entries in range
    for (let i = 0; i < 69; i++)
      entries.push({ sgv: 90, date: createDate(1, i), dateString: '' });
    // 31 entries in tight range but not normal
    for (let i = 0; i < 31; i++)
      entries.push({ sgv: 120, date: createDate(2, i), dateString: '' });

    const insight = createOvernightInsight(
      entries,
      timezone,
      GlucoseUnit.MGDL,
    )?.generate();
    expect(insight?.note).toContain('Tight Range Success');
    // Tight % = 100%
    expect(insight?.note).toContain('100% Tight');
  });

  it('Glucose boundaries: Inclusive check (140, 180)', () => {
    const entries: GlucoseEntry[] = [];
    for (let i = 0; i < 10; i++)
      entries.push({ sgv: 140, date: createDate(1, i), dateString: '' }); // Counts as Tight
    for (let i = 0; i < 10; i++)
      entries.push({ sgv: 180, date: createDate(2, i), dateString: '' }); // Counts as Standard

    const insight = createOvernightInsight(
      entries,
      timezone,
      GlucoseUnit.MGDL,
    )?.generate();
    // 20 total. 10 Tight (50%), 20 Standard (100%).
    // Standard >= 70% -> Building Stability
    expect(insight?.note).toContain('Building Stability');
    expect(insight?.note).toContain('100% Standard');
    expect(insight?.note).toContain('50% Tight');
  });

  it('should handle Daylight Savings Time transition (Spring Forward)', () => {
    // London Spring Forward 2024: March 31, 1:00 AM -> 2:00 AM
    const tz = 'Europe/London';
    const entries: GlucoseEntry[] = [
      {
        sgv: 90,
        date: DateTime.fromObject(
          { year: 2024, month: 3, day: 31, hour: 0, minute: 30 },
          { zone: tz },
        ).toMillis(),
        dateString: '',
      },
      {
        sgv: 90,
        date: DateTime.fromObject(
          { year: 2024, month: 3, day: 31, hour: 3, minute: 30 },
          { zone: tz },
        ).toMillis(),
        dateString: '',
      },
    ];
    // Add padding
    for (let i = 0; i < 10; i++)
      entries.push({
        sgv: 90,
        date: DateTime.fromObject(
          { year: 2024, month: 3, day: 31, hour: 4, minute: i },
          { zone: tz },
        ).toMillis(),
        dateString: '',
      });

    const insight = createOvernightInsight(
      entries,
      tz,
      GlucoseUnit.MGDL,
    )?.generate();
    expect(insight).not.toBeNull();
    expect(insight?.note).toContain('100%');
  });

  it('should sanitize invalid data (NaN SGV, Invalid Dates)', () => {
    const entries: GlucoseEntry[] = [
      { sgv: NaN, date: createDate(1, 0), dateString: '' },
      { sgv: 90, date: NaN, dateString: '' },
      { sgv: 90, date: createDate(1, 1), dateString: '' },
    ];
    // Add padding
    for (let i = 0; i < 11; i++)
      entries.push({ sgv: 90, date: createDate(1, i + 10), dateString: '' });

    const insight = createOvernightInsight(
      entries,
      timezone,
      GlucoseUnit.MGDL,
    )?.generate();
    // Should have 12 valid entries (11 padding + 1 valid boundary).
    // The NaN and Invalid Date should be filtered out.
    expect(insight).not.toBeNull();
    expect(insight?.note).toContain('100%');
  });

  it('should use dynamic units in copy (mmol/L)', () => {
    const entries: GlucoseEntry[] = [];
    // Tier 2 scenario
    for (let i = 0; i < 12; i++)
      entries.push({ sgv: 130, date: createDate(1, i * 5), dateString: '' });
    for (let i = 0; i < 3; i++)
      entries.push({ sgv: 160, date: createDate(2, i * 5), dateString: '' });

    const insight = createOvernightInsight(
      entries,
      timezone,
      GlucoseUnit.MMOL,
    )?.generate();
    expect(insight?.note).toContain('(4.5-5.5)');
  });
});
