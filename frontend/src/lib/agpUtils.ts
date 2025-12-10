export type GlucoseUnit = 'MGDL' | 'MMOL';

const MG_DL_PER_MMOL_L = 18.0182;

// Safety limits for glucose values (in mg/dL)
// Values outside this range are considered errors/artifacts and should not be displayed
const MIN_VALID_GLUCOSE = 10;
const MAX_VALID_GLUCOSE = 1000;

/**
 * Returns the clinical low/high thresholds based on the requested unit.
 */
export function getClinicalThresholds(units: GlucoseUnit) {
  if (units === 'MMOL') {
    return { low: 3.9, high: 10.0 };
  }
  return { low: 70, high: 180 };
}

/**
 * Converts a glucose value from mg/dL to the target unit.
 * Includes a SAFETY GUARD to reject biologically impossible values.
 */
function convertGlucose(value: number | null, toUnits: GlucoseUnit): number | null {
  if (value === null || value === undefined) return null;

  // Safety Guard: Reject impossible values before conversion
  // We assume raw data is always mg/dL (per our invariant)
  if (value < MIN_VALID_GLUCOSE || value > MAX_VALID_GLUCOSE) {
    console.warn(`[Safety Guard] Rejected invalid glucose value: ${value}`);
    return null;
  }

  if (toUnits === 'MMOL') {
    // Round to 1 decimal place for mmol/L
    return Math.round((value / MG_DL_PER_MMOL_L) * 10) / 10;
  }

  // Return as-is for mg/dL (ensure it's an integer)
  return Math.round(value);
}

/**
 * Normalizes raw API data for the chart.
 * 1. Converts units if necessary.
 * 2. STRIPS extraneous fields (PII) for security.
 * 3. Handles nulls safely.
 */
export function normalizeAgpData(rawData: any[], units: GlucoseUnit) {
  if (!Array.isArray(rawData)) return [];

  return rawData.map((item) => ({
    // Explicitly allowlist only the fields we need for the chart
    time: item.time,
    p5: convertGlucose(item.p5, units),
    p25: convertGlucose(item.p25, units),
    median: convertGlucose(item.median, units),
    mean: convertGlucose(item.mean, units),
    p75: convertGlucose(item.p75, units),
    p95: convertGlucose(item.p95, units),
  }));
}
