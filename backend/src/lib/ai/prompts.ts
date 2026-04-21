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
    const windowStart = eventStart - 60 * 60 * 1000; // 1h before
    const windowEnd = eventStart + 3 * 60 * 60 * 1000; // 3h after

    const eventDate = DateTime.fromISO(event.startTime).setZone(timezone);
    evidence += `\nEVENT ${idx + 1} (${eventDate.toFormat('cccc, MMM d')}):\n`;

    // 1. Get relevant treatments in this window
    const relevantTreatments = treatments
      .filter((t) => t.date >= windowStart && t.date <= windowEnd)
      .map((t) => ({
        time: t.date,
        type: 'TREATMENT',
        label: `${t.carbs ? `${t.carbs}g carbs` : ''}${t.carbs && t.insulin ? ', ' : ''}${t.insulin ? `${t.insulin}u insulin` : ''}`,
      }));

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
You are a helpful diabetes coach reviewing a recurring pattern in a weekly health journal. 
Your goal is to share what you see in the data using friendly, plain English.

CLUSTER SUMMARY:
- Pattern: ${cluster.type === 'hyper' ? 'High Blood Sugar' : 'Low Blood Sugar'}
- Typical Time: ${Math.floor(cluster.avgStartMinute / 60)}:${(cluster.avgStartMinute % 60).toString().padStart(2, '0')}
- Occurrences: Happened ${cluster.eventCount} times this week.

DETERMINISTIC FINDINGS (Ground Truth):
${insightsList}

RAW EVIDENCE (Timeline of select events - times are rounded to nearest 10m):
${rawEvidence}

INSTRUCTIONS:
Your response must be a JSON object with this structure:
{
  "assessment": "A single string containing the assessment with the following structure: \n\nKey takeaway or observation: ...\nRecommendation: ...\nIn detail: ...",
  "quick_log_suggestions": ["up to 3 short, 2-4 word phrases the user might write in their journal (e.g., 'Underestimated carbs', 'Late dinner')"]
}

CONSTRAINTS:
- The 'assessment' text must follow the structure: 
  Key takeaway or observation: [One short sentence summarizing the core issue]
  Recommendation: [1-3 specific, punchy actions to discuss with a doctor]
  In detail: [One short paragraph (3-4 sentences) explaining what's happening. Use everyday language like "insulin kicking in" instead of "insulin action." Be precise about the timing seen in the raw evidence.]
- Audience is the patient. Be professional but colloquial and supportive.
- Use "blood sugar" instead of "glucose" or "glucose levels."
- NEVER give medical prescriptions or direct instructions. Frame everything as "something to talk about with your doctor."
- CRITICAL: Use ${unitsLabel} for ALL blood sugar values mentioned.
- Do not use conversational filler (e.g., "I've analyzed," "Certainly").
- Keep it very concise. Avoid "AI slop."
- Ensure the output is valid JSON.
`;
};
