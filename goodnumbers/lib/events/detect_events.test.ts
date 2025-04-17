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
    very_high: 180  // Now we use this as HIGH_THRESHOLD
  };

  // Test case 1: Hypoglycemia (combining previous severe hypoglycemia test)
  it('should detect hypoglycemia events correctly', () => {
    // Create mock data with hypoglycemia (readings below 70 mg/dL)
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
          glucose: 50,
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
          glucose: 45,
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
    expect(events[0].event_type).toBe(GlycemicEventType.HYPOGLYCEMIA);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 5));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 30));
    expect(events[0].extreme_bg_mgdl).toBe(45); // Lowest value during the event
  });

  // Test case 2: Hyperglycemia (formerly HIGH events)
  it('should detect hyperglycemia events correctly', () => {
    // Create mock data with high glucose (readings above 180 mg/dL)
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
          glucose: 185, // Start of hyperglycemia
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
          glucose: 185, // End of hyperglycemia
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
    expect(events[0].event_type).toBe(GlycemicEventType.HYPERGLYCEMIA);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 10));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 30));
    expect(events[0].extreme_bg_mgdl).toBe(210); // Highest value during the event
  });

  // Test case 3: Transition between hypoglycemia and hyperglycemia
  it('should detect transitions between hypoglycemia and hyperglycemia', () => {
    const mockData: AutotunePreppedData = {
      CRData: [],
      CSFGlucoseData: [
        // Start with hypoglycemia
        {
          date: new Date(createTimestamp(baseTime, 0)).getTime(),
          dateString: createTimestamp(baseTime, 0),
          glucose: 65, // Start of hypo
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 5)).getTime(),
          dateString: createTimestamp(baseTime, 5),
          glucose: 60,
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
        // Rise to normal range
        {
          date: new Date(createTimestamp(baseTime, 15)).getTime(),
          dateString: createTimestamp(baseTime, 15),
          glucose: 85,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 20)).getTime(),
          dateString: createTimestamp(baseTime, 20),
          glucose: 120,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        // Rise to hyperglycemia
        {
          date: new Date(createTimestamp(baseTime, 25)).getTime(),
          dateString: createTimestamp(baseTime, 25),
          glucose: 190, // Start of hyperglycemia
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 30)).getTime(),
          dateString: createTimestamp(baseTime, 30),
          glucose: 220,
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
        {
          date: new Date(createTimestamp(baseTime, 35)).getTime(),
          dateString: createTimestamp(baseTime, 35),
          glucose: 250, // Peak of hyperglycemia
          avgDelta: 0,
          BGI: 0,
          deviation: 0
        } as GlucoseDatum,
      ],
      ISFGlucoseData: [],
      basalGlucoseData: [],
    };

    const events = detectGlycemicEvents(mockData, testPatientRange);

    expect(events.length).toBe(2);
    
    // Check first event (hypoglycemia)
    expect(events[0].event_type).toBe(GlycemicEventType.HYPOGLYCEMIA);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 0));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 10));
    expect(events[0].extreme_bg_mgdl).toBe(55); // Lowest value during the event
    
    // Check second event (hyperglycemia)
    expect(events[1].event_type).toBe(GlycemicEventType.HYPERGLYCEMIA);
    expect(events[1].start_timestamp).toBe(createTimestamp(baseTime, 25));
    expect(events[1].end_timestamp).toBe(createTimestamp(baseTime, 35));
    expect(events[1].extreme_bg_mgdl).toBe(250); // Highest value during the event
  });

  // Test case 4: Gap detection
  it('should handle data gaps correctly', () => {
    const mockData: AutotunePreppedData = {
      CRData: [],
      CSFGlucoseData: [
        // First hyperglycemia event
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

    expect(events.length).toBe(2); // Should detect two separate hyperglycemia events due to the gap

    // First event
    expect(events[0].event_type).toBe(GlycemicEventType.HYPERGLYCEMIA);
    expect(events[0].start_timestamp).toBe(createTimestamp(baseTime, 0));
    expect(events[0].end_timestamp).toBe(createTimestamp(baseTime, 10));

    // Second event
    expect(events[1].event_type).toBe(GlycemicEventType.HYPERGLYCEMIA);
    expect(events[1].start_timestamp).toBe(createTimestamp(baseTime, 40));
    expect(events[1].end_timestamp).toBe(createTimestamp(baseTime, 50));
  });
});