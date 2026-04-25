// backend/src/lib/ai/prompts.ts

import { GlycemicCluster, Insight, GlucoseUnit } from '@goodnumbers/types';
import { DateTime } from 'luxon';
import { u } from '../../utils/text.js';
import { TreatmentContext } from './gemini.js';

/**
 * Builds a chronological text representation of blood sugar and treatments
 * surrounding each event in the cluster to provide raw evidence for the AI.
 * Timestamps are rounded to the nearest 10 minutes for readability.
 */
function buildRawEvidence(
  cluster: GlycemicCluster,
  treatments: TreatmentContext[],
  preferredUnits: GlucoseUnit,
  timezone: string,
): string {
  // Limit to first 3 events to keep context window tight but representative
  const eventsToProfile = cluster.events.slice(0, 3);
  let evidence = '';

  const unitsLabel = preferredUnits === GlucoseUnit.MMOL ? 'mmol/L' : 'mg/dL';

  eventsToProfile.forEach((event, idx) => {
    const eventStart = new Date(event.startTime).getTime();
    const windowStart = eventStart - 3 * 60 * 60 * 1000; // 3h before (essential for 4-pillar analysis)
    const windowEnd = eventStart + 3 * 60 * 60 * 1000; // 3h after

    const eventDate = DateTime.fromISO(event.startTime).setZone(timezone);
    evidence += `\nEVENT ${idx + 1} (${eventDate.toFormat('cccc, MMM d')}):\n`;

    // 1. Get relevant treatments in this window
    const relevantTreatments = treatments
      .filter((t) => t.date >= windowStart && t.date <= windowEnd)
      .map((t) => {
        // Refined SMB check: Insulin < 0.3u AND no carbs present
        const isSMB = t.insulin && t.insulin > 0 && t.insulin < 0.3 && !t.carbs;
        const insulinLabel = t.insulin
          ? `${t.insulin}u insulin${isSMB ? ' (Automated Correction/SMB)' : ''}`
          : '';

        return {
          time: t.date,
          type: 'TREATMENT',
          label: `${t.carbs ? `${t.carbs}g carbs` : ''}${t.carbs && t.insulin ? ', ' : ''}${insulinLabel}`,
        };
      });

    // 2. Get blood sugar readings for this specific event
    const relevantReadings = (event.readings || []).map((r) => ({
      time: new Date(r.timestamp).getTime(),
      type: 'GLUCOSE',
      label: `${u(r.value, preferredUnits)} ${unitsLabel}`,
    }));

    // 3. Combine, sort, and round times
    const timeline = [...relevantTreatments, ...relevantReadings].sort(
      (a, b) => a.time - b.time,
    );

    timeline.forEach((item) => {
      const dt = DateTime.fromMillis(item.time).setZone(timezone);
      // Round to nearest 10 minutes
      const roundedDt = dt
        .plus({ minutes: Math.round(dt.minute / 10) * 10 - dt.minute })
        .startOf('minute');
      const timeStr = roundedDt.toFormat('HH:mm');
      evidence += `  [${timeStr}] ${item.label}\n`;
    });
  });

  return evidence;
}

export const EXECUTIVE_SUMMARY_PROMPT = (
  currentStats: {
    avgGlucose: number;
    timeInRange: number;
    stability: number;
    lowPercentage: number;
  },
  previousStats: {
    avgGlucose: number;
    timeInRange: number;
    stability: number;
  } | null,
  preferredUnits: GlucoseUnit,
) => {
  const unitsLabel = preferredUnits === GlucoseUnit.MMOL ? 'mmol/L' : 'mg/dL';
  return `
You are a helpful diabetes coach. Based on the weekly glucose statistics below, generate exactly 3 executive summary highlight cards.

CURRENT WEEK STATS:
- Avg Glucose: ${u(currentStats.avgGlucose, preferredUnits)} ${unitsLabel}
- Time In Range (TIR): ${Math.round(currentStats.timeInRange)}%
- Stability (CV): ${Math.round(currentStats.stability)}%
- Time Below Range (TBR): ${Math.round(currentStats.lowPercentage)}%

${
  previousStats
    ? `
PREVIOUS WEEK STATS:
- Avg Glucose: ${u(previousStats.avgGlucose, preferredUnits)} ${unitsLabel}
- TIR: ${Math.round(previousStats.timeInRange)}%
- Stability: ${Math.round(previousStats.stability)}%
`
    : 'No previous week data available.'
}

INSTRUCTIONS:
Generate exactly 3 highlights. Each highlight must be one of these types:
1. "win" - Something positive to celebrate.
2. "warn" - Something that needs attention or is a potential risk.
3. "trend" - A noticeable change or a steady pattern.

Format your response as a JSON array of exactly 3 objects with this schema:
[
  {
    "type": "win" | "warn" | "trend",
    "icon": "string (a single emoji)",
    "title": "string (short, 2-4 words)",
    "short_description": "string (one short sentence explaining the insight)"
  }
]

CONSTRAINTS:
- Use only the provided data.
- Icons should be relevant emojis.
- Be supportive and clear.
- Do not use conversational filler.
- Ensure the output is valid JSON.
`;
};

export const CLUSTER_AI_INSIGHT_PROMPT = (
  cluster: GlycemicCluster,
  deterministicInsights: Insight[],
  preferredUnits: GlucoseUnit,
  treatments: TreatmentContext[],
  timezone: string,
  weeklyContext: { vibe: string | null; factors: string },
) => {
  const insightsList = deterministicInsights
    .map((i) => `- ${i.note}`)
    .join('\n');
  const unitsLabel = preferredUnits === GlucoseUnit.MMOL ? 'mmol/L' : 'mg/dL';
  const rawEvidence = buildRawEvidence(
    cluster,
    treatments,
    preferredUnits,
    timezone,
  );

  return `
You are a specialist diabetes data analyst. Your goal is to identify the "Physiological Narrative" across this recurring cluster of glucose events.

WEEKLY CONTEXT (User's subjective environmental factors):
- Overall Vibe: ${weeklyContext.vibe || 'Not reported'}
- Influencing Factors: ${weeklyContext.factors}

CLUSTER SUMMARY:
- Pattern: ${cluster.type === 'hyper' ? 'High Blood Sugar' : 'Low Blood Sugar'}
- Typical Time: ${Math.floor(cluster.avgStartMinute / 60)}:${(cluster.avgStartMinute % 60).toString().padStart(2, '0')}
- Occurrences: Happened ${cluster.eventCount} times this week.

DETERMINISTIC FINDINGS (Ground Truth Heuristics):
${insightsList}

RAW EVIDENCE (Timeline of select events - rounded to nearest 10m):
${rawEvidence}

ANALYSIS FRAMEWORK:
1. THE FLOOR (Basal/Dawn/Somogyi): If early morning, distinguish between "Dawn Phenomenon" (rise) and the "Somogyi Effect" (rebound from nighttime low).
2. THE FUEL (Bolus/Timing/Composition): Analyze the shape of the curve. Sharp early spike (timing) or delayed rise (fat/protein)?
3. THE VARIABLE (Resistance/Hormones): Correlate with stress, illness, or travel reported in the context.
4. THE ENGINE (Activity/Automated Systems): Look for aerobic drops or anaerobic spikes. NOTE: Frequent, small insulin doses labeled as "(Automated Correction/SMB)" indicate an automated system is actively fighting a rise; this is a sign of system effort, not user error or "stacking."

OUTPUT STRUCTURE:
{
  "assessment": "Synthesis of the physiological 'why'. Friendly, plain English for the patient.",
  "reflection_for_doctor": "Discussion starters for the user's next clinic visit. Be specific about time blocks.",
  "quick_log_suggestions": ["up to 3 short, 2-4 word phrases (e.g., 'Late dinner', 'Under-bolused')"]
}

CONSTRAINTS:
- TREND-FIRST: Prioritize synthesizing systemic trends across the entire week. Avoid day-by-day narration (e.g., "On Monday..."). Reference specific days ONLY if they serve as a clear illustration of the pattern or highlight a significant outlier.
- TIME-BLOCK SPECIFICITY: In "reflection_for_doctor", ALWAYS specify the relevant time window (e.g., "between 2 AM and 5 AM" or "the 3 hours following lunch") to provide actionable context for clinical review.
- SAFETY PERSONA: You are a "Specialist Data Analyst." Never use prescriptive language (e.g., "You should change your basal"). Instead, use observational language (e.g., "The data suggests a gap in basal coverage between...").
- Audience is the patient. Be professional, colloquial, and supportive.
- Use "blood sugar" instead of "glucose" or "glucose levels."
- NEVER give medical prescriptions or direct instructions. Frame everything as patterns for reflection.
- CRITICAL: Use ${unitsLabel} for ALL blood sugar values mentioned.
- Do not use conversational filler (e.g., "I've analyzed," "Certainly").
- Keep it very concise. Avoid "AI slop."
- Ensure the output is valid JSON.
`;
};
