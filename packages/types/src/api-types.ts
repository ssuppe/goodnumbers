export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface JournalStatus {
  status: string;
  progress: number;
  statusMessage: string | null;
}

export interface GlucoseEntry {
  sgv: number;
  date: number; // Timestamp
  dateString?: string; // Optional ISO string if available
}
