import { GlucoseUnits } from '@/types/nightscout';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Function to format a number in thousands (K) or millions (M) format depending on its value
export const getSuffixNumber = (number: number, digits: number = 1): string => {
  const lookup = [
    { value: 1, symbol: '' },
    { value: 1e3, symbol: 'K' },
    { value: 1e6, symbol: 'M' },
    { value: 1e9, symbol: 'G' },
    { value: 1e12, symbol: 'T' },
    { value: 1e15, symbol: 'P' },
    { value: 1e18, symbol: 'E' },
  ];

  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  const lookupItem = lookup
    .slice()
    .reverse()
    .find((item) => number >= item.value);
  return lookupItem ? (number / lookupItem.value).toFixed(digits).replace(rx, '$1') + lookupItem.symbol : '0';
};

export function interpolate(template: string, params: Record<string, string | null | undefined>): string {
  return Object.entries(params).reduce((result, [key, value]) => {
    return value ? result.replace(`\${${key}}`, value) : result;
  }, template);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Conversion factor for glucose units.
 */
export const MG_DL_PER_MMOL_L = 18.0182; // Use a precise factor

function convertSVGToPreferredUnits(svg: number, preferred_units: GlucoseUnits): number {
  if (preferred_units == 'mg/dl') {
    return svg;
  }
  return svg / MG_DL_PER_MMOL_L;
}
