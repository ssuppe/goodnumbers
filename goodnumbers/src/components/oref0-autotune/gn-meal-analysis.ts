import { AutotunePreppedData } from 'gn-autotune-prep';

// Thresholds for glucose values in mg/dL
const GLUCOSE_RANGES = {
  VERY_LOW: 54,
  LOW: 70,
  TARGET_BOTTOM: 80,
  TARGET_TOP: 160,
  HIGH: 180,
  VERY_HIGH: 250,
} as const;

interface MealEvent {
  startTime: Date;
  endTime: Date;
  durationMinutes: number; // Time until autotune marks 'end'
  fullMealDuration: number | null; // Time until glucose returns to near starting level
  glucoseReturnTime: Date | null; // When glucose returned to within 10% of start
  didReturnToStart: boolean; // Did it ever return to within 10% of start?
  deviationsUntilReturn: number; // Total deviations until return to start
  carbCount: number | undefined;
  readings: AutotunePreppedData['CSFGlucoseData'];

  // Analysis results
  maxGlucose: number;
  minGlucose: number;
  startGlucose: number;
  endGlucose: number;
  peakDeviation: number;
  totalDeviation: number;
  timeToMaxGlucose: number; // minutes
  avgDeltaAtStart: number; // rate of change at meal start
}

function analyzeMealEvents(data: AutotunePreppedData): MealEvent[] {
  // Array to store all completed meal events we'll find
  const mealEvents: MealEvent[] = [];

  // Object to track the current meal we're analyzing
  // Note: we have to define it with readings array because TypeScript needs it
  let currentEvent: Partial<MealEvent> & { readings: AutotunePreppedData['CSFGlucoseData'] } = {
    readings: [],
  };

  // Process CSFGlucoseData to extract meal events
  // Loop through CSFGlucoseData (the meal-related readings)
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
        const glucoseValues = currentEvent.readings.map((r) => r.glucose);
        const deviations = currentEvent.readings.map((r) => Number(r.deviation));

        const maxGlucose = Math.max(...glucoseValues);
        const maxGlucoseIndex = glucoseValues.indexOf(maxGlucose);

        // Look at time to return back to start BG
        const startGlucose = glucoseValues[0];
        const targetRange = {
          lower: startGlucose * 0.9,
          upper: startGlucose * 1.1,
        };

        // Find first reading after peak where glucose returns to within 10% of start
        let returnIndex = currentEvent.readings.findIndex((reading, index) => {
          // Only look at readings after peak
          if (index <= maxGlucoseIndex) return false;
          return reading.glucose >= targetRange.lower && reading.glucose <= targetRange.upper;
        });

        const returnTime = returnIndex !== -1 ? new Date(currentEvent.readings[returnIndex].date) : null;

        const fullDurationMinutes = returnTime
          ? (returnTime.getTime() - currentEvent.startTime!.getTime()) / (1000 * 60)
          : null;

        // Calculate deviations until return or end of readings
        const deviationsUntilReturn = currentEvent.readings
          .slice(0, returnIndex !== -1 ? returnIndex + 1 : undefined)
          .reduce((sum, reading) => sum + Number(reading.deviation), 0);

        // Complete the meal event data
        mealEvents.push({
          ...(currentEvent as Required<typeof currentEvent>),
          endTime: new Date(reading.date),
          durationMinutes: (new Date(reading.date).getTime() - currentEvent.startTime!.getTime()) / (1000 * 60),
          maxGlucose,
          minGlucose: Math.min(...glucoseValues),
          startGlucose: glucoseValues[0],
          endGlucose: glucoseValues[glucoseValues.length - 1],
          peakDeviation: Math.max(...deviations),
          totalDeviation: deviations.reduce((sum, dev) => sum + dev, 0),
          timeToMaxGlucose: maxGlucoseIndex * 5, // Assuming 5 minute intervals
          avgDeltaAtStart: currentEvent.readings[0].avgDelta,
          fullMealDuration: fullDurationMinutes,
          glucoseReturnTime: returnTime,
          didReturnToStart: returnIndex !== -1,
          deviationsUntilReturn,
        });

        // Reset current event
        currentEvent = { readings: [] };
      }
    }
  }

  return mealEvents;
}

interface TimeOfDayAnalysis {
  hour: number;
  readings: number;
  avgGlucose: number;
  avgDeviation: number;
  highPercentage: number;
  lowPercentage: number;
  inRangePercentage: number;
  mealStartsCount: number;
  mealInProgressCount: number;
  basalDeviations: number[];
  isfDeviations: number[];
}

function analyzeTimeOfDay(data: AutotunePreppedData): TimeOfDayAnalysis[] {
  const hourlyAnalysis: TimeOfDayAnalysis[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    readings: 0,
    avgGlucose: 0,
    avgDeviation: 0,
    highPercentage: 0,
    lowPercentage: 0,
    inRangePercentage: 0,
    mealStartsCount: 0,
    mealInProgressCount: 0,
    basalDeviations: [],
    isfDeviations: [],
  }));

  // Combine all glucose readings
  const allReadings = [...data.CSFGlucoseData, ...data.ISFGlucoseData, ...data.basalGlucoseData];

  // Process each reading
  allReadings.forEach((reading) => {
    const hour = new Date(reading.date).getHours();
    const analysis = hourlyAnalysis[hour];

    // Update basic statistics
    analysis.readings++;
    analysis.avgGlucose = (analysis.avgGlucose * (analysis.readings - 1) + reading.glucose) / analysis.readings;

    // Track high/low/in-range
    if (reading.glucose > GLUCOSE_RANGES.HIGH) {
      analysis.highPercentage = (analysis.highPercentage * (analysis.readings - 1) + 100) / analysis.readings;
    } else if (reading.glucose < GLUCOSE_RANGES.LOW) {
      analysis.lowPercentage = (analysis.lowPercentage * (analysis.readings - 1) + 100) / analysis.readings;
    } else {
      analysis.inRangePercentage = (analysis.inRangePercentage * (analysis.readings - 1) + 100) / analysis.readings;
    }
  });

  // Track meal starts and meal periods
  data.CSFGlucoseData.forEach((reading) => {
    const hour = new Date(reading.date).getHours();

    if (reading.mealAbsorption === 'start') {
      hourlyAnalysis[hour].mealStartsCount++;
    }
    hourlyAnalysis[hour].mealInProgressCount++;
  });

  // Track deviations by type
  data.basalGlucoseData.forEach((reading) => {
    const hour = new Date(reading.date).getHours();
    hourlyAnalysis[hour].basalDeviations.push(Number(reading.deviation));
  });

  data.ISFGlucoseData.forEach((reading) => {
    const hour = new Date(reading.date).getHours();
    hourlyAnalysis[hour].isfDeviations.push(Number(reading.deviation));
  });

  return hourlyAnalysis;
}

interface DailyPatternSummary {
  meals: {
    averageDuration: number;
    commonStartTimes: number[];
    spikePatterns: {
      fastRises: number; // Count of rises >2 mg/dL/min
      slowRises: number; // Count of rises <1 mg/dL/min
      avgTimeToMax: number;
    };
    impactPatterns: {
      // Autotune's assessment of meal impact
      autotuneAvgDuration: number;
      autotuneMinDuration: number;
      autotuneMaxDuration: number;

      // Time until glucose returns to starting range
      avgTimeToStabilize: number; // Only for meals that did stabilize
      stabilizeRate: number; // % of meals that returned to starting range
      typicalStabilizeTime: number; // 75th percentile of stabilization times

      // Deviation patterns
      avgDeviationsUntilStable: number;
      totalMealsAnalyzed: number;
      mealsWithExtendedImpact: number; // Meals taking >4h to stabilize
    };
  };
  problematicHours: {
    highRisk: number[]; // Hours with >30% high readings
    lowRisk: number[]; // Hours with >15% low readings
    mealRelated: boolean; // Whether issues correlate with meal times
  };
  sensitivityPatterns: {
    hourlyISFIssues: number[]; // Hours with consistent ISF deviations
    hourlyBasalIssues: number[]; // Hours with consistent basal deviations
  };
}

function generatePatternSummary(mealEvents: MealEvent[], hourlyAnalysis: TimeOfDayAnalysis[]): DailyPatternSummary {
  // Initialize our summary object
  const summary: DailyPatternSummary = {
    meals: {
      averageDuration: 0,
      commonStartTimes: [],
      spikePatterns: {
        fastRises: 0,
        slowRises: 0,
        avgTimeToMax: 0,
      },
      impactPatterns: {
        autotuneAvgDuration: 0,
        autotuneMinDuration: Infinity,
        autotuneMaxDuration: 0,
        avgTimeToStabilize: 0,
        stabilizeRate: 0,
        typicalStabilizeTime: 0,
        avgDeviationsUntilStable: 0,
        totalMealsAnalyzed: mealEvents.length,
        mealsWithExtendedImpact: 0,
      },
    },
    problematicHours: {
      highRisk: [],
      lowRisk: [],
      mealRelated: false,
    },
    sensitivityPatterns: {
      hourlyISFIssues: [],
      hourlyBasalIssues: [],
    },
  };

  // Only analyze if we have meal events
  if (mealEvents != null && mealEvents.length > 0) {
    // Calculate average meal duration (autotune duration)
    summary.meals.averageDuration =
      mealEvents.reduce((sum, event) => sum + event.durationMinutes, 0) / mealEvents.length;

    // Find hours where >20% of meals start
    const mealThreshold = mealEvents.length * 0.2;
    summary.meals.commonStartTimes = hourlyAnalysis
      .filter((hour) => hour.mealStartsCount > mealThreshold)
      .map((hour) => hour.hour);

    // Analyze glucose rise patterns
    let totalTimeToMax = 0;
    mealEvents.forEach((event) => {
      // Calculate how fast glucose rises (mg/dL/min)
      const riseRate = (event.maxGlucose - event.startGlucose) / (event.timeToMaxGlucose / 60);

      if (riseRate > 2) summary.meals.spikePatterns.fastRises++;
      if (riseRate < 1) summary.meals.spikePatterns.slowRises++;
      totalTimeToMax += event.timeToMaxGlucose;
    });
    summary.meals.spikePatterns.avgTimeToMax = totalTimeToMax / mealEvents.length;

    // Analyze autotune's meal impact assessment
    const autotuneDurations = mealEvents.map((e) => e.durationMinutes);
    summary.meals.impactPatterns.autotuneAvgDuration =
      autotuneDurations.reduce((sum, d) => sum + d, 0) / mealEvents.length;
    summary.meals.impactPatterns.autotuneMinDuration = Math.min(...autotuneDurations);
    summary.meals.impactPatterns.autotuneMaxDuration = Math.max(...autotuneDurations);

    // Analyze full meal impact until stabilization
    const stabilizedMeals = mealEvents.filter(
      (e): e is MealEvent & { didReturnToStart: true } => e.didReturnToStart === true,
    );

    const stabilizationTimes = stabilizedMeals!
      .map((e) => e.fullMealDuration!)
      .sort((a, b) => {
        if (a == null) a = 0;
        if (b == null) b = 0;
        return a - b;
      });

    // Calculate percentage of meals that returned to starting range
    summary.meals.impactPatterns.stabilizeRate = (stabilizedMeals.length / mealEvents.length) * 100;

    if (stabilizedMeals.length > 0) {
      // Filter out null values once

      // Average time until glucose returns to starting range
      summary.meals.impactPatterns.avgTimeToStabilize =
        (stabilizationTimes ?? []).length > 0
          ? (stabilizationTimes ?? []).reduce((sum, t) => (sum ?? 0) + (t ?? 0), 0) / (stabilizationTimes ?? []).length
          : 0;

      // 75th percentile of stabilization times
      const p75Index = Math.floor(stabilizationTimes.length * 0.75);
      summary.meals.impactPatterns.typicalStabilizeTime = stabilizationTimes[p75Index] ?? 0;

      // Average total deviation until return to starting range
      summary.meals.impactPatterns.avgDeviationsUntilStable =
        stabilizedMeals.reduce((sum, meal) => sum + meal.deviationsUntilReturn, 0) / stabilizedMeals.length;
    }
    // Count meals with extended impact (>4 hours)
    summary.meals.impactPatterns.mealsWithExtendedImpact = mealEvents.filter((event) => {
      if (event.didReturnToStart) {
        // Only count if fullMealDuration exists and is >4 hours
        return event.fullMealDuration != null && event.fullMealDuration > 240;
      } else {
        // For meals that didn't return to start, use autotune duration
        return event.durationMinutes > 240;
      }
    }).length;
  }

  // Analyze each hour for problems
  hourlyAnalysis.forEach((hour, index) => {
    // Look for hours with frequent highs/lows
    if (hour.highPercentage > 30) {
      summary.problematicHours.highRisk.push(index);
    }
    if (hour.lowPercentage > 15) {
      summary.problematicHours.lowRisk.push(index);
    }

    // Check for insulin sensitivity issues
    if (hour.isfDeviations.length > 0) {
      const avgISFDeviation = hour.isfDeviations.reduce((sum, dev) => sum + dev, 0) / hour.isfDeviations.length;

      // If average deviation is significant, mark as problematic
      if (Math.abs(avgISFDeviation) > 20) {
        summary.sensitivityPatterns.hourlyISFIssues.push(index);
      }
    }

    // Check for basal rate issues
    if (hour.basalDeviations.length > 0) {
      const avgBasalDeviation = hour.basalDeviations.reduce((sum, dev) => sum + dev, 0) / hour.basalDeviations.length;

      // If average deviation is significant, mark as problematic
      if (Math.abs(avgBasalDeviation) > 20) {
        summary.sensitivityPatterns.hourlyBasalIssues.push(index);
      }
    }
  });

  // Check if problems tend to happen around meals
  const mealRelatedHours = new Set([
    ...summary.meals.commonStartTimes,
    // Include 2 hours after common meal times
    ...summary.meals.commonStartTimes.map((h) => (h + 1) % 24),
    ...summary.meals.commonStartTimes.map((h) => (h + 2) % 24),
  ]);

  // Combine all problematic hours
  const problemHours = new Set([...summary.problematicHours.highRisk, ...summary.problematicHours.lowRisk]);

  // If >50% of problems overlap with meal times, consider it meal-related
  const overlappingHours = [...problemHours].filter((h) => mealRelatedHours.has(h));
  summary.problematicHours.mealRelated = overlappingHours.length > problemHours.size * 0.5;

  return summary;
}

export {
  analyzeMealEvents,
  analyzeTimeOfDay,
  generatePatternSummary,
  type AutotunePreppedData,
  type MealEvent,
  type TimeOfDayAnalysis,
  type DailyPatternSummary,
};
