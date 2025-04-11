'use server';
import { quantile, mean } from 'd3-array';
import { GlucoseUnits } from '@/types/nightscout';
import { AgpDataPoint } from './AgpChart';
import { ATReading, AutotunePreppedData } from '@/lib/oref0-autotune/gn-autotune-prep';
import { MG_DL_PER_MMOL_L } from '@/utils/utils';

/**
 * **CRITICAL ASSUMPTION:** The unit of the 'glucose' field in the source ATReading data.
 * Change this if your source data is in mmol/L.
 */
const SOURCE_GLUCOSE_UNIT: GlucoseUnits = 'mg/dl';

/**
 * Minimum number of data points required within a 30-minute bucket
 * to calculate meaningful percentiles. Below this, percentiles will be null.
 * Mean will still be calculated if any data exists.
 */
const MIN_DATA_POINTS_FOR_PERCENTILE = 5;

/**
 * Processes Autotune prepped data to generate aggregated data points
 * suitable for an Ambulatory Glucose Profile (AGP) chart.
 *
 * @param autotuneData - The input data containing glucose readings across different categories.
 * @param targetUnits - The desired units ('mg/dl' or 'mmol/L') for the output AGP data.
 * @returns An array of AgpDataPoint objects, one for each 30-minute interval of the day,
 *          sorted chronologically. Returns an empty array if input data is missing or invalid.
 */
export async function generateAgpData(
  autotuneData: AutotunePreppedData | null | undefined,
  targetUnits: GlucoseUnits,
): Promise<AgpDataPoint[]> {
  if (!autotuneData) {
    console.warn('generateAgpData: Input autotuneData is null or undefined.');
    return [];
  }

  // --- Step 1: Combine and Prepare Glucose Readings ---
  const allGlucoseReadings: { timestamp: Date; glucoseValue: number }[] = [];

  const processReadings = async (readings: ATReading[] | undefined) => {
    if (!readings) return;
    for (const reading of readings) {
      // Check if date is a valid number and glucose is a valid number
      if (typeof reading.date !== 'number' || typeof reading.glucose !== 'number' || reading.glucose <= 0) {
        // Skip invalid readings
        continue;
      }

      try {
        // Create a Date object directly from the numeric timestamp
        const timestamp = new Date(reading.date);

        // Validate that we got a valid date (not NaN)
        if (!isNaN(timestamp.getTime())) {
          allGlucoseReadings.push({
            timestamp: timestamp,
            glucoseValue: reading.glucose, // Keep in original source unit for now
          });
        } else {
          console.warn(`generateAgpData: Invalid timestamp value: ${reading.date}`);
        }
      } catch (error) {
        console.warn(`generateAgpData: Error processing reading: ${error}`);
      }
    }
  };

  await processReadings(autotuneData.CSFGlucoseData);
  await processReadings(autotuneData.ISFGlucoseData);
  await processReadings(autotuneData.basalGlucoseData);

  if (allGlucoseReadings.length === 0) {
    console.warn('generateAgpData: No valid glucose readings found after combining data.');
    return [];
  }

  // --- Step 2: Group Readings by 30-Minute Time Slot ---
  const timeSlotBuckets = new Map<string, number[]>();
  const timeSlotKeys: string[] = []; // Keep track of keys in order

  // Initialize the map with 48 empty arrays and store keys
  for (let hour = 0; hour < 24; hour++) {
    const hourStr = hour.toString().padStart(2, '0');
    const key1 = `${hourStr}:00`;
    const key2 = `${hourStr}:30`;
    timeSlotBuckets.set(key1, []);
    timeSlotBuckets.set(key2, []);
    timeSlotKeys.push(key1, key2); // Add keys in chronological order
  }

  // Process each reading and place it in the correct time slot bucket
  for (const reading of allGlucoseReadings) {
    const hour = reading.timestamp.getHours();
    const minute = reading.timestamp.getMinutes();

    const hourStr = hour.toString().padStart(2, '0');
    const timeSlotKey = minute < 30 ? `${hourStr}:00` : `${hourStr}:30`;

    // Unit Conversion
    let convertedGlucoseValue = reading.glucoseValue;
    if (SOURCE_GLUCOSE_UNIT === 'mg/dl' && targetUnits === 'mmol/L') {
      convertedGlucoseValue /= MG_DL_PER_MMOL_L;
    } else if (SOURCE_GLUCOSE_UNIT === 'mmol/L' && targetUnits === 'mg/dl') {
      convertedGlucoseValue *= MG_DL_PER_MMOL_L;
    }
    // else: units match, no conversion needed

    const bucket = timeSlotBuckets.get(timeSlotKey);
    // We initialized all keys, so bucket should always exist, but check defensively
    if (bucket) {
      bucket.push(convertedGlucoseValue);
    } else {
      console.warn(`generateAgpData: Unexpected missing time slot key: ${timeSlotKey}`);
    }
  }

  // --- Step 3: Calculate Statistics for Each Time Slot ---
  const agpResultData: AgpDataPoint[] = [];

  // Use the pre-ordered list of keys
  for (const timeKey of timeSlotKeys) {
    const glucoseValues = timeSlotBuckets.get(timeKey) ?? []; // Get bucket, default to empty array

    let p5: number | null = null;
    let p25: number | null = null;
    let median: number | null = null;
    let p75: number | null = null;
    let p95: number | null = null;
    let meanValue: number | null = null;

    if (glucoseValues.length > 0) {
      // Calculate mean if there's any data
      // d3.mean returns undefined for empty array, null check handles this
      meanValue = mean(glucoseValues) ?? null;

      // Calculate percentiles only if enough data points exist
      if (glucoseValues.length >= MIN_DATA_POINTS_FOR_PERCENTILE) {
        // Sort the array IN PLACE for quantile calculation
        // Note: d3.quantile expects sorted array for performance.
        // Create a copy if you need the original order elsewhere, but here it's fine.
        glucoseValues.sort((a, b) => a - b);

        // d3.quantile(sortedValues, p) returns the pth quantile (0 <= p <= 1)
        // It returns undefined if the array is empty, null check handles this
        p5 = quantile(glucoseValues, 0.05) ?? null;
        p25 = quantile(glucoseValues, 0.25) ?? null;
        median = quantile(glucoseValues, 0.5) ?? null; // Median is 50th percentile
        p75 = quantile(glucoseValues, 0.75) ?? null;
        p95 = quantile(glucoseValues, 0.95) ?? null;
      }
    }
    // If glucoseValues.length is 0, all values remain null, which is correct.

    agpResultData.push({
      time: timeKey,
      p5: p5,
      p25: p25,
      median: median,
      mean: meanValue,
      p75: p75,
      p95: p95,
    });
  }

  // --- Step 4: Return Result ---
  return agpResultData;
}

// --- Example Usage (demonstration) ---
/*
// Assume you have your 'autotuneData' object populated
const exampleAutotuneData: AutotunePreppedData = {
    // ... fill with realistic sample data ...
    CSFGlucoseData: [{ date: "2024-03-15T10:05:00Z", glucose: 110 }, { date: "2024-03-15T10:33:00Z", glucose: 115 }],
    ISFGlucoseData: [{ date: "2024-03-15T14:15:00Z", glucose: 140 }, { date: "2024-03-15T14:40:00Z", glucose: 135 }],
    basalGlucoseData: [{ date: "2024-03-16T03:10:00Z", glucose: 95 }, { date: "2024-03-16T03:45:00Z", glucose: 90 }],
    CRData: [] // Ignored for this function
};

// Generate AGP data in mg/dL
const agpDataMgdl = generateAgpData(exampleAutotuneData, 'mg/dl');
console.log("AGP Data (mg/dL):", agpDataMgdl);

// Generate AGP data in mmol/L
const agpDataMmol = generateAgpData(exampleAutotuneData, 'mmol/L');
console.log("AGP Data (mmol/L):", agpDataMmol);
*/
