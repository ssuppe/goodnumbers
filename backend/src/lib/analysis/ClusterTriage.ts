import { GlycemicCluster } from '@goodnumbers/types';

/**
 * Calculates a clinical urgency severity score for a glycemic cluster.
 * Rules:
 * - Hypoglycemia is clinically prioritized over hyperglycemia.
 * - Severe hypoglycemia (<54 mg/dL) receives maximum priority.
 * - Nocturnal events (between 23:00 and 06:00) receive an added risk bonus.
 * - Event frequency and extreme glucose deviations further scale the score.
 */
export function scoreClusterSeverity(cluster: GlycemicCluster): number {
  let score = 0;

  // Base score by event type
  if (cluster.type === 'hypo') {
    score += 100;
  } else {
    score += 40;
  }

  // Check min/max readings across events in this cluster
  let minGlucose = Infinity;
  let maxGlucose = -Infinity;

  if (cluster.events && cluster.events.length > 0) {
    for (const ev of cluster.events) {
      if (ev.readings && ev.readings.length > 0) {
        for (const r of ev.readings) {
          if (r.value < minGlucose) minGlucose = r.value;
          if (r.value > maxGlucose) maxGlucose = r.value;
        }
      }
    }
  }

  // Hypo severity modifiers
  if (cluster.type === 'hypo') {
    if (minGlucose < 54) {
      score += 60; // Level 2 severe hypoglycemia
    } else if (minGlucose < 70) {
      score += 20; // Level 1 hypoglycemia
    }
  }

  // Hyper severity modifiers
  if (cluster.type === 'hyper') {
    if (maxGlucose >= 250) {
      score += 30; // Extreme hyperglycemia / rebound
    } else if (maxGlucose >= 180) {
      score += 10;
    }
  }

  // Frequency multiplier
  score += Math.min(cluster.eventCount * 5, 30);

  // Nocturnal bonus (11 PM to 6 AM)
  const startHour = Math.floor(cluster.avgStartMinute / 60);
  if (startHour >= 23 || startHour < 6) {
    score += 25;
  }

  return score;
}

export interface TriagedCluster extends GlycemicCluster {
  severityScore: number;
  isPrimaryFocus: boolean;
}

/**
 * Evaluates an array of clusters and ranks them by clinical severity.
 * Sets `isPrimaryFocus = true` on the single top-ranking cluster.
 */
export function triageClusters(clusters: GlycemicCluster[]): TriagedCluster[] {
  if (!clusters || clusters.length === 0) {
    return [];
  }

  const scored = clusters.map((cluster) => ({
    ...cluster,
    severityScore: scoreClusterSeverity(cluster),
    isPrimaryFocus: false,
  }));

  // Sort descending by severity score
  scored.sort((a, b) => b.severityScore - a.severityScore);

  // Flag top cluster as primary focus
  if (scored.length > 0) {
    scored[0].isPrimaryFocus = true;
  }

  return scored;
}
