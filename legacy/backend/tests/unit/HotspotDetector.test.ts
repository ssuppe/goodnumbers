import { describe, it, expect } from 'vitest';
import { HotspotDetector } from '../../src/lib/analysis/HotspotDetector';
import { GlucoseEntry, GlycemicEvent } from '@goodnumbers/types';
import { DateTime } from 'luxon';
import * as fc from 'fast-check';

// Interface to access private members for testing
interface TestableDetector {
  timezone: string;
  doEventsOverlap(a: GlycemicEvent, b: GlycemicEvent): boolean;
}

// Helper to generate entries
function generateSequence(
  startIso: string,
  count: number,
  value: number,
  intervalMinutes: number = 5,
): GlucoseEntry[] {
  const entries: GlucoseEntry[] = [];
  let current = DateTime.fromISO(startIso);
  for (let i = 0; i < count; i++) {
    entries.push({
      sgv: value,
      date: current.toMillis(),
      dateString: current.toISO()!,
    });
    current = current.plus({ minutes: intervalMinutes });
  }
  return entries;
}

describe('HotspotDetector - Event Detection', () => {
  const detector = new HotspotDetector('UTC');

  it('detects a valid hyper event (> 20 mins)', () => {
    // 6 entries * 5 mins interval = 25 mins duration (0 to 25)
    const entries = generateSequence('2023-01-01T10:00:00Z', 6, 200);

    const events = detector.detectEvents(entries, 'hyper', 180);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('hyper');
    expect(events[0].durationMinutes).toBe(25);
    expect(events[0].readings).toHaveLength(6);
  });

  it('filters out short spikes (< 20 mins)', () => {
    // 4 entries * 5 mins = 15 minutes duration (0, 5, 10, 15)
    const entries = generateSequence('2023-01-01T12:00:00Z', 4, 200);

    const events = detector.detectEvents(entries, 'hyper', 180);

    expect(events).toHaveLength(0);
  });

  it('detects multiple separated events', () => {
    const event1 = generateSequence('2023-01-01T10:00:00Z', 6, 200); // 25 mins
    const normal = generateSequence('2023-01-01T10:30:00Z', 3, 100); // Gap
    const event2 = generateSequence('2023-01-01T11:00:00Z', 6, 200); // 25 mins

    const entries = [...event1, ...normal, ...event2];
    const events = detector.detectEvents(entries, 'hyper', 180);

    expect(events).toHaveLength(2);
    expect(events[0].startTime).toContain('10:00');
    expect(events[1].startTime).toContain('11:00');
  });

  it('Security: limits input to 5000 entries', () => {
    // Generate 5000 normal entries
    const normal = generateSequence('2023-01-01T00:00:00Z', 5000, 100);
    // Generate hyper events AFTER the 5000th entry
    // The last normal entry is at index 4999.
    // Start hyper sequence after that.
    const lastNormalTime = DateTime.fromISO('2023-01-01T00:00:00Z').plus({
      minutes: 5000 * 5,
    });
    const hyper = generateSequence(lastNormalTime.toISO()!, 10, 200);

    const entries = [...normal, ...hyper];
    const events = detector.detectEvents(entries, 'hyper', 180);

    // Should be 0 if limited to 5000, but will be > 0 before implementation
    expect(events).toHaveLength(0);
  });
});

describe('HotspotDetector - Overlap Logic', () => {
  const detector = new HotspotDetector('UTC');

  // Helper to create a dummy event
  const createEvent = (
    startMinute: number,
    duration: number,
  ): GlycemicEvent => ({
    id: 'test-id',
    type: 'hyper',
    startMinuteOfDay: startMinute,
    durationMinutes: duration,
    startTime: '2023-01-01T00:00:00Z', // Dummy
    endTime: '2023-01-01T00:00:00Z', // Dummy
    readings: [],
  });

  it('detects overlap between intersecting intervals', () => {
    const eventA = createEvent(840, 60); // 14:00 - 15:00
    const eventB = createEvent(870, 60); // 14:30 - 15:30

    // Access private method
    const result = (detector as unknown as TestableDetector).doEventsOverlap(
      eventA,
      eventB,
    );
    expect(result).toBe(true);
  });

  it('detects no overlap between distant intervals', () => {
    const eventA = createEvent(840, 60); // 14:00 - 15:00
    const eventC = createEvent(960, 60); // 16:00 - 17:00

    const result = (detector as unknown as TestableDetector).doEventsOverlap(
      eventA,
      eventC,
    );
    expect(result).toBe(false);
  });

  it('detects overlap with buffer (15 mins)', () => {
    const eventA = createEvent(840, 60); // 14:00 - 15:00
    const eventB = createEvent(910, 60); // 15:10 - 16:10 (10 min gap, should overlap with 15m buffer)

    const result = (detector as unknown as TestableDetector).doEventsOverlap(
      eventA,
      eventB,
    );
    expect(result).toBe(true);
  });
});

describe('HotspotDetector - Property Tests', () => {
  const detector = new HotspotDetector('UTC');
  const createEvent = (start: number, duration: number): GlycemicEvent => ({
    id: 'prop-test',
    type: 'hyper',
    startMinuteOfDay: start,
    durationMinutes: duration,
    startTime: '2023-01-01T00:00:00Z',
    endTime: '2023-01-01T00:00:00Z',
    readings: [],
  });

  it('should be symmetric (A overlaps B <=> B overlaps A)', () => {
    fc.assert(
      fc.property(
        fc.nat(1439),
        fc.integer({ min: 1, max: 1440 }),
        fc.nat(1439),
        fc.integer({ min: 1, max: 1440 }),
        (startA, durA, startB, durB) => {
          const eventA = createEvent(startA, durA);
          const eventB = createEvent(startB, durB);
          const overlapAB = (
            detector as unknown as TestableDetector
          ).doEventsOverlap(eventA, eventB);
          const overlapBA = (
            detector as unknown as TestableDetector
          ).doEventsOverlap(eventB, eventA);
          return overlapAB === overlapBA;
        },
      ),
    );
  });

  it('should always overlap if an event wraps midnight and covers the start of day', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1380, max: 1439 }), // Start within last hour
        fc.integer({ min: 120, max: 300 }), // Duration 2-5 hours (guaranteed wrap)
        (startA, durA) => {
          const eventA = createEvent(startA, durA);
          const eventB = createEvent(10, 20); // Early morning event (00:10 - 00:30)
          return (detector as unknown as TestableDetector).doEventsOverlap(
            eventA,
            eventB,
          );
        },
      ),
    );
  });
});

describe('HotspotDetector - Clustering', () => {
  const detector = new HotspotDetector('UTC');

  it('groups overlapping events and filters by frequency (>= 3 days)', () => {
    // Helper to make a dummy event with specific start time
    const makeEvent = (
      id: string,
      startIso: string,
      duration: number,
      startMinute: number,
    ): GlycemicEvent => ({
      id,
      type: 'hyper',
      startTime: startIso,
      endTime: DateTime.fromISO(startIso).plus({ minutes: duration }).toISO()!,
      startMinuteOfDay: startMinute,
      durationMinutes: duration,
      readings: [],
    });

    // Cluster 1: ~14:00 (840 min)
    const e1 = makeEvent('1', '2023-01-02T14:00:00Z', 60, 840); // Mon
    const e2 = makeEvent('2', '2023-01-03T14:15:00Z', 60, 855); // Tue
    const e3 = makeEvent('3', '2023-01-04T14:10:00Z', 60, 850); // Wed

    // Noise: 18:00 (1080 min)
    const e4 = makeEvent('4', '2023-01-05T18:00:00Z', 60, 1080); // Thu

    const clusters = detector.findClusters([e1, e2, e3, e4]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].events).toHaveLength(3);
    expect(clusters[0].events.map((e) => e.id)).toContain('1');
    expect(clusters[0].events.map((e) => e.id)).toContain('2');
    expect(clusters[0].events.map((e) => e.id)).toContain('3');

    // Check calculated stats
    // Avg start: (840 + 855 + 850) / 3 = 848.33
    expect(clusters[0].avgStartMinute).toBeCloseTo(848, 0);
  });
});

describe('HotspotDetector - Initialization', () => {
  it('defaults to UTC if an invalid timezone is provided', () => {
    const detector = new HotspotDetector('Mars/Phobos');
    // Access private property for verification
    expect((detector as unknown as TestableDetector).timezone).toBe('UTC');
  });

  it('accepts a valid timezone', () => {
    const detector = new HotspotDetector('America/New_York');
    expect((detector as unknown as TestableDetector).timezone).toBe(
      'America/New_York',
    );
  });
});
