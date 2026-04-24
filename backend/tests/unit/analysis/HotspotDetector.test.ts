import { describe, it, expect } from 'vitest';
import { HotspotDetector } from '../../../src/lib/analysis/HotspotDetector';
import { GlucoseEntry } from '@goodnumbers/types';

describe('HotspotDetector Valley Splitting', () => {
  const detector = new HotspotDetector('UTC');
  const MIN_MS = 60000;

  it('splits double spikes when a significant valley occurs', () => {
    // Threshold is 180.
    // MIN_DURATION is 20 mins.
    const entries: GlucoseEntry[] = [
      { date: 0, sgv: 180 },
      { date: 10 * MIN_MS, sgv: 250 }, // Peak 1
      { date: 20 * MIN_MS, sgv: 195 },
      { date: 25 * MIN_MS, sgv: 190 }, // Valley (Dip > 35mg/dL from peak 250)
      { date: 30 * MIN_MS, sgv: 210 }, // Rising again -> Split!
      { date: 40 * MIN_MS, sgv: 260 }, // Peak 2
      { date: 55 * MIN_MS, sgv: 180 },
    ];

    const events = detector.detectEvents(entries, 'hyper', 180);

    // Should see 2 events
    expect(events).toHaveLength(2);

    // First event should start at the first 180 (0) and end at the valley (25)
    expect(new Date(events[0].startTime).getTime()).toBe(0);
    expect(events[0].durationMinutes).toBeGreaterThanOrEqual(20);

    // Second event should start at the valley recovery (30) and end at 55
    expect(new Date(events[1].startTime).getTime()).toBe(30 * MIN_MS);
    expect(events[1].durationMinutes).toBeGreaterThanOrEqual(20);
  });

  it('does NOT split when the valley is shallow (< 35mg/dL)', () => {
    const entries: GlucoseEntry[] = [
      { date: 0, sgv: 180 },
      { date: 15 * MIN_MS, sgv: 220 }, // Peak
      { date: 25 * MIN_MS, sgv: 190 }, // Shallow valley (30mg/dL dip)
      { date: 35 * MIN_MS, sgv: 230 }, // Rising again
      { date: 50 * MIN_MS, sgv: 180 },
    ];

    const events = detector.detectEvents(entries, 'hyper', 180);
    expect(events).toHaveLength(1);
    expect(events[0].durationMinutes).toBe(50);
  });
});
