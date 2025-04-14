import { GlycemicEvent } from '../detect_events';
import { NightscoutTreatment } from '../../../types/nightscout';

/**
 * Enum defining the different classification types for glycemic events
 */
export enum EventClassificationType {
  HIGH_AFTER_MEAL = 'HIGH_AFTER_MEAL',
  // Additional classifications would be added here as the system evolves
  UNCLASSIFIED = 'UNCLASSIFIED',
}

/**
 * Interface extending GlycemicEvent with classification information
 */
export interface ClassifiedEvent extends GlycemicEvent {
  /**
   * The classification type assigned to this event
   */
  classification: EventClassificationType;
  
  /**
   * Treatments related to this event and their temporal relationship
   */
  relatedTreatments: {
    /**
     * Array of treatments related to this event
     */
    treatments: NightscoutTreatment[];
    
    /**
     * Time difference in minutes between each treatment and the event
     * Positive values indicate the treatment occurred before the event
     */
    minutesBefore: number[];
  };
}

/**
 * Configuration for time windows used in classification
 */
export interface ClassificationConfig {
  /**
   * Time window in minutes to look for meals before high glucose events
   */
  mealBeforeHighWindowMinutes: number;
  
  // Additional time windows would be configured here
}

/**
 * Default configuration values for classification
 */
export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  mealBeforeHighWindowMinutes: 180, // 3 hours
  // Additional defaults would be added here
};
