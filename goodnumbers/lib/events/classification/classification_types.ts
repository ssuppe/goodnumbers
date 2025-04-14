import { GlycemicEvent } from '../detect_events';
import { NightscoutTreatment } from '../../../types/nightscout';

/**
 * Enum defining the different classification types for glycemic events
 */
export enum EventClassificationType {
  /**
   * High glucose that occurred after a meal with no insulin bolus detected
   * This often indicates that insulin coverage was missing for the meal
   */
  HIGH_AFTER_UNCOVERED_MEAL = 'HIGH_AFTER_UNCOVERED_MEAL',
  
  /**
   * High glucose that occurred after a meal where insulin was given at or after the meal time
   * May indicate that insulin didn't have enough time to start working before carbs were absorbed
   */
  HIGH_AFTER_POSTBOLUSED_MEAL = 'HIGH_AFTER_POSTBOLUSED_MEAL',
  
  /**
   * High glucose that occurred after a meal where insulin was given well before the meal
   * Insulin was properly timed (pre-bolused), but the high may indicate insufficient dosing
   */
  HIGH_AFTER_PREBOLUSED_MEAL = 'HIGH_AFTER_PREBOLUSED_MEAL',
  
  /**
   * Default classification when no specific patterns are identified
   */
  UNCLASSIFIED = 'UNCLASSIFIED',
}

/**
 * Interface representing a single classification with related treatments
 */
export interface Classification {
  /**
   * The classification type
   */
  type: EventClassificationType;
  
  /**
   * Treatments related to this classification and their temporal relationship
   */
  relatedTreatments: {
    /**
     * Array of treatments related to this classification
     */
    treatments: NightscoutTreatment[];

    /**
     * Time difference in minutes between each treatment and the event
     * Positive values indicate the treatment occurred before the event
     * The order of minutes should correspond to the order of treatments
     */
    minutesBefore: number[];
  };
}

/**
 * Interface extending GlycemicEvent with multiple classifications
 */
export interface ClassifiedEvent extends GlycemicEvent {
  /**
   * Array of classifications identified for this event
   * If no specific rules match, this array might contain a single entry of type UNCLASSIFIED
   */
  classifications: Classification[];
}

/**
 * Configuration for time windows used in classification
 */
export interface ClassificationConfig {
  /**
   * Time window in minutes to look for meals before high glucose events
   */
  mealLookbackWindowMinutes: number;
  
  /**
   * Time window in minutes to search for boluses around a meal
   */
  bolusSearchWindowMinutes?: number;
  
  /**
   * Threshold in minutes to determine if a bolus was given significantly before a meal
   */
  prebolusThresholdMinutes?: number;

  // Additional time windows would be configured here
}

/**
 * Default configuration values for classification
 */
export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  mealLookbackWindowMinutes: 180, // 3 hours
  bolusSearchWindowMinutes: 30,     // 30 minutes
  prebolusThresholdMinutes: 5,      // 5 minutes
  // Additional defaults would be added here
};