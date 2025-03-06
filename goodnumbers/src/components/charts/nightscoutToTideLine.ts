'use client';

import { v4 as uuidv4 } from 'uuid';
import { GlucoseUnits } from '~/types/nightscout';
import { u } from '~/utils/text'; // Assuming 'u' function is in '~/utils/text'

export interface TidelineDatum {
  id: string;
  type: string;
  time: string;
  deviceTime: string;
  normalTime: string;
  value: number;
  units: GlucoseUnits; // Use GlucoseUnits enum here for type safety
}

export type TidelineData = TidelineDatum[]; // TidelineData is now correctly defined as an array

export const nsEntriesToTideline = (entries: any[], preferred_units: GlucoseUnits): TidelineData => {
  // Function now returns TidelineData (which is TidelineDatum[])
  return entries
    .map((entry) => {
      let tidelineDatum: TidelineDatum | null = null;
      const tidelineUnits: GlucoseUnits = preferred_units || 'mg/dl'; // Use GlucoseUnits and default to MGDL_UNITS

      const adjustedTime = new Date(entry.date + entry.utcOffset * 60000);

      if (entry.sgv != null && entry.mbg == null) {
        tidelineDatum = {
          id: uuidv4(),
          type: 'cbg',
          time: adjustedTime.toISOString(),
          deviceTime: new Date(entry.date).toISOString(),
          normalTime: adjustedTime.toISOString(),
          value: entry.sgv,
          units: tidelineUnits, // Use the GlucoseUnits enum
        };
      } else if (entry.mbg != null && entry.sgv == null) {
        tidelineDatum = {
          id: uuidv4(),
          type: 'smbg',
          time: adjustedTime.toISOString(),
          deviceTime: new Date(entry.date).toISOString(),
          normalTime: adjustedTime.toISOString(),
          value: entry.mbg,
          units: tidelineUnits, // Use the GlucoseUnits enum
        };
        if (tidelineUnits === 'mmol/l') {
          tidelineDatum.value = entry.mbg / 18;
        }
      }
      return tidelineDatum;
    })
    .filter((datum) => datum !== null) as TidelineData; // Explicit type assertion for clarity
};
