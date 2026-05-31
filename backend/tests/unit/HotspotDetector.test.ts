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

  it('filters out short spikes (< 20 mins) with low magnitude', () => {
    // 4 entries * 5 mins = 15 minutes duration (0, 5, 10, 15)
    // Value 185 is only 5mg/dL above threshold (below 20 threshold)
    const entries = generateSequence('2023-01-01T12:00:00Z', 4, 185);

    const events = detector.detectEvents(entries, 'hyper', 180);

    expect(events).toHaveLength(0);
  });

  it('keeps short spikes (< 20 mins) if magnitude is high (>= 20 mg/dL)', () => {
    // 15 mins duration but reaches 210 (30mg/dL magnitude)
    const entries = generateSequence('2023-01-01T12:00:00Z', 4, 210);

    const events = detector.detectEvents(entries, 'hyper', 180);

    expect(events).toHaveLength(1);
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
    const lastNormalTime = DateTime.fromISO('2023-01-01T00:00:00Z').plus({
      minutes: 5000 * 5,
    });
    const hyper = generateSequence(lastNormalTime.toISO()!, 10, 200);

    const entries = [...normal, ...hyper];
    const events = detector.detectEvents(entries, 'hyper', 180);

    expect(events).toHaveLength(0);
  });
});

describe('HotspotDetector - Overlap Logic', () => {
  const detector = new HotspotDetector('UTC');

  const createEvent = (
    startMinute: number,
    duration: number,
  ): GlycemicEvent => ({
    id: 'test-id',
    type: 'hyper',
    startMinuteOfDay: startMinute,
    durationMinutes: duration,
    startTime: '2023-01-01T00:00:00Z',
    endTime: '2023-01-01T00:00:00Z',
    readings: [],
  });

  it('detects overlap between intersecting intervals', () => {
    const eventA = createEvent(840, 60); // 14:00 - 15:00
    const eventB = createEvent(870, 60); // 14:30 - 15:30

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
    const eventB = createEvent(910, 60); // 15:10 - 16:10

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
    const e4 = makeEvent('4', '2023-01-05T18:00:00Z', 60, 1080); // Thu

    const clusters = detector.findClusters([e1, e2, e3, e4]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].events).toHaveLength(3);
    expect(clusters[0].avgStartMinute).toBeCloseTo(848, 0);
  });

  it('groups clusters correctly when traveling (mixed timezones)', () => {
    const makeEvent = (
      id: string,
      iso: string,
      startMin: number,
    ): GlycemicEvent => ({
      id,
      type: 'hyper',
      startTime: iso,
      endTime: iso,
      startMinuteOfDay: startMin,
      durationMinutes: 60,
      readings: [],
    });

    const e1 = makeEvent('1', '2023-01-02T13:00:00-04:00', 780); // NYC
    const e2 = makeEvent('2', '2023-01-03T13:05:00-04:00', 785); // NYC
    const e3 = makeEvent('3', '2023-01-04T13:00:00+01:00', 780); // London
    const e4 = makeEvent('4', '2023-01-05T13:10:00+01:00', 790); // London

    const clusters = detector.findClusters([e1, e2, e3, e4]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].events).toHaveLength(4);
  });

  it('should NOT merge distinct morning and evening patterns (Chain Reaction Test)', () => {
    const makeEvent = (
      id: string,
      start: number,
      duration: number,
      day: number,
    ): GlycemicEvent => {
      // Use unambiguously far apart dates to avoid weekday rollover issues
      const dt = DateTime.fromISO(`2023-01-0${day}T00:00:00Z`)
        .setZone('UTC')
        .plus({ minutes: start });
      return {
        id,
        type: 'hyper',
        startTime: dt.toISO()!,
        endTime: dt.plus({ minutes: duration }).toISO()!,
        startMinuteOfDay: start,
        durationMinutes: duration,
        readings: [],
      };
    };

    // Evening: 18:00 (1080)
    const e1 = makeEvent('E1', 1080, 60, 1); // Sun
    const e2 = makeEvent('E2', 1090, 60, 2); // Mon
    const e3 = makeEvent('E3', 1085, 60, 3); // Tue

    // Morning: 04:00 (240) - 10 hours apart
    const m1 = makeEvent('M1', 240, 60, 4); // Wed
    const m2 = makeEvent('M2', 250, 60, 5); // Thu
    const m3 = makeEvent('M3', 245, 60, 6); // Fri

    const clusters = detector.findClusters([e1, e2, e3, m1, m2, m3]);

    expect(clusters).toHaveLength(2);
    expect(clusters.some((c) => c.avgStartMinute > 1000)).toBe(true);
    expect(clusters.some((c) => c.avgStartMinute < 300)).toBe(true);
  });
});

describe('HotspotDetector - Initialization', () => {
  it('defaults to UTC if an invalid timezone is provided', () => {
    const detector = new HotspotDetector('Mars/Phobos');
    expect((detector as unknown as TestableDetector).timezone).toBe('UTC');
  });

  it('accepts a valid timezone', () => {
    const detector = new HotspotDetector('America/New_York');
    expect((detector as unknown as TestableDetector).timezone).toBe(
      'America/New_York',
    );
  });
});
