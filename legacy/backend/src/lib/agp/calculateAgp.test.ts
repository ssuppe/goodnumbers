import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { calculateAgp } from './calculateAgp.js';

// --- Helper to create Nightscout entries ---
const createTestEntries = (
  values: number[],
  hour: number,
  minute: number,
  timezone: string,
) => {
  const entries = [];
  const baseDate = DateTime.fromISO('2024-01-01T00:00:00', { zone: timezone });

  for (let i = 0; i < values.length; i++) {
    // Spread points across days
    const timestamp = baseDate.plus({ days: i, hours: hour, minutes: minute });
    entries.push({
      date: timestamp.toMillis(),
      sgv: values[i],
      type: 'sgv',
    });
  }
  return entries;
};

describe('calculateAgp (30-minute resolution)', () => {
  it('should bucket data into 30-minute slots (48 bins total)', () => {
    // Create data for 10:30 (Bin index: 10*2 + 1 = 21)
    // We create 35 points to ensure we hit the threshold logic (threshold is 30)
    const values = Array.from({ length: 35 }, () => 120); 
    const entries = createTestEntries(values, 10, 30, 'Europe/London');

    const result = calculateAgp(entries, 'Europe/London');

    // Requirement: 24 hours * 2 slots/hour = 48 bins
    expect(result).toHaveLength(48);
    
    // Check 10:00 (should be empty)
    const bin1000 = result.find(b => b.time === '10:00');
    expect(bin1000?.median).toBeNull();

    // Check 10:30 (should have data)
    const bin1030 = result.find(b => b.time === '10:30');
    expect(bin1030).toBeDefined();
    expect(bin1030?.median).toBe(120);
  });

  it('should correctly calculate statistics for a specific 30m slot', () => {
    // Data: [100, 110, 120... 440] (35 points)
    const values = Array.from({ length: 35 }, (_, i) => 100 + (i * 10));
    const entries = createTestEntries(values, 14, 30, 'Europe/London'); // 14:30

    const result = calculateAgp(entries, 'Europe/London');
    const bin = result.find(b => b.time === '14:30');

    expect(bin).toBeDefined();
    
    // Median of 35 items is the 18th item (index 17)
    // value at index 17 = 100 + (17 * 10) = 270
    expect(bin?.median).toBe(270);
  });
});