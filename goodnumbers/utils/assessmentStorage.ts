'use client';

import { AssessmentData, GlucoseUnits } from '@/types/nightscout';
import { saveToLocalStorage, loadFromLocalStorage, isLocalStorageAvailable } from './localStorage';

// Storage keys
export const STORAGE_KEYS = {
  ASSESSMENT_DATA: 'assessment_data',
  NIGHTSCOUT_URL: 'nightscout_url',
  NIGHTSCOUT_TOKEN: 'nightscout_token',
  PREFERRED_UNITS: 'preferred_units'
};

// Version of the storage format for future-proofing
export const STORAGE_VERSION = 1;

// Interface for versioned storage object
interface VersionedStorageData {
  version: number;
  data: AssessmentData;
  timestamp: string;
}

/**
 * Save assessment data to localStorage with versioning
 * @param data Assessment data to save
 * @returns true if successful, false otherwise
 */
export function saveAssessmentData(data: AssessmentData): boolean {
  if (!isLocalStorageAvailable()) return false;
  
  const versionedData: VersionedStorageData = {
    version: STORAGE_VERSION,
    data,
    timestamp: new Date().toISOString()
  };
  
  return saveToLocalStorage(STORAGE_KEYS.ASSESSMENT_DATA, versionedData);
}

/**
 * Load assessment data from localStorage with version handling
 * @returns Assessment data if successful, null otherwise
 */
export function loadAssessmentData(): AssessmentData | null {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const versionedData = loadFromLocalStorage<VersionedStorageData>(STORAGE_KEYS.ASSESSMENT_DATA);
    
    if (!versionedData) return null;
    
    // Version migration handling (for future updates)
    switch (versionedData.version) {
      case 1:
        return versionedData.data;
      default:
        console.error(`Unknown storage version: ${versionedData.version}`);
        return null;
    }
  } catch (error) {
    console.error('Error loading assessment data:', error);
    return null;
  }
}

/**
 * Save Nightscout URL to localStorage
 * @param url Nightscout URL
 */
export function saveNightscoutUrl(url: string): boolean {
  if (!isLocalStorageAvailable()) return false;
  return saveToLocalStorage(STORAGE_KEYS.NIGHTSCOUT_URL, url, false);
}

/**
 * Save Nightscout token to localStorage
 * @param token Nightscout token
 */
export function saveNightscoutToken(token: string): boolean {
  if (!isLocalStorageAvailable()) return false;
  return saveToLocalStorage(STORAGE_KEYS.NIGHTSCOUT_TOKEN, token, false);
}

/**
 * Save preferred glucose units to localStorage
 * @param units Preferred glucose units
 */
export function savePreferredUnits(units: GlucoseUnits): boolean {
  if (!isLocalStorageAvailable()) return false;
  return saveToLocalStorage(STORAGE_KEYS.PREFERRED_UNITS, units, false);
}

/**
 * Load Nightscout URL from localStorage
 */
export function loadNightscoutUrl(): string | null {
  if (!isLocalStorageAvailable()) return null;
  return loadFromLocalStorage<string>(STORAGE_KEYS.NIGHTSCOUT_URL, false);
}

/**
 * Load Nightscout token from localStorage
 */
export function loadNightscoutToken(): string | null {
  if (!isLocalStorageAvailable()) return null;
  return loadFromLocalStorage<string>(STORAGE_KEYS.NIGHTSCOUT_TOKEN, false);
}

/**
 * Load preferred glucose units from localStorage
 */
export function loadPreferredUnits(): GlucoseUnits | null {
  if (!isLocalStorageAvailable()) return null;
  return loadFromLocalStorage<GlucoseUnits>(STORAGE_KEYS.PREFERRED_UNITS, false);
}
