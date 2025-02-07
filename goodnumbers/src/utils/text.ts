import { GlucoseUnits } from '~/types/nightscout';

export function u(sgv: number, preferred_units: GlucoseUnits = 'mg/dl'): string {
  // Handle invalid SGV
  if (typeof sgv !== 'number' || isNaN(sgv)) {
    throw new Error('Invalid blood glucose value');
  }

  switch (preferred_units) {
    case 'mg/dl':
      return `${Math.round(sgv)}`;
    case 'mmol/l':
      return `${(Math.round((sgv / 18) * 10) / 10).toFixed(1)}`;
    default:
      // This should never happen due to TypeScript, but best to be safe
      throw new Error(`Invalid units: ${preferred_units}`);
  }
}
