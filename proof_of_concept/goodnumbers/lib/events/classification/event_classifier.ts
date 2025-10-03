import { GlycemicEvent, GlycemicEventType } from '../detect_events';
import { NightscoutTreatment } from '../../../types/nightscout';
import {
  ClassifiedEvent,
  EventClassificationType,
  ClassificationConfig,
  DEFAULT_CLASSIFICATION_CONFIG,
  Classification,
} from './classification_types';

/**
 * Main classifier function that takes glycemic events and treatments
 * and returns classified events with multiple potential classifications
 *
 * This updated version supports multiple classifications per event, allowing
 * for more nuanced analysis of glycemic patterns.
 *
 * @param glycemicEvents - Array of glycemic events to classify
 * @param treatments - Array of treatments to analyze for classification
 * @param config - Optional configuration for classification windows
 * @returns Array of classified events with potential classifications
 */
export function classifyEvents(
  glycemicEvents: GlycemicEvent[],
  treatments: NightscoutTreatment[],
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
): ClassifiedEvent[] {
  // Sort events and treatments chronologically
  const sortedEvents = sortGlycemicEvents(glycemicEvents);
  const sortedTreatments = sortTreatments(treatments);

  // Initialize results array
  const classifiedEvents: ClassifiedEvent[] = [];

  // Process each glycemic event
  for (const event of sortedEvents) {
    // Initialize with empty classifications array
    const classifiedEvent: ClassifiedEvent = {
      ...event,
      classifications: [], // Each event can have multiple classifications
    };

    // Apply classification rules based on event type
    if (event.event_type === GlycemicEventType.HIGH || event.event_type === GlycemicEventType.VERY_HIGH) {
      // Check for meal-related classifications (may find multiple)
      const mealRelatedClassifications = checkMealRelatedHighs(event, sortedTreatments, config);
      classifiedEvent.classifications.push(...mealRelatedClassifications);

      // Example of extensibility: Future rules would add additional classifications
      // const otherClassifications = checkOtherRuleFunction(event, sortedTreatments, config);
      // classifiedEvent.classifications.push(...otherClassifications);
    }

    // If no classifications found, add UNCLASSIFIED as a fallback
    if (classifiedEvent.classifications.length === 0) {
      classifiedEvent.classifications.push({
        type: EventClassificationType.UNCLASSIFIED,
        relatedTreatments: {
          treatments: [],
          minutesBefore: [],
        },
      });
    }

    // Add the classified event to results
    classifiedEvents.push(classifiedEvent);
  }

  return classifiedEvents;
}

/**
 * Checks a high glycemic event for potential links to preceding meals and boluses.
 * Returns an array of applicable classifications.
 *
 * This function implements the meal-related classification logic:
 * 1. HIGH_AFTER_UNCOVERED_MEAL: Meal with no insulin bolus found
 * 2. HIGH_AFTER_POSTBOLUSED_MEAL: Meal with insulin given at/after meal time
 * 3. HIGH_AFTER_PREBOLUSED_MEAL: Meal with insulin given well before meal time
 *
 * @param event - The glycemic event to check
 * @param treatments - Array of treatments to analyze
 * @param config - Configuration for classification windows
 * @returns Array of applicable classifications
 *
 * @example
 * // Example of a HIGH_AFTER_UNCOVERED_MEAL classification:
 * // A meal at 12:00 PM with no insulin bolus, followed by a high at 1:30 PM
 *
 * @example
 * // Example of a HIGH_AFTER_POSTBOLUSED_MEAL classification:
 * // A meal at 12:00 PM with insulin given at 12:05 PM, followed by a high at 1:30 PM
 *
 * @example
 * // Example of a HIGH_AFTER_PREBOLUSED_MEAL classification:
 * // Insulin given at 11:50 AM, meal at 12:00 PM, followed by a high at 1:30 PM
 */
function checkMealRelatedHighs(
  event: GlycemicEvent,
  treatments: NightscoutTreatment[],
  config: ClassificationConfig,
): Classification[] {
  const results: Classification[] = [];

  // Early return if no event or treatments data
  if (!event || !event.start_timestamp || !treatments || treatments.length === 0) {
    return results;
  }

  // Ensure we have a valid timestamp
  let eventStartTime: number;
  try {
    eventStartTime = new Date(event.start_timestamp).getTime();
    if (isNaN(eventStartTime)) {
      return results; // Invalid date
    }
  } catch (error) {
    return results; // Error parsing date
  }

  // Setup time window constants with defaults as fallback
  const mealLookbackWindow = (config?.mealLookbackWindowMinutes ?? 180) * 60 * 1000;
  const bolusSearchWindow = (config?.bolusSearchWindowMinutes ?? 30) * 60 * 1000;
  const prebolusThreshold = (config?.prebolusThresholdMinutes ?? 5) * 60 * 1000;

  // Find meals within lookback window
  const relevantMeals = treatments.filter((treatment) => {
    // Skip null/undefined treatments
    if (!treatment || !treatment.created_at) return false;

    // Check if it's a meal treatment (has carbs > 0)
    if (!((treatment.carbs ?? 0) > 0)) return false;

    // Calculate time difference
    let treatmentTime: number;
    try {
      treatmentTime = new Date(treatment.created_at).getTime();
      if (isNaN(treatmentTime)) return false; // Invalid date
    } catch (error) {
      return false; // Error parsing date
    }

    const timeDiff = eventStartTime - treatmentTime;

    // Check if within lookback window
    return timeDiff >= 0 && timeDiff <= mealLookbackWindow;
  });

  // If no relevant meals found, return empty array
  if (relevantMeals.length === 0) return results;

  // Process each relevant meal
  for (const meal of relevantMeals) {
    const mealTime = new Date(meal.created_at).getTime();
    const mealTimeDiff = Math.round((eventStartTime - mealTime) / (60 * 1000));

    // Find boluses around this meal
    let closestBolus: NightscoutTreatment | null = null;
    let closestBolusTimeDiff = 0;
    let minTimeDelta = Infinity;

    for (const treatment of treatments) {
      // Skip null/undefined treatments
      if (!treatment || !treatment.created_at) continue;

      // Check if it's a bolus treatment (has insulin > 0)
      if (!((treatment.insulin ?? 0) > 0)) continue;

      let bolusTime: number;
      try {
        bolusTime = new Date(treatment.created_at).getTime();
        if (isNaN(bolusTime)) continue; // Invalid date
      } catch (error) {
        continue; // Error parsing date
      }

      const timeDeltaFromMeal = Math.abs(bolusTime - mealTime);

      // Check if within search window around meal
      if (timeDeltaFromMeal <= bolusSearchWindow) {
        // Is this bolus closer to the meal than previous ones?
        if (timeDeltaFromMeal < minTimeDelta) {
          minTimeDelta = timeDeltaFromMeal;
          closestBolus = treatment;
          closestBolusTimeDiff = Math.round((eventStartTime - bolusTime) / (60 * 1000));
        }
      }
    }

    // Determine classification based on bolus presence/timing
    let classificationType: EventClassificationType;
    let relatedTreatmentsList: NightscoutTreatment[];
    let minutesBeforeList: number[];

    if (!closestBolus) {
      // SCENARIO 1: No bolus found for this meal
      // This indicates the meal was not covered with insulin
      classificationType = EventClassificationType.HIGH_AFTER_UNCOVERED_MEAL;
      relatedTreatmentsList = [meal];
      minutesBeforeList = [mealTimeDiff];
    } else {
      // Bolus found, check timing relative to meal
      const bolusTime = new Date(closestBolus.created_at).getTime();
      const bolusVsMealDiff = bolusTime - mealTime; // Negative if bolus before meal

      if (bolusVsMealDiff < -prebolusThreshold) {
        // SCENARIO 2: Bolus given significantly before meal
        // This is proper pre-bolusing, but high may indicate insufficient dosing
        classificationType = EventClassificationType.HIGH_AFTER_PREBOLUSED_MEAL;
      } else {
        // SCENARIO 3: Bolus given at/after meal or only slightly before
        // This may indicate that insulin didn't have time to start working
        classificationType = EventClassificationType.HIGH_AFTER_POSTBOLUSED_MEAL;
      }

      relatedTreatmentsList = [meal, closestBolus];
      minutesBeforeList = [mealTimeDiff, closestBolusTimeDiff];
    }

    // Add this classification to results
    results.push({
      type: classificationType,
      relatedTreatments: {
        treatments: relatedTreatmentsList,
        minutesBefore: minutesBeforeList,
      },
    });
  }

  return results;
}

/**
 * Sort an array of glycemic events chronologically by start_timestamp
 *
 * @param events - Array of glycemic events to sort
 * @returns Sorted array of glycemic events
 */
function sortGlycemicEvents(events: GlycemicEvent[]): GlycemicEvent[] {
  return [...events].sort((a, b) => {
    const timeA = new Date(a.start_timestamp).getTime();
    const timeB = new Date(b.start_timestamp).getTime();
    return timeA - timeB;
  });
}

/**
 * Sort an array of Nightscout treatments chronologically by created_at
 *
 * @param treatments - Array of treatments to sort
 * @returns Sorted array of treatments
 */
function sortTreatments(treatments: NightscoutTreatment[]): NightscoutTreatment[] {
  return [...treatments].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return timeA - timeB;
  });
}
export { DEFAULT_CLASSIFICATION_CONFIG };
