import { GlucoseUnit } from '@goodnumbers/types';

export function u(value: number, units: GlucoseUnit): string {
  if (units === GlucoseUnit.MMOL) {
    // Convert mg/dL to mmol/L: divide by 18, round to 1 decimal place
    const mmol = value / 18.0;
    return mmol.toFixed(1); // e.g. "5.5"
  }
  // mg/dL: integer, no decimals
  return Math.round(value).toString(); // e.g. "100"
}
