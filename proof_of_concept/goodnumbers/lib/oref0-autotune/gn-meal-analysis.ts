import { ATReading, AutotunePreppedData } from './gn-autotune-prep';
import { GLUCOSE_RANGES } from './gn-constants';

// Thresholds for glucose values in mg/dL

interface MealEvent {
  startTime: Date;
  endTime: Date;
  durationMinutes: number; // Time until autotune marks 'end'
  carbCount: number | undefined;
  readings: AutotunePreppedData['CSFGlucoseData'];

  // Analysis results
  maxGlucose: number;
  minGlucose: number;
  startGlucose: number;
  endGlucose: number;
  peakDeviation: number;
  totalDeviation: number;
  timeToMaxGlucoseMinutes: number; // minutes
  avgDeltaAtStart: number; // rate of change at meal start

  // New stabilization tracking
  didReturnToStart: boolean;
  fullMealDuration: number | null; // Time until glucose returns to near starting level, null if never returned to start
  timeToStabilize: number | null; // minutes from peak until return to start
  deviationsUntilReturn: number;
}

function analyzeMealEvents(data: AutotunePreppedData): MealEvent[] {
  const mealEvents: MealEvent[] = [];
  let currentEvent: Partial<MealEvent> & { readings: AutotunePreppedData['CSFGlucoseData'] } = {
    readings: [],
  };

  // Process CSFGlucoseData to extract meal events
  for (const reading of data.CSFGlucoseData) {
    // Start of a new meal event
    if (reading.mealAbsorption === 'start') {
      currentEvent = {
        startTime: new Date(reading.date),
        carbCount: reading.mealCarbs,
        readings: [reading],
      };
    }
    // Add reading to current event
    else if (currentEvent.readings.length > 0) {
      currentEvent.readings.push(reading);

      // End of meal event
      if (reading.mealAbsorption === 'end') {
        // Get all glucose values for this meal event
        const glucoseValues = currentEvent.readings.map((r) => r.glucose);
        const deviations = currentEvent.readings.map((r) => Number(r.deviation));
        const startGlucose = glucoseValues[0];

        // Find peak glucose and when it occurred
        const maxGlucose = Math.max(...glucoseValues);
        const maxGlucoseIndex = glucoseValues.indexOf(maxGlucose);

        // Define target range for "return to start" (within 10% of starting glucose)
        const targetReturnRange = {
          lower: startGlucose * 0.9,
          upper: startGlucose * 1.1,
        };

        // Find first reading AFTER peak where glucose returns to within target range
        const returnIndex = currentEvent.readings.findIndex((reading, index) => {
          // Skip any readings before or at peak
          if (index <= maxGlucoseIndex) return false;
          return reading.glucose >= targetReturnRange.lower && reading.glucose <= targetReturnRange.upper;
        });

        // Find first reading AFTER peak where glucose goes low
        const lowIndex = currentEvent.readings.findIndex((reading, index) => {
          // Skip any readings before or at peak
          if (index <= maxGlucoseIndex) return false;
          return reading.glucose <= GLUCOSE_RANGES.LOW;
        });

        // Calculate time and deviations until return to start (if it did return)
        const didReturnToStart = returnIndex !== -1;
        const returnTime = didReturnToStart ? new Date(currentEvent.readings[returnIndex].date) : null;

        // Calculate time and deviations until low (if it was low)
        const didGoLow = lowIndex !== -1;
        const lowTime = didGoLow ? new Date(currentEvent.readings[lowIndex].date) : null;

        // Calculate full meal duration (if returned to start)
        const fullMealDuration = returnTime
          ? (returnTime.getTime() - currentEvent.startTime!.getTime()) / (1000 * 60)
          : null;

        // Calculate full meal duration (if returned to start)
        const fullMealDurationToLow = lowTime
          ? (lowTime.getTime() - currentEvent.startTime!.getTime()) / (1000 * 60)
          : null;

        // Calculate time from start to stabilization (if returned to start)
        const timeToStabilize = returnTime
          ? (returnTime.getTime() - new Date(currentEvent.readings[0].date).getTime()) / (1000 * 60)
          : null;

        // Calculate total deviations until return or end of readings
        const deviationsUntilReturn = currentEvent.readings
          .slice(0, returnIndex !== -1 ? returnIndex + 1 : undefined)
          .reduce((sum, reading) => sum + Number(reading.deviation), 0);

        // Create complete meal event with all analysis
        mealEvents.push({
          ...(currentEvent as Required<typeof currentEvent>),
          endTime: new Date(reading.date),
          // Basic autotune duration
          durationMinutes: (new Date(reading.date).getTime() - currentEvent.startTime!.getTime()) / (1000 * 60),
          // Glucose values
          maxGlucose: maxGlucose,
          minGlucose: Math.min(...glucoseValues),
          startGlucose: glucoseValues[0],
          endGlucose: glucoseValues[glucoseValues.length - 1],
          // Deviation analysis
          peakDeviation: Math.max(...deviations),
          totalDeviation: deviations.reduce((sum, dev) => sum + dev, 0),
          // Timing analysis
          timeToMaxGlucoseMinutes: maxGlucoseIndex * 5, // Assuming 5 minute intervals
          avgDeltaAtStart: currentEvent.readings[0].avgDelta,
          // Stabilization analysis
          didReturnToStart: didReturnToStart,
          fullMealDuration: fullMealDuration,
          timeToStabilize: timeToStabilize,
          deviationsUntilReturn: deviationsUntilReturn,
        });

        // Reset for next meal
        currentEvent = { readings: [] };
      }
    }
  }

  return mealEvents;
}

// interface TimeRangeAnalysis {
//   numReadings: number;
//   avgGlucose: number;
//   avgDeviation: number;
//   highPercentage: number;
//   lowPercentage: number;
//   inRangePercentage: number;
//   inTargetPercentage: number; // Between TARGET_BOTTOM and TARGET_TOP (80-104)
//   inTITRPercentage: number;
//   mealStartsCount: number;
//   mealInProgressCount: number;
//   basalDeviations: number[];
//   isfDeviations: number[];
// }

// interface TimeRangeAnalysisWithHours extends TimeRangeAnalysis {
//   hours: TimeRangeAnalysis[];
// }

enum GlucoseState {
  LOW = 'LOW',
  IN_RANGE = 'IN_RANGE',
  IN_TITR = 'IN_TITR',
  IN_TARGET = 'IN_TARGET',
  HIGH = 'HIGH',
  UNKNOWN = 'UNKNOWN',
}

interface StateCounts {
  [GlucoseState.LOW]: number;
  [GlucoseState.IN_RANGE]: number;
  [GlucoseState.IN_TITR]: number;
  [GlucoseState.IN_TARGET]: number;
  [GlucoseState.HIGH]: number;
  [GlucoseState.UNKNOWN]: number;
}

interface PercentageResults {
  lowPercentage: number;
  inRangePercentage: number;
  inTITRPercentage: number;
  inTargetPercentage: number;
  highPercentage: number;
}

interface AnalysisResult {
  avgGlucose: number;
  avgDeviation: number;
  numReadings: number;
  lowPercentage: number;
  inRangePercentage: number;
  inTITRPercentage: number;
  inTargetPercentage: number;
  highPercentage: number;
}

interface HourlyAnalysisResult extends AnalysisResult {
  mealStartsCount: number;
  mealInProgressCount: number;
  basalDeviations: number[];
  isfDeviations: number[];
}

interface FullAnalysisResult {
  overall: AnalysisResult;
  hourly: AnalysisResult[];
}

// Helper function to determine glucose state
function getGlucoseState(glucose: number): GlucoseState {
  // Needs to go from most specific to least specific to work correctly
  if (glucose >= GLUCOSE_RANGES.TARGET_BOTTOM && glucose <= GLUCOSE_RANGES.TARGET_TOP) return GlucoseState.IN_TARGET;
  if (glucose >= GLUCOSE_RANGES.LOW && glucose <= GLUCOSE_RANGES.TITR_HIGH) return GlucoseState.IN_TITR;
  if (glucose >= GLUCOSE_RANGES.LOW && glucose <= GLUCOSE_RANGES.HIGH) return GlucoseState.IN_RANGE;
  if (glucose < GLUCOSE_RANGES.LOW) return GlucoseState.LOW;
  if (glucose > GLUCOSE_RANGES.HIGH) return GlucoseState.HIGH;
  return GlucoseState.UNKNOWN;
}

class GlucoseAnalysis {
  protected numReadings: number = 0;
  protected avgGlucose: number = 0;
  protected avgDeviation: number = 0;
  protected stateCounts: StateCounts = {
    [GlucoseState.LOW]: 0,
    [GlucoseState.IN_RANGE]: 0,
    [GlucoseState.IN_TITR]: 0,
    [GlucoseState.IN_TARGET]: 0,
    [GlucoseState.HIGH]: 0,
    [GlucoseState.UNKNOWN]: 0,
  };

  addReading(reading: ATReading): void {
    this.numReadings++;

    // Update running averages
    this.avgGlucose = (this.avgGlucose * (this.numReadings - 1) + reading.glucose) / this.numReadings;
    this.avgDeviation = (this.avgDeviation * (this.numReadings - 1) + reading.deviation) / this.numReadings;

    // Update state counts
    const state = getGlucoseState(reading.glucose);
    this.stateCounts[state]++;
  }

  getPercentages(): PercentageResults {
    return {
      lowPercentage: Math.round((this.stateCounts[GlucoseState.LOW] / this.numReadings) * 100),
      inRangePercentage: Math.round(
        ((this.stateCounts[GlucoseState.IN_RANGE] +
          this.stateCounts[GlucoseState.IN_TITR] +
          this.stateCounts[GlucoseState.IN_TARGET]) /
          this.numReadings) *
          100,
      ),
      inTargetPercentage: Math.round((this.stateCounts[GlucoseState.IN_TARGET] / this.numReadings) * 100),
      inTITRPercentage: Math.round(
        ((this.stateCounts[GlucoseState.IN_TITR] + this.stateCounts[GlucoseState.IN_TARGET]) / this.numReadings) * 100,
      ),
      highPercentage: Math.round((this.stateCounts[GlucoseState.HIGH] / this.numReadings) * 100),
    };
  }

  getAnalysis(): AnalysisResult {
    return {
      ...this.getPercentages(),
      avgGlucose: Number(this.avgGlucose.toFixed(1)),
      avgDeviation: Number(this.avgDeviation.toFixed(1)),
      numReadings: this.numReadings,
    };
  }
}

class HourlyGlucoseAnalysis extends GlucoseAnalysis {
  public mealStartsCount: number = 0;
  public mealInProgressCount: number = 0;
  public basalDeviations: number[] = [];
  public isfDeviations: number[] = [];

  getAnalysis(): HourlyAnalysisResult {
    return {
      ...this.getPercentages(),
      avgGlucose: this.avgGlucose,
      avgDeviation: this.avgDeviation,
      numReadings: this.numReadings,
      mealStartsCount: this.mealStartsCount,
      mealInProgressCount: this.mealInProgressCount,
      basalDeviations: this.basalDeviations,
      isfDeviations: this.isfDeviations,
    };
  }
}

function analyzeRange(data: AutotunePreppedData): FullAnalysisResult {
  // Combine all glucose readings
  const allReadings = [...data.CSFGlucoseData, ...data.ISFGlucoseData, ...data.basalGlucoseData];

  const analysis = new GlucoseAnalysis();
  const hourlyAnalyses = Array.from({ length: 24 }, () => new HourlyGlucoseAnalysis());

  // Process each reading
  allReadings.forEach((reading) => {
    const hour = new Date(reading.date).getHours();

    analysis.addReading(reading);
    hourlyAnalyses[hour].addReading(reading);
  });

  // Track meal starts and meal periods
  data.CSFGlucoseData.forEach((reading) => {
    const hour = new Date(reading.date).getHours();
    const hourlyAnalysis = hourlyAnalyses[hour];
    if (reading.mealAbsorption === 'start') {
      hourlyAnalysis.mealStartsCount++;
    }
    hourlyAnalysis.mealInProgressCount++;
  });

  // Track deviations by type
  data.basalGlucoseData.forEach((reading) => {
    const hour = new Date(reading.date).getHours();
    const hourlyAnalysis = hourlyAnalyses[hour];

    hourlyAnalysis.basalDeviations.push(Number(reading.deviation));
  });

  data.ISFGlucoseData.forEach((reading) => {
    const hour = new Date(reading.date).getHours();
    const hourlyAnalysis = hourlyAnalyses[hour];
    hourlyAnalysis.isfDeviations.push(Number(reading.deviation));
  });

  return {
    overall: analysis.getAnalysis(),
    hourly: hourlyAnalyses.map((hourAnalysis) => hourAnalysis.getAnalysis()),
  };
}

export {
  analyzeMealEvents,
  analyzeRange as analyzeTimeOfDay,
  // type TimeRangeAnalysis,
  // type TimeRangeAnalysisWithHours,
  type FullAnalysisResult,
  type AnalysisResult,
  type HourlyAnalysisResult,
  type GlucoseAnalysis,
  type HourlyGlucoseAnalysis,
  type MealEvent,
};
