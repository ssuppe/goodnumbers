import { describe, it, expect } from 'vitest';
import { generateClusterInsights } from '../../../src/lib/insights/cluster';
import {
  InsightPriority,
  type GlycemicCluster,
  type GlycemicEvent,
  type NormalizedTreatment,
} from '@goodnumbers/types';

describe('Cluster Hypoglycemia Kinetic Insights', () => {
  const baseEvent: GlycemicEvent = {
    id: 'e1',
    type: 'hypo',
    startTime: '2023-01-01T12:00:00Z',
    endTime: '2023-01-01T12:30:00Z',
    startMinuteOfDay: 720,
    durationMinutes: 30,
    readings: [],
  };

  const createReadings = (
    startVal: number,
    endVal: number,
    minsAgo: number = 30,
  ) => {
    const startTime = new Date('2023-01-01T12:00:00Z').getTime();
    return [
      {
        timestamp: new Date(startTime - minsAgo * 60000).toISOString(),
        value: startVal,
      },
      { timestamp: new Date(startTime).toISOString(), value: endVal },
    ];
  };

  const createCluster = (events: GlycemicEvent[]): GlycemicCluster => {
    return {
      id: 'c1',
      type: 'hypo',
      avgStartMinute: 720,
      avgDurationMinutes: 30,
      eventCount: events.length,
      activeDays: [1],
      events: events.map((e) => ({
        ...e,
        readings: e.readings || [],
      })),
    };
  };

  it('detects Compression Lows (ROC >= 3.0) with specific time', () => {
    // 160 to 60 in 20 mins (dirty data) = 100 / 20 = 5.0 mg/dL/min
    const cluster = createCluster([
      { ...baseEvent, readings: createReadings(160, 60, 20) },
    ]);
    const insights = generateClusterInsights(cluster, []);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.INFO,
        note: expect.stringContaining(
          'Compression Lows: 1 event (Sun 12:00 PM) show a sudden, vertical drop',
        ),
      }),
    );
  });

  it('prioritizes Compression Low over Carb Mismatch', () => {
    // Huge drop (compression), but carbs are present. Should STILL be compression.
    const cluster = createCluster([
      { ...baseEvent, readings: createReadings(160, 60, 15) },
    ]);
    const treatments: NormalizedTreatment[] = [
      {
        date: new Date('2023-01-01T10:00:00Z').getTime(),
        carbs: 40,
        insulin: 0,
      },
    ];
    const insights = generateClusterInsights(cluster, treatments);

    expect(insights).toHaveLength(1);
    expect(insights[0].note).toContain(
      'Compression Lows: 1 event (Sun 12:00 PM)',
    );
  });

  it('detects Over-Announced Meals (Carbs present in last 3h)', () => {
    // 100 to 60 in 30 mins = 1.33 mg/dL/min (Not a compression, not a crash)
    const cluster = createCluster([
      { ...baseEvent, readings: createReadings(100, 60, 30) },
    ]);
    const treatments: NormalizedTreatment[] = [
      {
        date: new Date('2023-01-01T10:00:00Z').getTime(),
        carbs: 40,
        insulin: 0,
      },
    ];

    const insights = generateClusterInsights(cluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining(
          'Over-Announced Meals: 1 low (Sun 12:00 PM) happened shortly after announcing carbs',
        ),
      }),
    );
  });

  it('detects Aggressive Loop / High Pressure (ROC >= 1.5 + ANY recent insulin)', () => {
    // 120 to 60 in 30 mins = 2.0 mg/dL/min
    const cluster = createCluster([
      { ...baseEvent, readings: createReadings(120, 60, 30) },
    ]);
    // Even a tiny 0.05U SMB triggers the context
    const treatments: NormalizedTreatment[] = [
      {
        date: new Date('2023-01-01T11:00:00Z').getTime(),
        insulin: 0.05,
        carbs: 0,
      },
    ];

    const insights = generateClusterInsights(cluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining(
          'High Insulin Pressure: 1 low (Sun 12:00 PM) feature a steep drop',
        ),
      }),
    );
  });

  it('detects Basal/Sensitivity Drift (Slow ROC + No Carbs)', () => {
    // 90 to 60 in 30 mins = 1.0 mg/dL/min
    const cluster = createCluster([
      { ...baseEvent, readings: createReadings(90, 60, 30) },
    ]);
    const treatments: NormalizedTreatment[] = [
      {
        date: new Date('2023-01-01T08:00:00Z').getTime(),
        insulin: 1.0,
        carbs: 0,
      },
    ]; // Outside 2h window

    const insights = generateClusterInsights(cluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining(
          'Background Drifts: 1 event (Sun 12:00 PM) are slow, drifting lows',
        ),
      }),
    );
  });

  it('lists multiple events in the insight note', () => {
    const events = [
      {
        ...baseEvent,
        id: 'e1',
        startTime: '2023-01-01T12:00:00Z',
        readings: createReadings(90, 60, 30),
      },
      {
        ...baseEvent,
        id: 'e2',
        startTime: '2023-01-02T12:00:00Z',
        readings: createReadings(95, 65, 30),
      },
    ];
    const cluster = createCluster(events);
    const insights = generateClusterInsights(cluster, []);

    expect(insights[0].note).toContain(
      'Background Drifts: 2 events (Sun 12:00 PM, Mon 12:00 PM)',
    );
  });
});
