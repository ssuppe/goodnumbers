import { AutotunePreppedData, GlucoseDatum, CSFGlucoseDatum, CRDatum } from '../oref0-autotune/gn-autotune-prep';
import { PatientRange } from '../oref0-autotune/gn-overview';

// Define the simplified event types
export enum GlycemicEventType {
  HYPOGLYCEMIA = 'HYPOGLYCEMIA', // bg < 70
  HYPERGLYCEMIA = 'HYPERGLYCEMIA', // bg > 180
}

// Define fixed thresholds for glycemic events
export const GLYCEMIC_THRESHOLDS = {
  HYPO_THRESHOLD: 70, // mg/dL (patient_range.target_low)
  HIGH_THRESHOLD: 180, // mg/dL (patient_range.very_high)
};

// Define thresholds for hysteresis (to prevent event "fluttering")
export const HYSTERESIS_THRESHOLDS = {
  EXIT_HYPO: 80, // mg/dL (must be > HYPO_THRESHOLD)
  EXIT_HIGH: 170, // mg/dL (must be < HIGH_THRESHOLD)
};

// Define minimum duration and gap thresholds
export const MIN_EVENT_DURATION_MINUTES = 15; // Minimum duration to record an event
export const MAX_ALLOWABLE_GAP_MINUTES = 15; // Maximum gap between readings to consider event continuous

// Define the structure of a glycemic event as described in the PRD
export interface GlycemicEvent {
  event_type: GlycemicEventType;
  start_timestamp: string;
  end_timestamp: string;
  duration_minutes: number;
  extreme_bg_mgdl: number;
}

/**
 * Merges glucose data from different sources and sorts by timestamp
 * @param data - AutotunePreppedData containing different sources of glucose data
 * @returns Array of merged and sorted glucose data
 */
export function mergeGlucoseData(data: AutotunePreppedData): GlucoseDatum[] {
  // Combine all glucose data sources
  const combinedData: GlucoseDatum[] = [...data.CSFGlucoseData, ...data.ISFGlucoseData, ...data.basalGlucoseData];

  // Sort by timestamp
  return combinedData.sort((a, b) => {
    return new Date(a.dateString).getTime() - new Date(b.dateString).getTime();
  });
}

/**
 * Calculates the duration in minutes between two ISO timestamps
 * @param startTime - Start timestamp in ISO format
 * @param endTime - End timestamp in ISO format
 * @returns Duration in minutes
 */
function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.round((end - start) / (60 * 1000));
}

/**
 * Finds the extreme glucose value in a specific period
 * @param data - Array of glucose data
 * @param startIndex - Start index in the array
 * @param endIndex - End index in the array
 * @param eventType - The type of glycemic event being evaluated
 * @returns The extreme value (minimum for hypo events, maximum for high events)
 */
function findExtremeBg(
  data: GlucoseDatum[],
  startIndex: number,
  endIndex: number,
  eventType: GlycemicEventType,
): number {
  // Determine if we're looking for minimum (hypo events) or maximum (high events)
  const isHypo = eventType === GlycemicEventType.HYPOGLYCEMIA;
  let extremeValue = isHypo ? Number.MAX_VALUE : Number.MIN_VALUE;

  for (let i = startIndex; i <= endIndex; i++) {
    const bg = data[i].glucose;
    if (isHypo) {
      extremeValue = Math.min(extremeValue, bg);
    } else {
      extremeValue = Math.max(extremeValue, bg);
    }
  }

  return extremeValue;
}

/**
 * Records a glycemic event if it meets the minimum duration criteria
 * @param mergedData - Array of merged glucose data
 * @param startIndex - Start index of the event in the array
 * @param endIndex - End index of the event in the array
 * @param eventType - The type of glycemic event
 * @param eventsList - Array to store detected events
 * @param minDuration - Minimum duration required to record an event (minutes)
 * @returns Boolean indicating if an event was recorded
 */
function recordEventIfNeeded(
  mergedData: GlucoseDatum[],
  startIndex: number,
  endIndex: number,
  eventType: GlycemicEventType,
  eventsList: GlycemicEvent[],
  minDuration: number,
): boolean {
  // Validate indices
  if (startIndex < 0 || endIndex < startIndex || startIndex >= mergedData.length || endIndex >= mergedData.length) {
    return false;
  }

  // Calculate actual duration of the event
  const actualDuration = calculateDurationMinutes(mergedData[startIndex].dateString, mergedData[endIndex].dateString);

  // Only record events that meet the minimum duration requirement
  if (actualDuration >= minDuration) {
    // Find the extreme BG value during the event
    const extremeValue = findExtremeBg(mergedData, startIndex, endIndex, eventType);

    // Create and record the event
    const event: GlycemicEvent = {
      event_type: eventType,
      start_timestamp: mergedData[startIndex].dateString,
      end_timestamp: mergedData[endIndex].dateString,
      duration_minutes: actualDuration,
      extreme_bg_mgdl: extremeValue,
    };

    eventsList.push(event);
    return true;
  }

  return false;
}

/**
 * Detects glycemic excursion events based on simplified criteria
 * @param data - AutotunePreppedData containing the glucose data
 * @param patientRange - Patient-specific range definitions (only using target_low and very_high)
 * @returns Array of detected glycemic events
 */
export function detectGlycemicEvents(data: AutotunePreppedData, patientRange: PatientRange): GlycemicEvent[] {
  // --- Configuration ---
  // Entry thresholds - simplified to use patient_range.target_low and patient_range.very_high
  const HYPO_THRESHOLD = patientRange.target_low; // Always 70 mg/dL
  const HIGH_THRESHOLD = patientRange.very_high; // Always 180 mg/dL

  // Exit thresholds (with hysteresis)
  const EXIT_HYPO = HYSTERESIS_THRESHOLDS.EXIT_HYPO;
  const EXIT_HIGH = HYSTERESIS_THRESHOLDS.EXIT_HIGH;

  // --- Initialization ---
  const mergedData = mergeGlucoseData(data);
  const events: GlycemicEvent[] = [];

  // Need at least 2 points to calculate duration
  if (mergedData.length < 2) {
    return events;
  }

  let currentEventType: GlycemicEventType | null = null;
  let eventStartIndex = -1;
  let consecutiveCount = 0;

  // --- Main Loop ---
  for (let i = 0; i < mergedData.length; i++) {
    const currentDatum = mergedData[i];
    const bg = currentDatum.glucose;
    const currentTime = new Date(currentDatum.dateString).getTime();

    // Check for data gap before processing the point
    if (i > 0) {
      const previousDatum = mergedData[i - 1];
      const previousTime = new Date(previousDatum.dateString).getTime();
      const timeDiffMinutes = (currentTime - previousTime) / (60 * 1000);

      // If there's a significant gap, finalize any ongoing event
      if (timeDiffMinutes > MAX_ALLOWABLE_GAP_MINUTES) {
        if (currentEventType !== null) {
          recordEventIfNeeded(mergedData, eventStartIndex, i - 1, currentEventType, events, MIN_EVENT_DURATION_MINUTES);
        }
        // Reset state after the gap
        currentEventType = null;
        eventStartIndex = -1;
        consecutiveCount = 0;
      }
    }

    // Store state before potential changes
    const previousEventType = currentEventType;

    // --- State Machine Logic ---
    // CASE 1: Event is currently ongoing
    if (currentEventType !== null) {
      let eventEnded = false;
      let switchedType = false;

      // Check for continuation or event end with simplified logic
      if (currentEventType === GlycemicEventType.HYPOGLYCEMIA) {
        if (bg < EXIT_HYPO) {
          // Continue current hypo event
          consecutiveCount++;
        } else {
          // BG crossed exit threshold
          eventEnded = true;
        }
      } else if (currentEventType === GlycemicEventType.HYPERGLYCEMIA) {
        if (bg > EXIT_HIGH) {
          // Continue current high event
          consecutiveCount++;
        } else {
          // BG crossed exit threshold
          eventEnded = true;
        }
      }

      // If event didn't continue, it has ended
      if (eventEnded) {
        recordEventIfNeeded(mergedData, eventStartIndex, i - 1, previousEventType!, events, MIN_EVENT_DURATION_MINUTES);
        currentEventType = null;
        eventStartIndex = -1;
        consecutiveCount = 0;
      }

      // Check if BG jumped directly into a different category
      // Only check if event didn't just end
      if (currentEventType !== null && !eventEnded) {
        let newEventType: GlycemicEventType | null = null;

        // Check for switching between hypoglycemia and hyperglycemia
        if (bg < HYPO_THRESHOLD && currentEventType === GlycemicEventType.HYPERGLYCEMIA) {
          newEventType = GlycemicEventType.HYPOGLYCEMIA;
        } else if (bg > HIGH_THRESHOLD && currentEventType === GlycemicEventType.HYPOGLYCEMIA) {
          newEventType = GlycemicEventType.HYPERGLYCEMIA;
        }

        if (newEventType !== null) {
          // Finalize the previous event
          recordEventIfNeeded(mergedData, eventStartIndex, i - 1, currentEventType, events, MIN_EVENT_DURATION_MINUTES);
          // Start the new event
          currentEventType = newEventType;
          eventStartIndex = i;
          consecutiveCount = 1;
          switchedType = true;
        }
      }
    }

    // CASE 2: No event currently ongoing
    if (currentEventType === null) {
      if (bg < HYPO_THRESHOLD) {
        currentEventType = GlycemicEventType.HYPOGLYCEMIA;
        eventStartIndex = i;
        consecutiveCount = 1;
      } else if (bg > HIGH_THRESHOLD) {
        currentEventType = GlycemicEventType.HYPERGLYCEMIA;
        eventStartIndex = i;
        consecutiveCount = 1;
      }
      // Else: BG is in target range, do nothing
    }
  }

  // --- End of Data Handling ---
  // Check if there's an ongoing event at the end of the data
  if (currentEventType !== null) {
    recordEventIfNeeded(
      mergedData,
      eventStartIndex,
      mergedData.length - 1,
      currentEventType,
      events,
      MIN_EVENT_DURATION_MINUTES,
    );
  }

  return events;
}
