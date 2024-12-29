'use client';

import Cookies from 'js-cookie';
import pako from 'pako';

/**
 * Converts a base64 string to Uint8Array using native APIs
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  // This creates a binary string from base64
  const binaryString = atob(base64);
  // Create a view into the buffer
  return Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
};

/**
 * Converts Uint8Array to base64 string using native APIs
 */
const uint8ArrayToBase64 = (array: Uint8Array): Promise<string> => {
  // Create a blob from the array
  const blob = new Blob([array]);
  // Create a URL for the blob
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove the Data URL prefix (data:application/octet-stream;base64,)
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('Failed to convert to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Gets and decompresses a cookie value
 * @param name The name of the cookie
 * @returns The decompressed value typed as T, or null if not found/invalid
 */
export const getCookieC = <T>(name: string): T | null => {
  try {
    const cookie = Cookies.get(name);
    if (!cookie) return null;

    // Convert from base64 to Uint8Array
    const compressed = base64ToUint8Array(cookie);

    // Decompress
    const decompressed = pako.inflate(compressed, { to: 'string' });

    // Parse if it was originally an object
    try {
      return JSON.parse(decompressed) as T;
    } catch {
      // If it wasn't JSON, return as is
      return decompressed as unknown as T;
    }
  } catch (e) {
    console.error(`Failed to get cookie ${name}:`, e);
    // Optionally remove corrupted cookie
    // Cookies.remove(name);
    return null;
  }
};

/**
 * Sets and compresses a cookie value
 * @param name The name of the cookie
 * @param value The value to compress and store
 * @param options Cookie options to pass to js-cookie
 */
export const setCookieC = <T>(name: string, value: T, options?: Cookies.CookieAttributes): Promise<void> => {
  // Convert to string if object
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

  // Compress
  const compressed = pako.deflate(stringValue);

  // Convert to base64 and set cookie
  return uint8ArrayToBase64(compressed)
    .then((base64) => {
      Cookies.set(name, base64, options);
    })
    .catch((e) => {
      console.error(`Failed to set cookie ${name}:`, e);
      throw e;
    });
};

/**
 * Sets and compresses a cookie value synchronously
 * Uses a slightly less efficient but synchronous base64 conversion
 */
export const setCookieCSync = <T>(name: string, value: T, options?: Cookies.CookieAttributes): void => {
  try {
    // Convert to string if object
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    // Compress
    const compressed = pako.deflate(stringValue);

    // Convert to base64 using btoa
    const binaryString = Array.from(compressed)
      .map((byte) => String.fromCharCode(byte))
      .join('');
    const base64 = btoa(binaryString);

    // Set cookie
    Cookies.set(name, base64, options);
  } catch (e) {
    console.error(`Failed to set cookie ${name}:`, e);
    throw e;
  }
};
