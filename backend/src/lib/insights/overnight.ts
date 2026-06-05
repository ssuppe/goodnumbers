import {
  GlucoseEntry,
  GlucoseUnit,
  Insight,
  InsightPriority,
} from '@goodnumbers/types';
import { DateTime } from 'luxon';
import { InsightGenerator } from './interfaces.js';
import { u } from '../../utils/text.js';

export function createOvernightInsight(
  entries: GlucoseEntry[],
  timezone: string,
  units: GlucoseUnit,
): InsightGenerator | null {
  // 1. Filtering Logic (23:00 - 06:59) + Sanitization
  const filtered = entries.filter((e) => {
    // Sanitization: Ignore invalid SGV values
    if (!Number.isFinite(e.sgv)) return false;

    const dt = DateTime.fromMillis(e.date).setZone(timezone);
    // Sanitization: Ignore invalid dates
    if (!dt.isValid) return false;

    const hour = dt.hour;
    return hour >= 23 || hour < 7;
  });

  // 2. Minimum Data Threshold (1 hour = ~12 readings)
  if (filtered.length < 12) {
    return null;
  }

  return {
    generate(): Insight {
      // 3. Percentage Calculations
      const total = filtered.length;

      const normalCount = filtered.filter(
        (e) => e.sgv >= 81 && e.sgv <= 99,
      ).length;
      const tightCount = filtered.filter(
        (e) => e.sgv >= 70 && e.sgv <= 140,
      ).length;
      const standardCount = filtered.filter(
        (e) => e.sgv >= 70 && e.sgv <= 180,
      ).length;

      const normalPct = Math.round((normalCount / total) * 100);
      const tightPct = Math.round((tightCount / total) * 100);
      const standardPct = Math.round((standardCount / total) * 100);

      const stats = `(${normalPct}% Normal, ${tightPct}% Tight, ${standardPct}% Standard)`;

      // 4. Cascading Logic (>= 70% threshold)

      // Tier 1: Normal Range Mastery
      if (normalPct >= 70) {
        return {
          priority: InsightPriority.INFO,
          note: `**Mastery Achieved:** You spent **${normalPct}%** of the night in the 'Normal' range ${stats}. This is outstanding work. Stabilizing the night provides a massive statistical improvement to your long-term health and sets your body up for a much easier day ahead.`,
        };
      }

      // Tier 2: Tight Range Success
      if (tightPct >= 70) {
        return {
          priority: InsightPriority.INFO,
          note: `**Tight Range Success:** You spent **${tightPct}%** of the night in a 'Tight' range ${stats}. This secures a third of your day in range with zero effort. **Action:** Aim for the 'Normal' range (${u(81, units)}-${u(99, units)}) to reach non-diabetic stability overnight.`,
        };
      }

      // Tier 3: Building Stability
      if (standardPct >= 70) {
        return {
          priority: InsightPriority.IMPORTANT,
          note: `**Building Stability:** You spent **${standardPct}%** of the night in the 'Standard' range ${stats}. This is a solid baseline. **Action:** Aim for the 'Tight' range (${u(70, units)}-${u(140, units)}) next week. Smoothing these overnight fluctuations makes managing your daytime meals much easier.`,
        };
      }

      // Tier 4: Below Target (Critical Action)
      return {
        priority: InsightPriority.SERIOUS,
        note: `**Overnight Action Required:** You spent only **${standardPct}%** of the night in the standard range (${u(70, units)}-${u(180, units)}) ${stats}. Because the night represents a full third of your day with no food or activity, it's the highest-leverage place to improve. **Action:** Focus on stabilizing this baseline first with your care team to stop waking up feeling drained.`,
      };
    },
  };
}
