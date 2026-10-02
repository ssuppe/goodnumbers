export function formatGlucose(
  valInMgdl: number,
  units: 'mmol/L' | 'mg/dL',
): number {
  if (units === 'mmol/L') {
    return Math.round((valInMgdl / 18.0182) * 10) / 10;
  }
  return Math.round(valInMgdl);
}

export function calculateTir(sgvArray: number[]): number {
  if (sgvArray.length === 0) return 0;
  const inRange = sgvArray.filter((v) => v >= 70 && v <= 180).length;
  return Math.round((inRange / sgvArray.length) * 100);
}
