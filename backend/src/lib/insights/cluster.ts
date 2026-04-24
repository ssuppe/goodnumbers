import { Insight, InsightPriority, GlycemicCluster } from '@goodnumbers/types';

interface Treatment {
  date: number;
  carbs?: number;
  insulin?: number;
}

const MEAL_LOOKBACK_MS = 180 * 60 * 1000; // 3 hours
const BOLUS_SEARCH_MS = 30 * 60 * 1000; // 30 minutes
const PREBOLUS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Formats an ISO string into a concise human-readable day and time.
 * Example: "Mon 2:15 PM"
 */
function formatEventTime(isoString: string, timezone: string = 'UTC'): string {
  try {
    const d = new Date(isoString);
    const weekday = d.toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: timezone,
    });
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
    return `${weekday} ${time}`;
  } catch (e) {
    // Fallback if timezone is invalid
    return formatEventTime(isoString, 'UTC');
  }
}

/**
 * Helper to format a list of event times.
 */
function formatEventList(times: string[]): string {
  if (times.length === 0) return '';
  if (times.length === 1) return `(${times[0]})`;
  return `(${times.join(', ')})`;
}

export function generateClusterInsights(
  cluster: GlycemicCluster,
  treatments: Treatment[],
  timezone: string = 'UTC',
): Insight[] {
  if (!cluster.events || !cluster.events.length) return [];

  const insights: Insight[] = [];

  if (cluster.type === 'hypo') {
    const compressionEvents: string[] = [];
    const carbMismatchEvents: string[] = [];
    const aggressiveCrashEvents: string[] = [];
    const driftEvents: string[] = [];

    let maxHypoLookback = 30; // Default to ROC window

    cluster.events.forEach((event) => {
      const eventTime = new Date(event.startTime).getTime();
      const displayTime = formatEventTime(event.startTime, timezone);

      // 1. DYNAMIC VELOCITY (ROC) CALCULATION
      let roc = 0;
      if (event.readings && event.readings.length > 0) {
        const sortedReadings = [...event.readings].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        const startReading = sortedReadings
          .filter((r) => new Date(r.timestamp).getTime() <= eventTime)
          .pop();

        if (startReading) {
          const targetLookback = eventTime - 30 * 60000;
          let priorReading = sortedReadings[0];
          let minDiff = Infinity;

          for (const r of sortedReadings) {
            const rTime = new Date(r.timestamp).getTime();
            if (rTime >= new Date(startReading.timestamp).getTime()) continue;
            const diff = Math.abs(rTime - targetLookback);
            if (diff < minDiff) {
              minDiff = diff;
              priorReading = r;
            }
          }

          if (
            priorReading &&
            priorReading.timestamp !== startReading.timestamp
          ) {
            const t1 = new Date(priorReading.timestamp).getTime();
            const t2 = new Date(startReading.timestamp).getTime();
            const deltaMins = (t2 - t1) / 60000;

            if (deltaMins >= 10) {
              roc = (priorReading.value - startReading.value) / deltaMins;
            }
          }
        }
      }

      // 2. TREATMENT CONTEXT VERIFICATION
      const lookback3h = eventTime - 180 * 60000;
      const lookback2h = eventTime - 120 * 60000;

      const recentTreatments = treatments.filter(
        (t) => t.date >= lookback3h && t.date <= eventTime,
      );

      const carbsTreatments = recentTreatments.filter(
        (t) => (t.carbs || 0) > 0,
      );
      const insulinTreatments = recentTreatments.filter(
        (t) => t.date >= lookback2h && (t.insulin || 0) > 0,
      );

      const hasCarbs = carbsTreatments.length > 0;
      const hasRecentInsulin = insulinTreatments.length > 0;

      // 3. STRICT CLINICAL HIERARCHY
      if (roc >= 3.0) {
        compressionEvents.push(displayTime);
      } else if (hasCarbs) {
        carbMismatchEvents.push(displayTime);
        // Track how far back the carbs were
        carbsTreatments.forEach((t) => {
          const delta = Math.ceil((eventTime - t.date) / 60000);
          if (delta > maxHypoLookback) maxHypoLookback = delta;
        });
      } else if (roc >= 1.5 && hasRecentInsulin) {
        aggressiveCrashEvents.push(displayTime);
        // Track how far back the insulin was
        insulinTreatments.forEach((t) => {
          const delta = Math.ceil((eventTime - t.date) / 60000);
          if (delta > maxHypoLookback) maxHypoLookback = delta;
        });
      } else {
        driftEvents.push(displayTime);
      }
    });

    // 4. INSIGHT GENERATION
    if (compressionEvents.length > 0) {
      insights.push({
        priority: InsightPriority.INFO,
        note: `Compression Lows: ${compressionEvents.length} event${compressionEvents.length > 1 ? 's' : ''} ${formatEventList(compressionEvents)} show a sudden, vertical drop that usually indicates a sensor error or sleeping on the sensor, rather than a true low.`,
        evidenceWindowMins: 30,
      });
    }

    if (carbMismatchEvents.length > 0) {
      insights.push({
        priority: InsightPriority.IMPORTANT,
        note: `Over-Announced Meals: ${carbMismatchEvents.length} low${carbMismatchEvents.length > 1 ? 's' : ''} ${formatEventList(carbMismatchEvents)} happened shortly after announcing carbs. Your system delivered insulin for the food, but your blood sugar dropped. Did you eat less than entered, or eat a high-fat/protein meal that absorbed slowly?`,
        evidenceWindowMins: Math.max(maxHypoLookback, 60),
      });
    }

    if (aggressiveCrashEvents.length > 0) {
      insights.push({
        priority: InsightPriority.IMPORTANT,
        note: `High Insulin Pressure: ${aggressiveCrashEvents.length} low${aggressiveCrashEvents.length > 1 ? 's' : ''} ${formatEventList(aggressiveCrashEvents)} feature a steep drop and follow periods where your system delivered insulin (via micro-boluses or corrections). The insulin may have been too aggressive.`,
        evidenceWindowMins: Math.max(maxHypoLookback, 60),
      });
    }

    if (driftEvents.length > 0) {
      insights.push({
        priority: InsightPriority.IMPORTANT,
        note: `Background Drifts: ${driftEvents.length} event${driftEvents.length > 1 ? 's' : ''} ${formatEventList(driftEvents)} are slow, drifting lows that happen when you have very little active insulin and haven't eaten recently. If these happen overnight or after exercise, your baseline sensitivity might have increased.`,
        evidenceWindowMins: 60,
      });
    }

    return insights;
  }

  // Hyperglycemia (Meal-related)
  const uncoveredEvents: string[] = [];
  const postBolusEvents: string[] = [];
  const preBolusEvents: string[] = [];
  let mealRelatedCount = 0;
  let maxHyperLookback = 60; // Default

  cluster.events.forEach((event) => {
    const eventTime = new Date(event.startTime).getTime();
    const displayTime = formatEventTime(event.startTime, timezone);

    const relevantMeals = treatments.filter(
      (t) =>
        (t.carbs || 0) > 0 &&
        t.date >= eventTime - MEAL_LOOKBACK_MS &&
        t.date <= eventTime,
    );

    if (relevantMeals.length === 0) return;

    let eventUncovered = false;
    let eventPostBolus = false;
    let eventPreBolus = false;

    relevantMeals.forEach((meal) => {
      // Track how far back the meal was
      const mealDelta = Math.ceil((eventTime - meal.date) / 60000);
      if (mealDelta > maxHyperLookback) maxHyperLookback = mealDelta;

      let closestBolus: Treatment | null = null;
      let minDelta = Infinity;

      for (const t of treatments) {
        if ((t.insulin || 0) > 0) {
          const delta = Math.abs(t.date - meal.date);
          if (delta <= BOLUS_SEARCH_MS && delta < minDelta) {
            minDelta = delta;
            closestBolus = t;
          }
        }
      }

      if (!closestBolus) {
        eventUncovered = true;
      } else {
        // Also track bolus if it's further back than the meal (pre-bolus)
        const bolusDelta = Math.ceil((eventTime - closestBolus.date) / 60000);
        if (bolusDelta > maxHyperLookback) maxHyperLookback = bolusDelta;

        const bolusVsMealDiff = closestBolus.date - meal.date;
        if (bolusVsMealDiff < -PREBOLUS_THRESHOLD_MS) {
          eventPreBolus = true;
        } else {
          eventPostBolus = true;
        }
      }
    });

    mealRelatedCount++;
    if (eventUncovered) {
      uncoveredEvents.push(displayTime);
    } else if (eventPostBolus) {
      postBolusEvents.push(displayTime);
    } else if (eventPreBolus) {
      preBolusEvents.push(displayTime);
    }
  });

  if (mealRelatedCount > 0) {
    const percent = Math.round((mealRelatedCount / cluster.eventCount) * 100);
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `${percent}% of these high events (${mealRelatedCount} out of ${cluster.eventCount}) appear to be meal-related.`,
      evidenceWindowMins: maxHyperLookback + 15,
    });
  }

  if (uncoveredEvents.length > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Potential uncovered meals detected in ${uncoveredEvents.length} event${uncoveredEvents.length > 1 ? 's' : ''} ${formatEventList(uncoveredEvents)}.`,
      evidenceWindowMins: maxHyperLookback + 15,
    });
  }

  if (postBolusEvents.length > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Post-meal hyperglycemia detected in ${postBolusEvents.length} event${postBolusEvents.length > 1 ? 's' : ''} ${formatEventList(postBolusEvents)} where insulin was given at or after eating (post-bolused).`,
      evidenceWindowMins: maxHyperLookback + 15,
    });
  }

  if (preBolusEvents.length > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Hyperglycemia occurred in ${preBolusEvents.length} event${preBolusEvents.length > 1 ? 's' : ''} ${formatEventList(preBolusEvents)} despite insulin being given before the meal.`,
      evidenceWindowMins: maxHyperLookback + 15,
    });
  }

  return insights;
}
