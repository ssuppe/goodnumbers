import { GlycemicEvent, GlycemicEventType } from '../../detect_events';
import { NightscoutTreatment } from '../../../../types/nightscout';

/**
 * Test fixture utilities for event classification testing
 */

/**
 * Create a glycemic event with the given parameters
 */
export function createGlycemicEvent(
  type: GlycemicEventType = GlycemicEventType.HIGH,
  startTime: string | Date = new Date('2023-01-01T12:00:00Z'),
  endTime: string | Date = new Date('2023-01-01T13:00:00Z'),
  extremeBg: number = 180
): GlycemicEvent {
  const start = typeof startTime === 'string' ? startTime : startTime.toISOString();
  const end = typeof endTime === 'string' ? endTime : endTime.toISOString();
  
  return {
    event_type: type,
    start_timestamp: start,
    end_timestamp: end,
    duration_minutes: Math.round((new Date(end).getTime() - new Date(start).getTime()) / (60 * 1000)),
    extreme_bg_mgdl: extremeBg
  };
}

/**
 * Create a meal treatment with the given parameters
 */
export function createMealTreatment(
  time: string | Date = new Date('2023-01-01T11:00:00Z'),
  carbs: number = 40,
  id: string = 'meal-1'
): NightscoutTreatment {
  const createdAt = typeof time === 'string' ? time : time.toISOString();
  
  return {
    _id: id,
    created_at: createdAt,
    eventType: 'Meal Bolus',
    carbs: carbs,
    insulin: null,
    // Adding required properties based on NightscoutTreatment interface
    app: 'testApp',
    date: new Date(createdAt).getTime(),
    duration: 0,
    durationInMilliseconds: 0,
    enteredBy: 'test',
    isReadOnly: false,
    isValid: true,
    notes: '',
    units: 'mg/dl',
    utcOffset: 0,
    identifier: id,
    srvModified: 0,
    srvCreated: 0,
    subject: 'test'
  };
}

/**
 * Create an insulin bolus treatment with the given parameters
 */
export function createBolusTreatment(
  time: string | Date = new Date('2023-01-01T11:00:00Z'),
  insulin: number = 5,
  id: string = 'bolus-1'
): NightscoutTreatment {
  const createdAt = typeof time === 'string' ? time : time.toISOString();
  
  return {
    _id: id,
    created_at: createdAt,
    eventType: 'Bolus',
    carbs: null,
    insulin: insulin,
    // Adding required properties based on NightscoutTreatment interface
    app: 'testApp',
    date: new Date(createdAt).getTime(),
    duration: 0,
    durationInMilliseconds: 0,
    enteredBy: 'test',
    isReadOnly: false,
    isValid: true,
    notes: '',
    units: 'mg/dl',
    utcOffset: 0,
    identifier: id,
    srvModified: 0,
    srvCreated: 0,
    subject: 'test'
  };
}

/**
 * Create a test scenario for an uncovered meal
 * Meal with no bolus, followed by a high glucose event
 */
export function createUncoveredMealScenario(
  mealTime: string | Date = new Date('2023-01-01T11:00:00Z'),
  highTime: string | Date = new Date('2023-01-01T12:00:00Z')
): {
  event: GlycemicEvent;
  treatments: NightscoutTreatment[];
} {
  return {
    event: createGlycemicEvent(GlycemicEventType.HIGH, highTime),
    treatments: [
      createMealTreatment(mealTime)
    ]
  };
}

/**
 * Create a test scenario for a post-bolused meal
 * Meal with bolus given at or after meal, followed by a high glucose event
 */
export function createPostBolusedMealScenario(
  mealTime: string | Date = new Date('2023-01-01T11:00:00Z'),
  bolusTime: string | Date = new Date('2023-01-01T11:05:00Z'), // 5 min after meal
  highTime: string | Date = new Date('2023-01-01T12:00:00Z')
): {
  event: GlycemicEvent;
  treatments: NightscoutTreatment[];
} {
  return {
    event: createGlycemicEvent(GlycemicEventType.HIGH, highTime),
    treatments: [
      createMealTreatment(mealTime),
      createBolusTreatment(bolusTime)
    ]
  };
}

/**
 * Create a test scenario for a pre-bolused meal
 * Meal with bolus given well before meal, followed by a high glucose event
 */
export function createPreBolusedMealScenario(
  mealTime: string | Date = new Date('2023-01-01T11:00:00Z'),
  bolusTime: string | Date = new Date('2023-01-01T10:50:00Z'), // 10 min before meal
  highTime: string | Date = new Date('2023-01-01T12:00:00Z')
): {
  event: GlycemicEvent;
  treatments: NightscoutTreatment[];
} {
  return {
    event: createGlycemicEvent(GlycemicEventType.HIGH, highTime),
    treatments: [
      createMealTreatment(mealTime),
      createBolusTreatment(bolusTime)
    ]
  };
}

/**
 * Create a test scenario with multiple meals
 * Multiple meals with different bolus patterns, followed by a high glucose event
 */
export function createMultipleMealsScenario(
  highTime: string | Date = new Date('2023-01-01T14:00:00Z')
): {
  event: GlycemicEvent;
  treatments: NightscoutTreatment[];
} {
  return {
    event: createGlycemicEvent(GlycemicEventType.HIGH, highTime),
    treatments: [
      // Uncovered meal (no bolus)
      createMealTreatment(new Date('2023-01-01T11:00:00Z'), 30, 'meal-1'),
      
      // Pre-bolused meal
      createMealTreatment(new Date('2023-01-01T12:00:00Z'), 40, 'meal-2'),
      createBolusTreatment(new Date('2023-01-01T11:50:00Z'), 4, 'bolus-1'),
      
      // Post-bolused meal
      createMealTreatment(new Date('2023-01-01T13:00:00Z'), 20, 'meal-3'),
      createBolusTreatment(new Date('2023-01-01T13:05:00Z'), 2, 'bolus-2')
    ]
  };
}

/**
 * Create an edge case scenario with bolus at the threshold boundary
 */
export function createThresholdScenario(
  mealTime: string | Date = new Date('2023-01-01T11:00:00Z'),
  highTime: string | Date = new Date('2023-01-01T12:00:00Z'),
  preBolusThresholdMinutes: number = 5
): {
  event: GlycemicEvent;
  treatments: NightscoutTreatment[];
  atThreshold: NightscoutTreatment;
  justBeforeThreshold: NightscoutTreatment;
} {
  const mealDate = typeof mealTime === 'string' ? new Date(mealTime) : new Date(mealTime);
  
  // Create bolus exactly at threshold
  const atThresholdDate = new Date(mealDate);
  atThresholdDate.setMinutes(mealDate.getMinutes() - preBolusThresholdMinutes);
  const atThreshold = createBolusTreatment(atThresholdDate, 4, 'bolus-at-threshold');
  
  // Create bolus just 1 minute before threshold (should be considered pre-bolus)
  const justBeforeThresholdDate = new Date(mealDate);
  justBeforeThresholdDate.setMinutes(mealDate.getMinutes() - (preBolusThresholdMinutes + 1));
  const justBeforeThreshold = createBolusTreatment(justBeforeThresholdDate, 4, 'bolus-before-threshold');
  
  return {
    event: createGlycemicEvent(GlycemicEventType.HIGH, highTime),
    treatments: [
      createMealTreatment(mealTime),
      atThreshold,
      justBeforeThreshold
    ],
    atThreshold,
    justBeforeThreshold
  };
}