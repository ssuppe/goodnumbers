// import { ATReading } from '../gn-autotune-prep';
// import { DawnPatternSegment, RiseCharacteristics } from './gn-dawn-phenom-interfaces';

import { ATReading, AutotunePreppedData } from '../gn-autotune-prep';
import { PatientRange } from '../gn-overview';
import { CleanRise, MorningRise, MorningRiseAnalysis } from './gn-dawn-phenom-interfaces';
import { clusterStartTimes, TimeCluster } from './gn-dawn-phenom';
import { NightscoutTreatment } from '@/types/nightscout';

// Minimum 45 minutes for a meaningful rise
const MIN_RISE_DURATION = 45; // minutes
// Need at least 9 readings (assuming 5-min intervals) to establish pattern
const MIN_READINGS = MIN_RISE_DURATION / 5;

function calculateShortDelta(
  readings: ATReading[], // Should be sorted by time
  currentIndex: number,
  lookbackMinutes: number = 15,
): number {
  if (currentIndex < 1) return 0;

  const currentReading = readings[currentIndex];
  const currentTime = new Date(currentReading.date).getTime();

  // Look back through readings to find ones within our window
  let oldestIndex = currentIndex;
  for (let i = currentIndex - 1; i >= 0; i--) {
    const readingTime = new Date(readings[i].date).getTime();
    const minutesAgo = (currentTime - readingTime) / (1000 * 60);

    if (minutesAgo <= lookbackMinutes) {
      oldestIndex = i;
    } else {
      break;
    }
  }

  // If we didn't find enough readings, return 0
  if (oldestIndex === currentIndex) return 0;

  const oldestReading = readings[oldestIndex];
  const timeDiff = (currentTime - new Date(oldestReading.date).getTime()) / (1000 * 60); // in minutes

  // Calculate rate of change per minute
  return (currentReading.glucose - oldestReading.glucose) / timeDiff;
}

export function analyzeMorningRises(data: AutotunePreppedData, patient_range: PatientRange): MorningRiseAnalysis {
  // Initialize result
  const analysis: MorningRiseAnalysis = {
    risesWithCarbs: [],
    risesAfterLows: [],
    cleanRises: [],
    daysAnalyzed: 0,
  };

  // Group data by day
  const dailyData = new Map<
    string,
    {
      readings: ATReading[];
      treatments: NightscoutTreatment[];
    }
  >();

  // Helper to add reading to daily data
  const addToDaily = (date: Date, reading: ATReading) => {
    const dateKey = date.toISOString().split('T')[0];
    if (!dailyData.has(dateKey)) {
      dailyData.set(dateKey, { readings: [], treatments: [] });
    }
    dailyData.get(dateKey)!.readings.push(reading);
  };

  // Collect all early morning readings (1-8 AM)
  data.basalGlucoseData.forEach((reading) => {
    const readingTime = new Date(reading.date);
    const hour = readingTime.getHours();
    if (hour >= 1 && hour < 8) {
      addToDaily(readingTime, reading);
    }
  });

  // Mark how many days we analyzed
  analysis.daysAnalyzed = dailyData.size;

  // Analyze each day
  dailyData.forEach((dayData, dateKey) => {
    // Sort readings by time
    const readings = dayData.readings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Look for rises
    let riseStart: ATReading | null = null;
    let consecutiveRise = 0;
    let riseReadings: ATReading[] = [];

    for (let i = 1; i < readings.length; i++) {
      const reading = readings[i];
      const prevReading = readings[i - 1];
      const shortDelta = calculateShortDelta(readings, i);

      if (reading.glucose > prevReading.glucose || shortDelta > 0) {
        if (!riseStart) {
          riseStart = prevReading;
          riseReadings = [prevReading, reading];
        } else {
          riseReadings.push(reading);
        }
        consecutiveRise++;
      } else {
        // If we found a significant rise (at least 3 readings)
        if (consecutiveRise >= MIN_READINGS && riseStart) {
          const riseDuration = (new Date(reading.date).getTime() - new Date(riseStart.date).getTime()) / (1000 * 60);

          if (riseDuration >= MIN_RISE_DURATION) {
            const rise = createMorningRise(riseReadings);

            // 1. Check for carbs first
            const carbTreatment = findCarbTreatment(data.CSFGlucoseData, rise.startTime, dateKey);

            if (carbTreatment) {
              // If we found carbs, categorize as rise with carbs
              analysis.risesWithCarbs.push({
                ...rise,
                carbAmount: carbTreatment.mealCarbs!,
                carbTime: new Date(carbTreatment.date),
              });
            } else {
              // 2. If no carbs, check for prior low
              const priorLow = findPriorLow(readings, rise.startTime, patient_range.target_low);

              if (priorLow) {
                // If we found a low, categorize as rise after low
                analysis.risesAfterLows.push({
                  ...rise,
                  lowGlucose: priorLow.glucose,
                  lowTime: new Date(priorLow.date),
                });
              } else {
                // 3. If no carbs and no prior low, this is a clean rise
                analysis.cleanRises.push(rise);
              }
            }
          }
        }
        // Reset counters for next potential rise
        consecutiveRise = 0;
        riseStart = null;
        riseReadings = [];
      }
    }
  });

  // Calculate summary statistics for clean rises
  if (analysis.cleanRises.length > 0) {
    // Average rise rate
    analysis.averageCleanRiseRate =
      analysis.cleanRises.reduce((sum, rise) => sum + rise.riseRate, 0) / analysis.cleanRises.length;

    // Typical start time
    const startMinutes = analysis.cleanRises.map((rise) => {
      const time = rise.startTime;
      return time.getHours() * 60 + time.getMinutes();
    });
    const avgStartMinute = Math.round(startMinutes.reduce((sum, min) => sum + min, 0) / startMinutes.length);
    analysis.typicalStartTime = formatMinutes(avgStartMinute);
    const startTimes: Date[] = analysis.cleanRises.map((rise) => {
      return rise.startTime;
    });
    const clusteredStartTimes = clusterStartTimes(startTimes, 30);
    analysis.startTimeClusters = clusteredStartTimes;
  }

  return analysis;
}

function createMorningRise(readings: ATReading[]): MorningRise {
  const startTime = new Date(readings[0].date);
  const endTime = new Date(readings[readings.length - 1].date);
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  return {
    startTime,
    endTime,
    startGlucose: readings[0].glucose,
    endGlucose: readings[readings.length - 1].glucose,
    duration,
    riseRate: (readings[readings.length - 1].glucose - readings[0].glucose) / duration,
    readings,
  };
}

function findCarbTreatment(csfData: ATReading[], riseStart: Date, dateKey: string): ATReading | null {
  // Look for CSF data indicating meal absorption starting
  // within 30 minutes before rise start
  const thirtyMinsBefore = new Date(riseStart.getTime() - 30 * 60 * 1000);

  return (
    csfData.find((reading) => {
      const readingDate = new Date(reading.date);
      const readingDateKey = readingDate.toISOString().split('T')[0];

      return (
        readingDateKey === dateKey && reading.mealCarbs && readingDate >= thirtyMinsBefore && readingDate <= riseStart
      );
    }) || null
  );
}

function findPriorLow(readings: ATReading[], riseStart: Date, lowThreshold: number): ATReading | null {
  // Look back 60 minutes before rise start for any lows
  const sixtyMinsBefore = new Date(riseStart.getTime() - 60 * 60 * 1000);

  return (
    readings.find((reading) => {
      const readingTime = new Date(reading.date);
      return readingTime >= sixtyMinsBefore && readingTime < riseStart && reading.glucose <= lowThreshold;
    }) || null
  );
}

export function formatMinutes(mins: number, roundTime: boolean = false): string {
  if (roundTime) {
    // Round to nearest 15 minutes (15 minutes = 15 units in our minutes-since-midnight system)
    mins = Math.round(mins / 15) * 15;
  }

  let hours = Math.floor(mins / 60);
  let minutes = Math.round(mins % 60);

  // Handle case where rounding pushes minutes to 60
  if (minutes === 60) {
    minutes = 0;
    hours += 1;
  }

  // Handle case where hours exceeds 23
  hours = hours % 24;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function getUniqueDays(entries: CleanRise[]): number {
  const uniqueDays = new Set(entries.map((entry) => new Date(entry.startTime).toISOString().split('T')[0]));

  return uniqueDays.size;
}
