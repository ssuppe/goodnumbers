import { GlucoseEntry } from '@goodnumbers/types';
import { DateTime } from 'luxon';

export interface PatternStats {
  mostFrequentHigh: string | null;
  mostFrequentLow: string | null;
  largestVarianceBlock: string | null;
}

export function calculatePatternStats(
  entries: GlucoseEntry[],
  timezone: string,
): PatternStats {
  if (!entries.length) {
    return {
      mostFrequentHigh: null,
      mostFrequentLow: null,
      largestVarianceBlock: null,
    };
  }

  // Define time blocks:
  // Overnight: 11:00 PM - 7:00 AM (hour >= 23 || hour < 7)
  // Morning: 7:00 AM - 11:00 AM (hour >= 7 && hour < 11)
  // Afternoon: 11:00 AM - 5:00 PM (hour >= 11 && hour < 17)
  // Evening: 5:00 PM - 11:00 PM (hour >= 17 && hour < 23)
  const blocks = [
    {
      name: 'Overnight (11:00 PM - 7:00 AM)',
      filter: (hour: number) => hour >= 23 || hour < 7,
    },
    {
      name: 'Morning (7:00 AM - 11:00 AM)',
      filter: (hour: number) => hour >= 7 && hour < 11,
    },
    {
      name: 'Afternoon (11:00 AM - 5:00 PM)',
      filter: (hour: number) => hour >= 11 && hour < 17,
    },
    {
      name: 'Evening (5:00 PM - 11:00 PM)',
      filter: (hour: number) => hour >= 17 && hour < 23,
    },
  ];

  const blockData = blocks.map((b) => ({
    name: b.name,
    filter: b.filter,
    entries: [] as GlucoseEntry[],
  }));

  for (const entry of entries) {
    const dt = DateTime.fromMillis(entry.date).setZone(timezone);
    if (!dt.isValid) continue;
    const hour = dt.hour;
    for (const b of blockData) {
      if (b.filter(hour)) {
        b.entries.push(entry);
        break;
      }
    }
  }

  let maxHighCount = 0;
  let mostFrequentHighBlock: string | null = null;

  let maxLowCount = 0;
  let mostFrequentLowBlock: string | null = null;

  let maxStdDev = -1;
  let largestVarianceBlock: string | null = null;

  for (const b of blockData) {
    const highs = b.entries.filter((e) => e.sgv >= 180).length;
    const lows = b.entries.filter((e) => e.sgv <= 70).length;

    if (highs > 0 && highs > maxHighCount) {
      maxHighCount = highs;
      mostFrequentHighBlock = b.name;
    }
    if (lows > 0 && lows > maxLowCount) {
      maxLowCount = lows;
      mostFrequentLowBlock = b.name;
    }

    const sgvs = b.entries.map((e) => e.sgv);
    if (sgvs.length >= 2) {
      const mean = sgvs.reduce((sum, v) => sum + v, 0) / sgvs.length;
      const sqDiffSum = sgvs.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
      const stdDev = Math.sqrt(sqDiffSum / (sgvs.length - 1));

      if (stdDev > maxStdDev) {
        maxStdDev = stdDev;
        largestVarianceBlock = b.name;
      }
    }
  }

  return {
    mostFrequentHigh: mostFrequentHighBlock,
    mostFrequentLow: mostFrequentLowBlock,
    largestVarianceBlock,
  };
}
