import { AutotunePreppedData, GlucoseDatum, CSFGlucoseDatum, CRDatum } from '../oref0-autotune/gn-autotune-prep';

// Define the event types as specified in the PRD
export enum GlycemicEventType {
  SEVERE_HYPOGLYCEMIA = 'SEVERE_HYPOGLYCEMIA',
  HYPOGLYCEMIA = 'HYPOGLYCEMIA',
  HYPERGLYCEMIA = 'HYPERGLYCEMIA',
}

// Define thresholds for the different event types
export const GLYCEMIC_THRESHOLDS = {
  SEVERE_HYPO_THRESHOLD: 53, // mg/dL
  HYPO_THRESHOLD: 70, // mg/dL
  HYPER_THRESHOLD: 180, // mg/dL
};

// Define the minimum duration required to classify an event (in minutes)
export const MIN_EVENT_DURATION_MINUTES = 5;

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
 * @param isHypo - Boolean indicating if looking for minimum (true) or maximum (false)
 * @returns The extreme value (minimum for hypo, maximum for hyper)
 */
function findExtremeBg(data: GlucoseDatum[], startIndex: number, endIndex: number, isHypo: boolean): number {
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
 * Detects glycemic excursion events based on the criteria specified in the PRD
 * @param data - AutotunePreppedData containing the glucose data
 * @returns Array of detected glycemic events
 */
export function detectGlycemicEvents(data: AutotunePreppedData): GlycemicEvent[] {
  const mergedData = mergeGlucoseData(data);
  const events: GlycemicEvent[] = [];

  // Minimum consecutive readings required to classify an event (assuming 5-minute intervals)
  const MIN_CONSECUTIVE_READINGS = 3;

  let currentEventType: GlycemicEventType | null = null;
  let eventStartIndex = -1;
  let consecutiveCount = 0;

  // Iterate through the merged data to detect events
  for (let i = 0; i < mergedData.length; i++) {
    const bg = mergedData[i].glucose;

    // Check for severe hypoglycemia
    if (bg <= GLYCEMIC_THRESHOLDS.SEVERE_HYPO_THRESHOLD) {
      if (currentEventType === null || currentEventType === GlycemicEventType.HYPOGLYCEMIA) {
        // Start a new event or upgrade from hypoglycemia
        if (currentEventType === GlycemicEventType.HYPOGLYCEMIA) {
          // Don't reset the start index or consecutive count as we're upgrading an existing event
        } else {
          eventStartIndex = i;
          consecutiveCount = 1;
        }
        currentEventType = GlycemicEventType.SEVERE_HYPOGLYCEMIA;
      } else if (currentEventType === GlycemicEventType.SEVERE_HYPOGLYCEMIA) {
        // Continue the current severe hypo event
        consecutiveCount++;
      } else {
        // Coming from a hyperglycemia event, reset and start new
        eventStartIndex = i;
        consecutiveCount = 1;
        currentEventType = GlycemicEventType.SEVERE_HYPOGLYCEMIA;
      }
    }
    // Check for hypoglycemia
    else if (bg < GLYCEMIC_THRESHOLDS.HYPO_THRESHOLD) {
      if (currentEventType === null) {
        // Start a new hypoglycemia event
        eventStartIndex = i;
        consecutiveCount = 1;
        currentEventType = GlycemicEventType.HYPOGLYCEMIA;
      } else if (currentEventType === GlycemicEventType.HYPOGLYCEMIA) {
        // Continue the current hypo event
        consecutiveCount++;
      } else if (currentEventType === GlycemicEventType.SEVERE_HYPOGLYCEMIA) {
        // Coming out of severe hypo, but still in hypo range
        // Keep the severe hypo classification and continue counting
        consecutiveCount++;
      } else {
        // Coming from a hyperglycemia event, reset and start new
        eventStartIndex = i;
        consecutiveCount = 1;
        currentEventType = GlycemicEventType.HYPOGLYCEMIA;
      }
    }
    // Check for hyperglycemia
    else if (bg > GLYCEMIC_THRESHOLDS.HYPER_THRESHOLD) {
      if (currentEventType === null) {
        // Start a new hyperglycemia event
        eventStartIndex = i;
        consecutiveCount = 1;
        currentEventType = GlycemicEventType.HYPERGLYCEMIA;
      } else if (currentEventType === GlycemicEventType.HYPERGLYCEMIA) {
        // Continue the current hyper event
        consecutiveCount++;
      } else {
        // Coming from a hypo event, record it if it meets criteria and start a new hyper event
        if (consecutiveCount >= MIN_CONSECUTIVE_READINGS) {
          // Record the completed event before starting a new one
          const endIndex = i - 1;
          const event: GlycemicEvent = {
            event_type: currentEventType,
            start_timestamp: mergedData[eventStartIndex].dateString,
            end_timestamp: mergedData[endIndex].dateString,
            duration_minutes: calculateDurationMinutes(
              mergedData[eventStartIndex].dateString,
              mergedData[endIndex].dateString,
            ),
            extreme_bg_mgdl: findExtremeBg(
              mergedData,
              eventStartIndex,
              endIndex,
              currentEventType !== GlycemicEventType.HYPERGLYCEMIA,
            ),
          };
          events.push(event);
        }

        // Start new hyperglycemia event
        eventStartIndex = i;
        consecutiveCount = 1;
        currentEventType = GlycemicEventType.HYPERGLYCEMIA;
      }
    }
    // In target range
    else {
      if (currentEventType !== null && consecutiveCount >= MIN_CONSECUTIVE_READINGS) {
        // Record the completed event
        const endIndex = i - 1;
        const event: GlycemicEvent = {
          event_type: currentEventType,
          start_timestamp: mergedData[eventStartIndex].dateString,
          end_timestamp: mergedData[endIndex].dateString,
          duration_minutes: calculateDurationMinutes(
            mergedData[eventStartIndex].dateString,
            mergedData[endIndex].dateString,
          ),
          extreme_bg_mgdl: findExtremeBg(
            mergedData,
            eventStartIndex,
            endIndex,
            currentEventType !== GlycemicEventType.HYPERGLYCEMIA,
          ),
        };
        events.push(event);
      }

      // Reset tracking variables
      currentEventType = null;
      eventStartIndex = -1;
      consecutiveCount = 0;
    }
  }

  // Check if there's an ongoing event at the end of the data
  if (currentEventType !== null && consecutiveCount >= MIN_CONSECUTIVE_READINGS) {
    const endIndex = mergedData.length - 1;
    const event: GlycemicEvent = {
      event_type: currentEventType,
      start_timestamp: mergedData[eventStartIndex].dateString,
      end_timestamp: mergedData[endIndex].dateString,
      duration_minutes: calculateDurationMinutes(
        mergedData[eventStartIndex].dateString,
        mergedData[endIndex].dateString,
      ),
      extreme_bg_mgdl: findExtremeBg(
        mergedData,
        eventStartIndex,
        endIndex,
        currentEventType !== GlycemicEventType.HYPERGLYCEMIA,
      ),
    };
    events.push(event);
  }

  return events;
}
