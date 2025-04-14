import { GlycemicEvent, GlycemicEventType } from '../detect_events';
import { NightscoutTreatment } from '../../../types/nightscout';
import {
  ClassifiedEvent,
  EventClassificationType,
  ClassificationConfig,
  DEFAULT_CLASSIFICATION_CONFIG
} from './classification_types';

/**
 * Main classifier function that takes glycemic events and treatments
 * and returns classified events
 *
 * @param glycemicEvents - Array of glycemic events to classify
 * @param treatments - Array of treatments to analyze for classification
 * @param config - Optional configuration for classification windows
 * @returns Array of classified events
 */
export function classifyEvents(
  glycemicEvents: GlycemicEvent[],
  treatments: NightscoutTreatment[],
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG
): ClassifiedEvent[] {

  // Sort events and treatments chronologically
  const sortedEvents = sortGlycemicEvents(glycemicEvents);
  const sortedTreatments = sortTreatments(treatments);

  // Initialize results array
  const classifiedEvents: ClassifiedEvent[] = [];

  // Process each glycemic event
  for (const event of sortedEvents) {
    // Convert to classified event with default classification
    const classifiedEvent = initializeClassifiedEvent(event);

    // Apply classification rules based on event type
    if (event.event_type === GlycemicEventType.HIGH ||
        event.event_type === GlycemicEventType.VERY_HIGH) {

      // Apply high event classification rules
      applyHighEventRules(classifiedEvent, sortedTreatments, config);
    }

    // Other event types would have their own rule application here

    // Add the classified event to results
    classifiedEvents.push(classifiedEvent);
  }

  return classifiedEvents;
}

/**
 * Initialize a glycemic event as a classified event with default values
 *
 * @param event - The glycemic event to initialize as a classified event
 * @returns A classified event with default classification
 */
function initializeClassifiedEvent(event: GlycemicEvent): ClassifiedEvent {
  return {
    ...event,
    classification: EventClassificationType.UNCLASSIFIED,
    relatedTreatments: {
      treatments: [] as NightscoutTreatment[],
      minutesBefore: [] as number[]
    }
  };
}

/**
 * Apply classification rules specific to high glucose events
 *
 * @param event - The classified event to update
 * @param treatments - Array of treatments to analyze
 * @param config - Configuration for classification windows
 */
function applyHighEventRules(
  event: ClassifiedEvent,
  treatments: NightscoutTreatment[],
  config: ClassificationConfig
): void {

  // Example rule: Check for meals before high event
  const mealBeforeHighRule = checkMealBeforeHigh(event, treatments, config);

  if (mealBeforeHighRule.matches) {
    // Apply the classification from this rule
    event.classification = mealBeforeHighRule.classification;
    event.relatedTreatments = mealBeforeHighRule.relatedTreatments;

    // Once a rule is matched, we can either stop or continue applying rules
    // For now, we'll stop at first match
    return;
  }

  // Additional rules would be checked here in sequence or combination
}

/**
 * Rule: Check if a meal occurred within the configured window before a high event
 *
 * @param event - The classified event to check
 * @param treatments - Array of treatments to analyze
 * @param config - Configuration for classification windows
 * @returns Result object with match status and classification details
 */
function checkMealBeforeHigh(
  event: ClassifiedEvent,
  treatments: NightscoutTreatment[],
  config: ClassificationConfig
): {
  matches: boolean;
  classification: EventClassificationType;
  relatedTreatments: { treatments: NightscoutTreatment[]; minutesBefore: number[] };
} {

  // Extract timestamps
  const eventTime = new Date(event.start_timestamp).getTime();

  // Initialize result
  const result = {
    matches: false,
    classification: EventClassificationType.UNCLASSIFIED,
    relatedTreatments: {
      treatments: [] as NightscoutTreatment[],
      minutesBefore: [] as number[]
    }
  };

  // Find meal treatments within the specified window
  const relevantMeals = treatments.filter(treatment => {
    // Check if it's a meal treatment
    if (treatment.eventType !== 'Meal Bolus' && !treatment.carbs) {
      return false;
    }

    // Calculate time difference in minutes
    const treatmentTime = new Date(treatment.created_at).getTime();
    const minutesBefore = Math.round((eventTime - treatmentTime) / (60 * 1000));

    // Check if within the configured window
    return minutesBefore >= 0 && minutesBefore <= config.mealBeforeHighWindowMinutes;
  });

  // If at least one relevant meal found, this rule matches
  if (relevantMeals.length > 0) {
    result.matches = true;
    result.classification = EventClassificationType.HIGH_AFTER_MEAL;

    // Store the related treatments and their time differences
    result.relatedTreatments.treatments = relevantMeals;
    result.relatedTreatments.minutesBefore = relevantMeals.map(meal => {
      const treatmentTime = new Date(meal.created_at).getTime();
      return Math.round((eventTime - treatmentTime) / (60 * 1000));
    });
  }

  return result;
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