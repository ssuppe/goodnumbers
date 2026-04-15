import { DateTime, Info } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import {
  GlycemicEvent,
  GlycemicCluster,
  GlucoseEntry,
} from '@goodnumbers/types';

const MIN_DURATION_MINUTES = 20;
const MAX_ENTRIES = 5000;
export const BUFFER_MINUTES = 180;

export class HotspotDetector {
  private timezone: string;

  constructor(timezone: string) {
    if (Info.isValidIANAZone(timezone)) {
      this.timezone = timezone;
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
    let startIndex = -1;

    // 0. Security: Limit input size to prevent DoS
    const limitedEntries = entries.slice(0, MAX_ENTRIES);

    // 1. Sort chronologically by timestamp
    const sorted = [...limitedEntries].sort((a, b) => a.date - b.date);

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const isTrigger =
        type === 'hyper' ? entry.sgv >= threshold : entry.sgv <= threshold;

      if (isTrigger) {
        if (startIndex === -1) {
          startIndex = i;
        }
      } else {
        if (startIndex !== -1) {
          // Sequence ended at i - 1
          this.processSequence(sorted, startIndex, i, events, type);
          startIndex = -1;
        }
      }
    }
    // Check tail
    if (startIndex !== -1) {
      this.processSequence(sorted, startIndex, sorted.length, events, type);
    }

    return events;
  }

  private processSequence(
    allEntries: GlucoseEntry[],
    startIndex: number,
    endIndex: number,
    events: GlycemicEvent[],
    type: 'hyper' | 'hypo',
  ) {
    // Core event entries (exclusive of endIndex)
    const seq = allEntries.slice(startIndex, endIndex);
    if (seq.length === 0) return;

    const first = seq[0];
    const last = seq[seq.length - 1];

    // Use dateString if available, otherwise convert timestamp
    const firstDate = first.dateString || new Date(first.date).toISOString();
    const lastDate = last.dateString || new Date(last.date).toISOString();

    const startTime = DateTime.fromISO(firstDate).setZone(this.timezone);
    const endTime = DateTime.fromISO(lastDate).setZone(this.timezone);

    // Calculate duration in minutes
    const duration = endTime.diff(startTime, 'minutes').minutes;

    if (duration >= MIN_DURATION_MINUTES) {
      // --- Calculate Buffer Indices ---
      const bufferStartTime = startTime.minus({ minutes: BUFFER_MINUTES });
      const bufferEndTime = endTime.plus({ minutes: BUFFER_MINUTES });

      // Scan backwards for start buffer
      let bufferStartIndex = startIndex;
      while (bufferStartIndex > 0) {
        const prevEntry = allEntries[bufferStartIndex - 1];
        const prevTime = DateTime.fromMillis(prevEntry.date).setZone(
          this.timezone,
        );
        if (prevTime < bufferStartTime) break;
        bufferStartIndex--;
      }

      // Scan forwards for end buffer
      let bufferEndIndex = endIndex;
      while (bufferEndIndex < allEntries.length) {
        const nextEntry = allEntries[bufferEndIndex];
        const nextTime = DateTime.fromMillis(nextEntry.date).setZone(
          this.timezone,
        );
        if (nextTime > bufferEndTime) break;
        bufferEndIndex++;
      }

      // Extract extended readings
      const extendedReadings = allEntries
        .slice(bufferStartIndex, bufferEndIndex)
        .map((e) => ({
          timestamp: e.dateString || new Date(e.date).toISOString(),
          value: e.sgv,
        }));

      events.push({
        id: uuidv4(),
        type,
        startTime: startTime.toISO()!,
        endTime: endTime.toISO()!,
        startMinuteOfDay: startTime.hour * 60 + startTime.minute,
        durationMinutes: duration,
        readings: extendedReadings,
      });
    }
  }

  public findClusters(events: GlycemicEvent[]): GlycemicCluster[] {
    const visited = new Set<string>();
    const clusters: GlycemicCluster[] = [];

    for (const event of events) {
      if (visited.has(event.id)) continue;

      // DFS to find connected component
      const component: GlycemicEvent[] = [];
      const stack = [event];
      visited.add(event.id);

      while (stack.length > 0) {
        const current = stack.pop()!;
        component.push(current);

        for (const other of events) {
          if (!visited.has(other.id) && this.doEventsOverlap(current, other)) {
            visited.add(other.id);
            stack.push(other);
          }
        }
      }

      // Filter: Must have >= 3 distinct days
      const distinctDays = new Set(
        component.map(
          (e) => DateTime.fromISO(e.startTime).setZone(this.timezone).weekday,
        ),
      );

      if (distinctDays.size >= 2) {
        clusters.push(
          this.buildClusterObject(component, Array.from(distinctDays)),
        );
      }
    }
    return clusters;
  }

  private buildClusterObject(
    events: GlycemicEvent[],
    activeDays: number[],
  ): GlycemicCluster {
    const type = events[0].type;
    const avgDuration =
      events.reduce((sum, e) => sum + e.durationMinutes, 0) / events.length;

    // Circular Mean for start times
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
    const buffer = 15; // minutes
    const aIntervals = this.getNormalizedIntervals(a);
    const bIntervals = this.getNormalizedIntervals(b);

    return aIntervals.some((intA) =>
      bIntervals.some(
        (intB) =>
          // Check overlap with buffer
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

    // If the event wraps around midnight (start + duration >= 1440)
    // Or if it ends exactly at midnight (which is 0 in modulo but 1440 in continuous time)
    // We treat it as two intervals: [start, 1440] and [0, end]
    if (start + e.durationMinutes >= 1440) {
      return [
        { start, end: 1440 },
        { start: 0, end },
      ];
    }
    return [{ start, end: start + e.durationMinutes }];
  }
}
