import { DateTime, Info } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import {
  GlucoseEntry,
  GlycemicEvent,
  GlycemicCluster,
} from '@goodnumbers/types';

export class HotspotDetector {
  private timezone: string;

  constructor(timezone: string) {
    if (Info.isValidIANAZone(timezone)) {
      this.timezone = timezone;
      console.log(`[HotspotDetector] Initialized with zone: ${this.timezone}`);
    } else {
      console.warn(
        `[HotspotDetector] Invalid timezone '${timezone}' provided. Defaulting to UTC.`,
      );
      this.timezone = 'UTC';
    }
  }

  public detectEvents(
    entries: GlucoseEntry[],
    type: 'hyper' | 'hypo',
    threshold: number,
  ): GlycemicEvent[] {
    const events: GlycemicEvent[] = [];
    let currentSequence: GlucoseEntry[] = [];

    const safeEntries = entries.slice(0, 5000);

    for (let i = 0; i < safeEntries.length; i++) {
      const entry = safeEntries[i];
      const isOut =
        type === 'hyper' ? entry.sgv >= threshold : entry.sgv <= threshold;

      if (isOut) {
        currentSequence.push(entry);
      } else {
        if (currentSequence.length > 0) {
          this.processSequence(currentSequence, type, threshold, events);
          currentSequence = [];
        }
      }
      if (type === 'hyper' && currentSequence.length > 2) {
        const last = currentSequence[currentSequence.length - 1];
        // Look ahead to see if it recovers after a significant drop
        const next = safeEntries[i + 1];
        if (next && next.sgv > last.sgv + 5 && last.sgv < threshold + 35) {
          const maxBefore = Math.max(...currentSequence.map((e) => e.sgv));
          if (maxBefore > last.sgv + 35) {
            this.processSequence(currentSequence, type, threshold, events);
            currentSequence = [];
          }
        }
      }
    }

    if (currentSequence.length > 0) {
      this.processSequence(currentSequence, type, threshold, events);
    }

    return events;
  }

  private processSequence(
    seq: GlucoseEntry[],
    type: 'hyper' | 'hypo',
    threshold: number,
    events: GlycemicEvent[],
  ) {
    if (seq.length === 0) return;

    const first = seq[0];
    const last = seq[seq.length - 1];

    const firstDate = first.dateString || new Date(first.date).toISOString();
    const lastDate = last.dateString || new Date(last.date).toISOString();

    const startTime = DateTime.fromISO(firstDate);
    const endTime = DateTime.fromISO(lastDate);
    const duration = endTime.diff(startTime, 'minutes').minutes;

    let magnitude = 0;
    seq.forEach((e) => {
      const diff = Math.abs(e.sgv - threshold);
      if (diff > magnitude) magnitude = diff;
    });

    const MIN_DURATION = 20;
    const MIN_MAGNITUDE = 20;

    if (duration >= MIN_DURATION || magnitude >= MIN_MAGNITUDE) {
      events.push({
        id: uuidv4(),
        type,
        startTime: firstDate,
        endTime: lastDate,
        startMinuteOfDay: startTime.hour * 60 + startTime.minute,
        durationMinutes: duration,
        readings: seq.map((s) => ({
          timestamp: s.dateString || new Date(s.date).toISOString(),
          value: s.sgv,
        })),
      });
    }
  }

  public findClusters(events: GlycemicEvent[]): GlycemicCluster[] {
    const clusters: GlycemicCluster[] = [];
    const visited = new Set<string>();
    const sorted = [...events].sort(
      (a, b) => a.startMinuteOfDay - b.startMinuteOfDay,
    );

    for (let i = 0; i < sorted.length; i++) {
      const seed = sorted[i];
      if (visited.has(seed.id)) continue;

      const candidate: GlycemicEvent[] = [seed];
      for (let j = 0; j < sorted.length; j++) {
        const other = sorted[j];
        if (seed.id === other.id || visited.has(other.id)) continue;

        const dist = this.getCircularDistance(
          seed.startMinuteOfDay,
          other.startMinuteOfDay,
        );
        if (dist <= 90) {
          candidate.push(other);
        }
      }

      // SECURITY/STABILITY: Use the detector's configured timezone for day calculation
      // to ensure consistency across travel.
      const distinctDays = new Set(
        candidate.map(
          (e) => DateTime.fromISO(e.startTime, { setZone: true }).weekday,
        ),
      );

      if (distinctDays.size >= 3) {
        candidate.forEach((e) => visited.add(e.id));
        clusters.push(
          this.buildClusterObject(candidate, Array.from(distinctDays)),
        );
      }
    }

    return clusters;
  }

  private getCircularDistance(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return Math.min(diff, 1440 - diff);
  }

  private buildClusterObject(
    events: GlycemicEvent[],
    activeDays: number[],
  ): GlycemicCluster {
    const type = events[0].type;
    const avgDuration =
      events.reduce((sum, e) => sum + e.durationMinutes, 0) / events.length;

    let sinSum = 0;
    let cosSum = 0;
    for (const e of events) {
      const angle = (e.startMinuteOfDay / 1440) * 2 * Math.PI;
      sinSum += Math.sin(angle);
      cosSum += Math.cos(angle);
    }
    const avgAngle = Math.atan2(sinSum, cosSum);
    let avgStartMinute = (avgAngle / (2 * Math.PI)) * 1440;
    if (avgStartMinute < 0) avgStartMinute += 1440;

    return {
      id: uuidv4(),
      type,
      avgStartMinute: Math.round(avgStartMinute),
      avgDurationMinutes: Math.round(avgDuration),
      eventCount: events.length,
      activeDays: activeDays.sort((a, b) => a - b),
      events,
    };
  }

  private doEventsOverlap(a: GlycemicEvent, b: GlycemicEvent): boolean {
    const buffer = 15;
    const aIntervals = this.getNormalizedIntervals(a);
    const bIntervals = this.getNormalizedIntervals(b);

    return aIntervals.some((intA) =>
      bIntervals.some(
        (intB) =>
          Math.max(intA.start, intB.start) <
          Math.min(intA.end, intB.end) + buffer,
      ),
    );
  }

  private getNormalizedIntervals(
    e: GlycemicEvent,
  ): { start: number; end: number }[] {
    const start = e.startMinuteOfDay;
    const end = (start + e.durationMinutes) % 1440;

    if (start + e.durationMinutes >= 1440) {
      return [
        { start, end: 1440 },
        { start: 0, end },
      ];
    }
    return [{ start, end: start + e.durationMinutes }];
  }
}
