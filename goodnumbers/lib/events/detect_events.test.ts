import { detectGlycemicEvents, GlycemicEventType } from './detect_events';
import { AutotunePreppedData } from '../oref0-autotune/gn-autotune-prep';
import { GlucoseDatum } from '../oref0-autotune/gn-autotune-prep';
import { PatientRange } from '../oref0-autotune/gn-overview';

describe('detectGlycemicEvents', () => {
  // Helper function to create a timestamp with a certain minute offset
  const createTimestamp = (baseTime: Date, minutesOffset: number): string => {
    const time = new Date(baseTime);
    time.setMinutes(time.getMinutes() + minutesOffset);
    return time.toISOString();
  };

  // Create test data
  const baseTime = new Date('2023-10-26T03:00:00Z');

  // Create a standard PatientRange for tests
  const testPatientRange: PatientRange = {
    average_name: 'in range',
    average: 120,
    target_low: 70,
    target_high: 180,
    very_high: 250
  };

  // Test case 1: Severe Hypoglycemia
  it('should detect severe hypoglycemia events correctly', () => {
    // Create mock data with severe hypoglycemia (3 readings below 54 mg/dL)
    const mockData: AutotunePreppedData = {
      CRData: [],
      CSFGlucoseData: [
        {
          date: new Date(createTimestamp(baseTime, 0)).getTime(),
          dateString: createTimestamp(baseTime, 0),
          glucose: 75,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 5)).getTime(),
          dateString: createTimestamp(baseTime, 5),
          glucose: 65,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 10)).getTime(),
          dateString: createTimestamp(baseTime, 10),
          glucose: 55,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 15)).getTime(),
          dateString: createTimestamp(baseTime, 15),
          glucose: 50, // Start of severe hypo
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 20)).getTime(),
          dateString: createTimestamp(baseTime, 20),
          glucose: 48,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 25)).getTime(),
          dateString: createTimestamp(baseTime, 25),
          glucose: 45, // End of severe hypo
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 30)).getTime(),
          dateString: createTimestamp(baseTime, 30),
          glucose: 55,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 35)).getTime(),
          dateString: createTimestamp(baseTime, 35),
          glucose: 65,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 40)).getTime(),
          dateString: createTimestamp(baseTime, 40),
          glucose: 75,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
      ],
      ISFGlucoseData: [],
      basalGlucoseData: [],
    };

    const events = detectGlycemicEvents(mockData, testPatientRange);

    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe(GlycemicEventType.SEVERE_HYPOGLYCEMIA);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 15));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 25));
    expect(events[0].extreme_bg_mgdl).toBe(45); // Lowest value during the event
  });

  // Test case 2: Hypoglycemia
  it('should detect hypoglycemia events correctly', () => {
    // Create mock data with hypoglycemia (3 readings between 54 and 69 mg/dL)
    const mockData: AutotunePreppedData = {
      CRData: [],
      CSFGlucoseData: [],
      ISFGlucoseData: [
        {
          date: new Date(createTimestamp(baseTime, 0)).getTime(),
          dateString: createTimestamp(baseTime, 0),
          glucose: 80,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 5)).getTime(),
          dateString: createTimestamp(baseTime, 5),
          glucose: 75,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 10)).getTime(),
          dateString: createTimestamp(baseTime, 10),
          glucose: 68, // Start of hypo
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 15)).getTime(),
          dateString: createTimestamp(baseTime, 15),
          glucose: 65,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 20)).getTime(),
          dateString: createTimestamp(baseTime, 20),
          glucose: 62, // End of hypo
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 25)).getTime(),
          dateString: createTimestamp(baseTime, 25),
          glucose: 72,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 30)).getTime(),
          dateString: createTimestamp(baseTime, 30),
          glucose: 78,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
      ],
      basalGlucoseData: [],
    };

    const events = detectGlycemicEvents(mockData, testPatientRange);

    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe(GlycemicEventType.HYPOGLYCEMIA);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 10));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 20));
    expect(events[0].extreme_bg_mgdl).toBe(62); // Lowest value during the event
  });

  // Test case 3: HIGH events
  it('should detect HIGH events correctly', () => {
    // Create mock data with high glucose (3 readings above target_high but below very_high)
    const mockData: AutotunePreppedData = {
      CRData: [],
      CSFGlucoseData: [],
      ISFGlucoseData: [],
      basalGlucoseData: [
        {
          date: new Date(createTimestamp(baseTime, 0)).getTime(),
          dateString: createTimestamp(baseTime, 0),
          glucose: 160,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 5)).getTime(),
          dateString: createTimestamp(baseTime, 5),
          glucose: 175,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 10)).getTime(),
          dateString: createTimestamp(baseTime, 10),
          glucose: 185, // Start of high
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 15)).getTime(),
          dateString: createTimestamp(baseTime, 15),
          glucose: 195,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 20)).getTime(),
          dateString: createTimestamp(baseTime, 20),
          glucose: 210, // Peak
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 25)).getTime(),
          dateString: createTimestamp(baseTime, 25),
          glucose: 200,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 30)).getTime(),
          dateString: createTimestamp(baseTime, 30),
          glucose: 185, // End of high
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 35)).getTime(),
          dateString: createTimestamp(baseTime, 35),
          glucose: 175,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 40)).getTime(),
          dateString: createTimestamp(baseTime, 40),
          glucose: 160,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
      ],
    };

    const events = detectGlycemicEvents(mockData, testPatientRange);

    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe(GlycemicEventType.HIGH);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 10));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 30));
    expect(events[0].extreme_bg_mgdl).toBe(210); // Highest value during the event
  });

  // Test case 4: Transition from hypoglycemia to severe hypoglycemia
  it('should classify an entire event as severe hypoglycemia if it dips into severe range', () => {
    const mockData: AutotunePreppedData = {
      CRData: [],
      CSFGlucoseData: [
        {
          date: new Date(createTimestamp(baseTime, 0)).getTime(),
          dateString: createTimestamp(baseTime, 0),
          glucose: 80,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 5)).getTime(),
          dateString: createTimestamp(baseTime, 5),
          glucose: 68, // Start as hypo
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 10)).getTime(),
          dateString: createTimestamp(baseTime, 10),
          glucose: 60,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 15)).getTime(),
          dateString: createTimestamp(baseTime, 15),
          glucose: 50, // Dips to severe
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 20)).getTime(),
          dateString: createTimestamp(baseTime, 20),
          glucose: 48,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 25)).getTime(),
          dateString: createTimestamp(baseTime, 25),
          glucose: 55, // Back to hypo range
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 30)).getTime(),
          dateString: createTimestamp(baseTime, 30),
          glucose: 65,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 35)).getTime(),
          dateString: createTimestamp(baseTime, 35),
          glucose: 75,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
      ],
      ISFGlucoseData: [],
      basalGlucoseData: [],
    };

    const events = detectGlycemicEvents(mockData, testPatientRange);

    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe(GlycemicEventType.SEVERE_HYPOGLYCEMIA);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 5));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 30));
    expect(events[0].extreme_bg_mgdl).toBe(48); // Lowest value during the event
  });

  // Test case 5: Multiple events including VERY_HIGH
  it('should detect multiple different events correctly including VERY_HIGH', () => {
    const mockData: AutotunePreppedData = {
      CRData: [],
      CSFGlucoseData: [
        // HIGH event
        {
          date: new Date(createTimestamp(baseTime, 0)).getTime(),
          dateString: createTimestamp(baseTime, 0),
          glucose: 175,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 5)).getTime(),
          dateString: createTimestamp(baseTime, 5),
          glucose: 185, // Start of HIGH
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 10)).getTime(),
          dateString: createTimestamp(baseTime, 10),
          glucose: 200,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 15)).getTime(),
          dateString: createTimestamp(baseTime, 15),
          glucose: 220,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 20)).getTime(),
          dateString: createTimestamp(baseTime, 20),
          glucose: 255, // Becomes VERY_HIGH
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 25)).getTime(),
          dateString: createTimestamp(baseTime, 25),
          glucose: 270,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 30)).getTime(),
          dateString: createTimestamp(baseTime, 30),
          glucose: 250,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,

        // Normal period
        {
          date: new Date(createTimestamp(baseTime, 35)).getTime(),
          dateString: createTimestamp(baseTime, 35),
          glucose: 160,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 40)).getTime(),
          dateString: createTimestamp(baseTime, 40),
          glucose: 140,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 45)).getTime(),
          dateString: createTimestamp(baseTime, 45),
          glucose: 95,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,

        // Hypoglycemia event
        {
          date: new Date(createTimestamp(baseTime, 50)).getTime(),
          dateString: createTimestamp(baseTime, 50),
          glucose: 68, // Start of HYPO
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 55)).getTime(),
          dateString: createTimestamp(baseTime, 55),
          glucose: 65,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 60)).getTime(),
          dateString: createTimestamp(baseTime, 60),
          glucose: 62,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,

        // Severe hypoglycemia event
        {
          date: new Date(createTimestamp(baseTime, 65)).getTime(),
          dateString: createTimestamp(baseTime, 65),
          glucose: 50, // Becomes SEVERE_HYPO
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 70)).getTime(),
          dateString: createTimestamp(baseTime, 70),
          glucose: 45,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 75)).getTime(),
          dateString: createTimestamp(baseTime, 75),
          glucose: 48,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,

        // Recovery
        {
          date: new Date(createTimestamp(baseTime, 80)).getTime(),
          dateString: createTimestamp(baseTime, 80),
          glucose: 60,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 85)).getTime(),
          dateString: createTimestamp(baseTime, 85),
          glucose: 75,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
      ],
      ISFGlucoseData: [],
      basalGlucoseData: [],
    };

    const events = detectGlycemicEvents(mockData, testPatientRange);

    expect(events.length).toBe(2); // Should detect VERY_HIGH and SEVERE_HYPOGLYCEMIA events
                                   // (HIGH gets upgraded to VERY_HIGH and HYPOGLYCEMIA to SEVERE_HYPOGLYCEMIA)

    // Check first event (VERY_HIGH)
    expect(events[0].event_type).toBe(GlycemicEventType.VERY_HIGH);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 5));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 30));
    expect(events[0].extreme_bg_mgdl).toBe(270);

    // Check second event (SEVERE_HYPOGLYCEMIA, including the initial hypo period)
    expect(events[1].event_type).toBe(GlycemicEventType.SEVERE_HYPOGLYCEMIA);
    expect(events[1].start_timestamp).toBe(createTimestamp(baseTime, 50));
    expect(events[1].end_timestamp).toBe(createTimestamp(baseTime, 75));
    expect(events[1].extreme_bg_mgdl).toBe(45);
  });

  // Test case 6: Gap detection
  it('should handle data gaps correctly', () => {
    const mockData: AutotunePreppedData = {
      CRData: [],
      CSFGlucoseData: [
        // First HIGH event
        {
          date: new Date(createTimestamp(baseTime, 0)).getTime(),
          dateString: createTimestamp(baseTime, 0),
          glucose: 185,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 5)).getTime(),
          dateString: createTimestamp(baseTime, 5),
          glucose: 190,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 10)).getTime(),
          dateString: createTimestamp(baseTime, 10),
          glucose: 195,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        
        // Large gap (30 minutes) - should break the event
        {
          date: new Date(createTimestamp(baseTime, 40)).getTime(),
          dateString: createTimestamp(baseTime, 40),
          glucose: 200,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 45)).getTime(),
          dateString: createTimestamp(baseTime, 45),
          glucose: 205,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 50)).getTime(),
          dateString: createTimestamp(baseTime, 50),
          glucose: 210,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
      ],
      ISFGlucoseData: [],
      basalGlucoseData: [],
    };

    const events = detectGlycemicEvents(mockData, testPatientRange);

    expect(events.length).toBe(2); // Should detect two separate HIGH events due to the gap
    
    // First event
    expect(events[0].event_type).toBe(GlycemicEventType.HIGH);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 0));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 10));
    
    // Second event
    expect(events[1].event_type).toBe(GlycemicEventType.HIGH);
    expect(events[1].start_timestamp).toBe(createTimestamp(baseTime, 40));
    expect(events[1].end_timestamp).toBe(createTimestamp(baseTime, 50));
  });
});