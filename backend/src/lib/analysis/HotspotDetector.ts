import { DateTime, Info } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import {
  GlucoseEntry,
  GlycemicEvent,
  GlycemicCluster,
} from '@goodnumbers/types';

const BUFFER_MINUTES = 180;

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
    let startIndex = -1;

    // Security: Limit processing to prevent OOM on huge datasets
    const safeEntries = entries.slice(0, 5000);

    for (let i = 0; i < safeEntries.length; i++) {
      const entry = safeEntries[i];
      const isOut =
        type === 'hyper' ? entry.sgv >= threshold : entry.sgv <= threshold;

      if (isOut) {
        if (startIndex === -1) {
          startIndex = i;
        }
      } else {
        if (startIndex !== -1) {
          this.processSequence(
            safeEntries,
            startIndex,
            i,
            type,
            threshold,
            events,
          );
          startIndex = -1;
        }
      }

      // INTEGRATED SPIKE SPLITTING:
      if (type === 'hyper' && startIndex !== -1 && i - startIndex > 2) {
        const last = safeEntries[i];
        const next = safeEntries[i + 1];
        if (next && next.sgv > last.sgv + 5 && last.sgv < threshold + 35) {
          const subSeq = safeEntries.slice(startIndex, i + 1);
          const maxBefore = Math.max(...subSeq.map((e) => e.sgv));
          if (maxBefore > last.sgv + 35) {
            this.processSequence(
              safeEntries,
              startIndex,
              i + 1,
              type,
              threshold,
              events,
            );
            startIndex = i + 1;
          }
        }
      }
    }

    // Handle trailing sequence
    if (startIndex !== -1) {
      this.processSequence(
        safeEntries,
        startIndex,
        safeEntries.length,
        type,
        threshold,
        events,
      );
    }

    return events;
  }

  private processSequence(
    allEntries: GlucoseEntry[],
    startIndex: number,
    endIndex: number,
    type: 'hyper' | 'hypo',
    threshold: number,
    events: GlycemicEvent[],
  ) {
    const seq = allEntries.slice(startIndex, endIndex);
    if (seq.length === 0) return;

    const first = seq[0];
    const last = seq[seq.length - 1];

    const firstDate = first.dateString || new Date(first.date).toISOString();
    const lastDate = last.dateString || new Date(last.date).toISOString();

    const startTime = DateTime.fromISO(firstDate, { setZone: true });
    const endTime = DateTime.fromISO(lastDate, { setZone: true });
    const duration = endTime.diff(startTime, 'minutes').minutes;

    let magnitude = 0;
    seq.forEach((e) => {
      const diff = Math.abs(e.sgv - threshold);
      if (diff > magnitude) magnitude = diff;
    });

    const MIN_DURATION = 20;
    const MIN_MAGNITUDE = 20;

    if (duration >= MIN_DURATION || magnitude >= MIN_MAGNITUDE) {
      // --- Calculate Buffer Indices ---
      const bufferStartTime = startTime.minus({ minutes: BUFFER_MINUTES });
      const bufferEndTime = endTime.plus({ minutes: BUFFER_MINUTES });

      // Scan backwards for start buffer
      let bufferStartIndex = startIndex;
      while (bufferStartIndex > 0) {
        const prevEntry = allEntries[bufferStartIndex - 1];
        const prevTime = DateTime.fromMillis(prevEntry.date); // Absolute comparison
        if (prevTime < bufferStartTime) break;
        bufferStartIndex--;
      }

      // Scan forwards for end buffer
      let bufferEndIndex = endIndex;
      while (bufferEndIndex < allEntries.length) {
        const nextEntry = allEntries[bufferEndIndex];
        const nextTime = DateTime.fromMillis(nextEntry.date); // Absolute comparison
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
        startTime: firstDate,
        endTime: lastDate,
        startMinuteOfDay: startTime.hour * 60 + startTime.minute,
        durationMinutes: duration,
        readings: extendedReadings,
      });
    }
  }

  public findClusters(events: GlycemicEvent[]): GlycemicCluster[] {
    // 1. Partition events by timezone offset
    // This ensures that different locations are analyzed independently
    const partitions = new Map<number, GlycemicEvent[]>();

    events.forEach((e) => {
      const offset = DateTime.fromISO(e.startTime, { setZone: true }).offset;
      if (!partitions.has(offset)) partitions.set(offset, []);
      partitions.get(offset)!.push(e);
    });

    const allClusters: GlycemicCluster[] = [];

    // 2. Cluster each partition independently
    partitions.forEach((partitionEvents) => {
      const visited = new Set<string>();
      const sorted = [...partitionEvents].sort(
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

        const distinctDays = new Set(
          candidate.map(
            (e) => DateTime.fromISO(e.startTime, { setZone: true }).weekday,
          ),
        );

        if (distinctDays.size >= 3) {
          candidate.forEach((e) => visited.add(e.id));
          allClusters.push(
            this.buildClusterObject(candidate, Array.from(distinctDays)),
          );
        }
      }
    });

    return allClusters;
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

    // Capture timezone metadata from the first event in the cluster
    const firstEventDate = DateTime.fromISO(events[0].startTime, {
      setZone: true,
    });

    return {
      id: uuidv4(),
      type,
      avgStartMinute: Math.round(avgStartMinute),
      avgDurationMinutes: Math.round(avgDuration),
      eventCount: events.length,
      activeDays: activeDays.sort((a, b) => a - b),
      events,
      timezone: firstEventDate.zoneName ?? undefined,
      utcOffset: firstEventDate.offset,
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
