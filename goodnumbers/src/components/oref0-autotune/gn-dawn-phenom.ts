import { AutotunePreppedData } from 'gn-autotune-prep';

interface DawnPatternDay {
  date: string;
  startTime: Date;
  startGlucose: number;
  peakGlucose: number;
  timeOfPeak: Date;
  averageDeviation: number;
  totalDeviation: number;
  duration: number; // minutes
  averageBGI: number;
}

interface DawnAnalysis {
  // Overall pattern strength
  daysShowingPattern: number;
  //   patternStrength: 'none' | 'weak' | 'moderate' | 'strong';

  // Timing analysis
  typicalStartTime: string; // HH:MM format
  typicalDuration: number; // minutes

  // Glucose impact
  averageStartGlucose: number;
  averagePeakGlucose: number;
  averageRise: number;

  // Day by day details
  dailyPatterns: DawnPatternDay[];
}

function checkDawnPhenomenon(data: AutotunePreppedData): DawnAnalysis {
  // Initialize our analysis result
  const analysis: DawnAnalysis = {
    daysShowingPattern: 0,
    // patternStrength: 'none',
    typicalStartTime: '',
    typicalDuration: 0,
    averageStartGlucose: 0,
    averagePeakGlucose: 0,
    averageRise: 0,
    dailyPatterns: [],
  };

  // Group basal glucose data by day
  const dailyData = new Map<string, Array<(typeof data.basalGlucoseData)[0]>>();

  // Only look at readings between 2 AM and 8 AM
  data.basalGlucoseData.forEach((reading) => {
    const readingTime = new Date(reading.date);
    const hour = readingTime.getHours();

    if (hour >= 2 && hour < 8) {
      const dateKey = readingTime.toISOString().split('T')[0];
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, []);
      }
      dailyData.get(dateKey)?.push(reading);
    }
  });

  // Check each day for dawn phenomenon pattern
  dailyData.forEach((readings, dateKey) => {
    // Sort readings by time
    readings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Look for sustained rise pattern
    let riseStart: (typeof readings)[0] | null = null;
    let riseEnd: (typeof readings)[0] | null = null;
    let peakReading = readings[0];
    let consecutiveRise = 0;

    // Check if we have any meal activity during this time
    const hasMealActivity = data.CSFGlucoseData.some((meal) => {
      const mealTime = new Date(meal.date);
      const mealHour = mealTime.getHours();
      const mealDate = mealTime.toISOString().split('T')[0];
      return mealDate === dateKey && mealHour >= 2 && mealHour < 8;
    });

    if (!hasMealActivity) {
      // Look for pattern of rising glucose with positive deviations
      for (let i = 1; i < readings.length; i++) {
        const reading = readings[i];

        // Look for positive deviations and rising glucose
        if (reading.deviation > 0 && reading.avgDelta > 0) {
          if (!riseStart) {
            riseStart = readings[i - 1];
          }
          consecutiveRise++;

          // Track peak glucose
          if (reading.glucose > peakReading.glucose) {
            peakReading = reading;
          }
        } else {
          // If we've found a significant rise pattern
          if (consecutiveRise >= 3) {
            // At least 15 minutes of rise
            riseEnd = readings[i - 1];
          }
          consecutiveRise = 0;
        }
      }

      // If we found a significant pattern
      if (riseStart && riseEnd && peakReading.glucose - riseStart.glucose > 20) {
        const patternDay: DawnPatternDay = {
          date: dateKey,
          startTime: new Date(riseStart.date),
          startGlucose: riseStart.glucose,
          peakGlucose: peakReading.glucose,
          timeOfPeak: new Date(peakReading.date),
          averageDeviation: readings.reduce((sum, r) => sum + Number(r.deviation), 0) / readings.length,
          totalDeviation: readings.reduce((sum, r) => sum + Number(r.deviation), 0),
          duration: (new Date(riseEnd.date).getTime() - new Date(riseStart.date).getTime()) / (1000 * 60),
          averageBGI: readings.reduce((sum, r) => sum + Number(r.BGI), 0) / readings.length,
        };

        analysis.dailyPatterns.push(patternDay);
      }
    }
  });

  // Calculate summary statistics
  if (analysis.dailyPatterns.length > 0) {
    analysis.daysShowingPattern = analysis.dailyPatterns.length;

    // Calculate typical start time
    const startTimes = analysis.dailyPatterns.map((d) => d.startTime.getHours() * 60 + d.startTime.getMinutes());
    const avgStartMinutes = startTimes.reduce((sum, t) => sum + t, 0) / startTimes.length;
    const startHour = Math.floor(avgStartMinutes / 60);
    const startMinute = Math.round(avgStartMinutes % 60);
    analysis.typicalStartTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

    // Calculate averages
    analysis.typicalDuration =
      analysis.dailyPatterns.reduce((sum, d) => sum + d.duration, 0) / analysis.dailyPatterns.length;

    analysis.averageStartGlucose =
      analysis.dailyPatterns.reduce((sum, d) => sum + d.startGlucose, 0) / analysis.dailyPatterns.length;

    analysis.averagePeakGlucose =
      analysis.dailyPatterns.reduce((sum, d) => sum + d.peakGlucose, 0) / analysis.dailyPatterns.length;

    analysis.averageRise = analysis.averagePeakGlucose - analysis.averageStartGlucose;

    // Determine pattern strength
    // const patternFrequency = analysis.daysShowingPattern / 7; // Assuming 7 days of data
    // const averageRiseSignificance = analysis.averageRise > 30;
    // const consistentTiming = new Set(startTimes).size < 4; // Less than 4 different start times

    // if (patternFrequency > 0.7 && averageRiseSignificance && consistentTiming) {
    //   analysis.patternStrength = 'strong';
    // } else if (patternFrequency > 0.4 && analysis.averageRise > 20) {
    //   analysis.patternStrength = 'moderate';
    // } else if (analysis.daysShowingPattern > 1) {
    //   analysis.patternStrength = 'weak';
    // }
  }

  return analysis;
}

export { checkDawnPhenomenon, type DawnAnalysis, type DawnPatternDay };
