import { ATReading } from './gn-autotune-prep.js';
import { GLUCOSE_RANGES } from './gn-constants.js';
import { PatientRange } from './gn-overview.js';

export interface OutOfRangeEpisodes {
  low_episodes: ATReading[][];
  high_episodes: ATReading[][];
}

interface TimeWindowCounts {
  counts: Map<number, { overlapCount: number; totalGlucose: number; readingCount: number }>;
}

interface SevereRange {
  startTime: number; // Minutes past midnight
  endTime: number; // Minutes past midnight
  averageGlucose: number;
  averageOverlapCount: number;
  severityScore: number; // Combined severity score
}

export function findOutOfRangeEpisodes(
  glucoseReadings: ATReading[],
  pr: PatientRange,
  min_high_duration_minutes: number = 30,
  min_low_duration_minutes: number = 15,
): OutOfRangeEpisodes {
  // Input Validation: Handle empty input array.
  if (glucoseReadings.length === 0) {
    return { low_episodes: [], high_episodes: [] };
  }

  // We *assume* glucoseReadings are sorted chronologically by 'date' (ascending).
  // This assumption is CRITICAL for correct functionality.

  const lowEpisodes: ATReading[][] = [];
  const highEpisodes: ATReading[][] = [];
  let currentLowEpisode: ATReading[] = [];
  let currentHighEpisode: ATReading[] = [];

  for (const reading of glucoseReadings) {
    const readingDate = new Date(reading.date);

    // Low Episode Check
    if (reading.glucose < GLUCOSE_RANGES.LOW) {
      currentLowEpisode.push(reading);
      if (currentHighEpisode.length > 0) {
        currentHighEpisode = [];
      }
    } else {
      if (currentLowEpisode.length > 0) {
        const firstReading = currentLowEpisode[0];
        const firstReadingDate = new Date(firstReading.date);
        const durationMinutes = (readingDate.getTime() - firstReadingDate.getTime()) / (60 * 1000);

        if (durationMinutes >= min_low_duration_minutes) {
          lowEpisodes.push(currentLowEpisode);
        }
        currentLowEpisode = [];
      }
    }

    // High Episode Check
    if (reading.glucose > pr.target_high) {
      currentHighEpisode.push(reading);
      if (currentLowEpisode.length > 0) {
        currentLowEpisode = [];
      }
    } else {
      if (currentHighEpisode.length > 0) {
        const firstReading = currentHighEpisode[0];
        const firstReadingDate = new Date(firstReading.date);
        const durationMinutes = (readingDate.getTime() - firstReadingDate.getTime()) / (60 * 1000);

        if (durationMinutes >= min_high_duration_minutes) {
          highEpisodes.push(currentHighEpisode);
        }
        currentHighEpisode = [];
      }
    }
  }

  // Handle Trailing Episodes
  if (currentLowEpisode.length > 0) {
    const firstReading = currentLowEpisode[0];
    const firstReadingDate = new Date(firstReading.date);
    const lastReading = currentLowEpisode[currentLowEpisode.length - 1];
    const lastReadingDate = new Date(lastReading.date);
    const durationMinutes = (lastReadingDate.getTime() - firstReadingDate.getTime()) / (60 * 1000);
    if (durationMinutes >= min_low_duration_minutes) {
      lowEpisodes.push(currentLowEpisode);
    }
  }

  if (currentHighEpisode.length > 0) {
    const firstReading = currentHighEpisode[0];
    const firstReadingDate = new Date(firstReading.date);
    const lastReading = currentHighEpisode[currentHighEpisode.length - 1];
    const lastReadingDate = new Date(lastReading.date);
    const durationMinutes = (lastReadingDate.getTime() - firstReadingDate.getTime()) / (60 * 1000);
    if (durationMinutes >= min_high_duration_minutes) {
      highEpisodes.push(currentHighEpisode);
    }
  }

  return { low_episodes: lowEpisodes, high_episodes: highEpisodes };
}

/**
 * Analyzes a set of out-of-range glucose episodes to identify recurring patterns of lows
 * across multiple days, using a sliding window approach.
 *
 * @param outOfRangeEpisodes - An object containing arrays of low and high glucose episodes.
 *                              Only low episodes are used in this analysis.
 * @param windowSizeMinutes - The size of the sliding window in minutes (default: 90).
 * @param stepSizeMinutes - The step size for the sliding window in minutes (default: 30).
 *
 * @returns A TimeWindowCounts object, where the keys are the start times of the sliding
 *          windows (in minutes past midnight), and the values are objects containing:
 *          - overlapCount: The number of low episodes overlapping with that window.
 *          - totalGlucose: The sum of all glucose readings within the overlapping episodes.
 *          - readingCount: The total number of glucose readings within the overlapping episodes.
 */
function analyzeRecurringLowEpisodes(
  outOfRangeEpisodes: OutOfRangeEpisodes,
  windowSizeMinutes: number = 90,
  stepSizeMinutes: number = 30,
): TimeWindowCounts {
  const timeWindowCounts: TimeWindowCounts = {
    counts: new Map<number, { overlapCount: number; totalGlucose: number; readingCount: number }>(),
  };

  for (const lowEpisode of outOfRangeEpisodes.low_episodes) {
    if (lowEpisode.length === 0) {
      continue;
    }

    const firstReading = lowEpisode[0];
    const firstReadingDate = new Date(firstReading.date);
    const lastReading = lowEpisode[lowEpisode.length - 1];
    const lastReadingDate = new Date(lastReading.date);

    const episodeStartMinutes = getMinutesPastMidnight(firstReadingDate);
    const episodeEndMinutes = getMinutesPastMidnight(lastReadingDate);

    for (
      let currentTimeMinutes = 0;
      currentTimeMinutes <= 24 * 60 - windowSizeMinutes;
      currentTimeMinutes += stepSizeMinutes
    ) {
      const windowStartMinutes = currentTimeMinutes;
      const windowEndMinutes = currentTimeMinutes + windowSizeMinutes;

      if (timesOverlap(episodeStartMinutes, episodeEndMinutes, windowStartMinutes, windowEndMinutes)) {
        const glucoseSum = sumOfGlucoseReadings(lowEpisode, windowStartMinutes, windowEndMinutes);
        const numReadings = numberOfGlucoseReadings(lowEpisode, windowStartMinutes, windowEndMinutes);

        if (timeWindowCounts.counts.has(windowStartMinutes)) {
          const existingData = timeWindowCounts.counts.get(windowStartMinutes)!;
          timeWindowCounts.counts.set(windowStartMinutes, {
            overlapCount: existingData.overlapCount + 1,
            totalGlucose: existingData.totalGlucose + glucoseSum,
            readingCount: existingData.readingCount + numReadings,
          });
        } else {
          timeWindowCounts.counts.set(windowStartMinutes, {
            overlapCount: 1,
            totalGlucose: glucoseSum,
            readingCount: numReadings,
          });
        }
      }
    }
  }

  return timeWindowCounts;
}

/**
 * Determines the most severe time ranges based on the output of `analyzeRecurringLowEpisodes`.
 * Severity is determined by a combination of overlap frequency, average glucose levels,
 * and duration of consecutive overlaps.
 *
 * @param timeWindowCounts - The output from `analyzeRecurringLowEpisodes`, containing
 *                           overlap counts and glucose data for each sliding window position.
 * @param windowSizeMinutes - The size of the sliding window used in `analyzeRecurringLowEpisodes`.
 * @param stepSizeMinutes   - The step size used in `analyzeRecurringLowEpisodes`.
 *
 * @returns An array of `SevereRange` objects, sorted in descending order of severity.
 *          Each `SevereRange` object represents a contiguous time range with a high
 *          degree of overlapping low episodes and includes:
 *          - startTime: The start time of the range (minutes past midnight).
 *          - endTime: The end time of the range (minutes past midnight).
 *          - averageGlucose: The average glucose level during the overlapping episodes.
 *          - averageOverlapCount: The average number of overlapping episodes within the range.
 *          - severityScore: A combined score representing the overall severity of the range.
 */
function determineSevereRanges(
  timeWindowCounts: TimeWindowCounts,
  windowSizeMinutes: number,
  stepSizeMinutes: number,
): SevereRange[] {
  const windowAverages: Map<number, number> = new Map();
  for (const [windowStartMinutes, data] of timeWindowCounts.counts) {
    const averageGlucose = data.readingCount > 0 ? data.totalGlucose / data.readingCount : 0; // Avoid division by zero
    windowAverages.set(windowStartMinutes, averageGlucose);
  }

  const overlapCounts = Array.from(timeWindowCounts.counts.values()).map((d) => d.overlapCount);
  const averageOverlapCount = calculateAverage(overlapCounts);

  const candidateRanges: number[] = [];
  for (const [windowStartMinutes, data] of timeWindowCounts.counts) {
    if (data.overlapCount > averageOverlapCount) {
      candidateRanges.push(windowStartMinutes);
    }
  }

  candidateRanges.sort((a, b) => a - b); //Ensure candidateRanges are sorted

  const groupedRanges: { start: number; end: number }[] = [];
  let currentGroup: { start: number; end: number } | null = null;

  for (const windowStartMinutes of candidateRanges) {
    if (currentGroup === null) {
      currentGroup = { start: windowStartMinutes, end: windowStartMinutes + windowSizeMinutes };
    } else if (windowStartMinutes - currentGroup.end <= stepSizeMinutes * 2) {
      currentGroup.end = windowStartMinutes + windowSizeMinutes;
    } else {
      groupedRanges.push(currentGroup);
      currentGroup = { start: windowStartMinutes, end: windowStartMinutes + windowSizeMinutes };
    }
  }
  if (currentGroup !== null) {
    groupedRanges.push(currentGroup);
  }

  const severeRanges: SevereRange[] = [];
  for (const group of groupedRanges) {
    const windowsWithinRange: { start: number; count: number; avgGlucose: number }[] = [];
    for (const [windowStart, data] of timeWindowCounts.counts) {
      if (windowStart >= group.start && windowStart + windowSizeMinutes <= group.end) {
        windowsWithinRange.push({
          start: windowStart,
          count: data.overlapCount,
          avgGlucose: windowAverages.get(windowStart)!,
        });
      }
    }

    let totalOverlapCount = 0;
    let totalWeightedGlucose = 0;
    let totalWeights = 0;

    for (const window of windowsWithinRange) {
      totalOverlapCount += window.count;
      totalWeightedGlucose += window.avgGlucose * window.count;
      totalWeights += window.count;
    }

    const averageOverlapCountInRange =
      windowsWithinRange.length > 0 ? totalOverlapCount / windowsWithinRange.length : 0;
    const averageGlucoseInRange = totalWeights > 0 ? totalWeightedGlucose / totalWeights : 0; //Avoid division by zero

    // Normalize (adjust as needed)
    const normalizedOverlap = averageOverlapCountInRange / 7; // Assuming 7 days of data
    let normalizedGlucose = (180 - averageGlucoseInRange) / 180;
    if (normalizedGlucose < 0) {
      normalizedGlucose = 0;
    }
    // Combine (adjust weights as needed)
    const severityScore = 0.6 * normalizedOverlap + 0.4 * normalizedGlucose;

    severeRanges.push({
      startTime: group.start,
      endTime: group.end,
      averageGlucose: averageGlucoseInRange,
      averageOverlapCount: averageOverlapCountInRange,
      severityScore: severityScore,
    });
  }

  severeRanges.sort((a, b) => b.severityScore - a.severityScore); // Sort descending by severity

  return severeRanges;
}

// Helper Functions

/**
 * Calculates the number of minutes past midnight for a given Date object.
 *
 * @param date - The Date object.
 * @returns The number of minutes past midnight.
 */
function getMinutesPastMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Checks if two time ranges overlap.
 *
 * @param time1Start - The start time of the first range (in minutes past midnight).
 * @param time1End - The end time of the first range (in minutes past midnight).
 * @param time2Start - The start time of the second range (in minutes past midnight).
 * @param time2End - The end time of the second range (in minutes past midnight).
 *
 * @returns True if the ranges overlap, false otherwise.
 */
function timesOverlap(time1Start: number, time1End: number, time2Start: number, time2End: number): boolean {
  const latestStart = Math.max(time1Start, time2Start);
  const earliestEnd = Math.min(time1End, time2End);
  return latestStart <= earliestEnd;
}

/**
 * Calculates the sum of glucose readings within a given low episode that fall
 * within a specified time window.
 *
 * @param episode - An array of ATReading objects representing a low episode.
 * @param windowStartMinutes - The start time of the window (in minutes past midnight).
 * @param windowEndMinutes - The end time of the window (in minutes past midnight).
 *
 * @returns The sum of glucose values for readings within the window.
 */
function sumOfGlucoseReadings(episode: ATReading[], windowStartMinutes: number, windowEndMinutes: number): number {
  let total = 0;
  for (const reading of episode) {
    const readingTimeMinutes = getMinutesPastMidnight(new Date(reading.date));
    if (readingTimeMinutes >= windowStartMinutes && readingTimeMinutes <= windowEndMinutes) {
      total += reading.glucose;
    }
  }
  return total;
}

/**
 * Counts the number of glucose readings within a given low episode that fall
 * within a specified time window.
 *
 * @param episode - An array of ATReading objects representing a low episode.
 * @param windowStartMinutes - The start time of the window (in minutes past midnight).
 * @param windowEndMinutes - The end time of the window (in minutes past midnight).
 *
 * @returns The number of glucose readings within the window.
 */
function numberOfGlucoseReadings(episode: ATReading[], windowStartMinutes: number, windowEndMinutes: number): number {
  let count = 0;
  for (const reading of episode) {
    const readingTimeMinutes = getMinutesPastMidnight(new Date(reading.date));
    if (readingTimeMinutes >= windowStartMinutes && readingTimeMinutes <= windowEndMinutes) {
      count++;
    }
  }
  return count;
}

/**
 * Calculates the average of an array of numbers.
 *
 * @param numbers - The array of numbers.
 * @returns The average of the numbers, or 0 if the array is empty.
 */
function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return sum / numbers.length;
}
