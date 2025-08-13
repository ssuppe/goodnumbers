'use client';

import { compress, decompress } from 'compress-json';

/**
 * Save data to localStorage with optional compression for objects
 * @param key The localStorage key
 * @param value The value to store
 * @param shouldCompress Whether to compress the data (for objects)
 * @returns true if operation succeeded, false otherwise
 */
export function saveToLocalStorage<T>(key: string, value: T, shouldCompress = true): boolean {
  try {
    // Handle null or undefined
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
      return true;
    }

    let serializedValue: string;
    if (typeof value === 'string') {
      serializedValue = value;
    } else {
      // For objects, compress them if requested
      const dataToSave = shouldCompress ? compress(value) : value;
      serializedValue = JSON.stringify(dataToSave);
    }

    // Synchronously save to localStorage
    localStorage.setItem(key, serializedValue);
    return true;
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
    return false;
  }
}

/**
 * Load data from localStorage with optional decompression for objects
 * @param key The localStorage key
 * @param isCompressed Whether the stored data is compressed
 * @returns The retrieved data, or null if not found or error occurred
 */
export function loadFromLocalStorage<T>(key: string, isCompressed = true): T | null {
  try {
    const value = localStorage.getItem(key);
    if (!value) return null;

    // For string values, try to parse as JSON first
    if (!isCompressed) {
      try {
        return JSON.parse(value) as T;
      } catch {
        // If it's not valid JSON, return as string
        return value as unknown as T;
      }
    }

    // For compressed data
    const parsed = JSON.parse(value);
    return decompress(parsed) as T;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return null;
  }
}

/**
 * Check if running in a browser environment with localStorage available
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}
