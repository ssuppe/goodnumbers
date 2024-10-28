import Cookies from 'js-cookie';
// import { compress, decompress } from 'compress-json';
import pako from 'pako';

export const setCookieC = (name: string, value: any) => {
    try {
      // Convert value to string if it isn't already
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Compress the string using pako (zlib implementation for browsers)
      const compressed = pako.deflate(stringValue, { to: 'string' });
      
      // Convert to base64 for safe cookie storage
      const base64 = btoa(compressed);
      
      Cookies.set(name, base64, { expires: 30 });
    } catch (e) {
      console.error(`Failed to set cookie ${name}:`, e);
    }
  };

export const getCookieC = <T>(name: string): T | null => {
    try {
      const cookie = Cookies.get(name);
      if (!cookie) return null;
      
      // Convert from base64
      const compressed = atob(cookie);
      
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
      Cookies.remove(name);
      return null;
    }
};