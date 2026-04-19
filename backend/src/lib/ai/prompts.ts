// backend/src/lib/ai/prompts.ts

import { GlycemicCluster, Insight, GlucoseUnit } from '@goodnumbers/types';
import { DateTime } from 'luxon';
import { u } from '../../utils/text.js';
import { TreatmentContext } from './gemini.js';

/**
 * Builds a chronological text representation of glucose and treatments
 * surrounding each event in the cluster to provide raw evidence for the AI.
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

    // 2. Get glucose readings for this specific event
    const relevantReadings = (event.readings || []).map((r) => ({
      time: new Date(r.timestamp).getTime(),
      type: 'GLUCOSE',
      label: `${u(r.value, preferredUnits)} ${unitsLabel}`,
    }));

    // 3. Combine and sort chronologically
    const timeline = [...relevantTreatments, ...relevantReadings].sort(
      (a, b) => a.time - b.time,
    );

    timeline.forEach((item) => {
      const timeStr = DateTime.fromMillis(item.time)
        .setZone(timezone)
        .toFormat('HH:mm');
      evidence += `  [${timeStr}] ${item.label}\n`;
    });
  });

  return evidence;
}

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
You are a clinical diabetes coach analyzing a recurring pattern (cluster) of glucose events. 
Your goal is to provide a precise, professional, and actionable assessment without "AI slop."

CLUSTER SUMMARY:
- Type: ${cluster.type === 'hyper' ? 'High Glucose' : 'Low Glucose'}
- Typical Time: ${Math.floor(cluster.avgStartMinute / 60)}:${(cluster.avgStartMinute % 60).toString().padStart(2, '0')}
- Occurrences: ${cluster.eventCount} events this week.

DETERMINISTIC FINDINGS (Ground Truth):
${insightsList}

RAW EVIDENCE (Timeline of select events in timezone ${timezone}):
${rawEvidence}

INSTRUCTIONS:
Your response must strictly follow this structure:

Key takeaway or observation: [One sentence summarizing the core issue]
Recommendation: [1-3 specific, actionable points to discuss with a doctor]
In detail: [One paragraph (4-6 sentences) explaining the clinical reasoning in simple, professional but colloquial language. Be precise about the timing of insulin vs carbs seen in the raw evidence.]

CONSTRAINTS:
- NEVER give medical prescriptions or direct instructions. Frame as "patterns to discuss with your doctor."
- CRITICAL: Use ${unitsLabel} for ALL glucose values. 
- Do not use conversational filler (e.g., "Certainly," "I've analyzed...").
- Be concise. Avoid "AI slop."
`;
};
