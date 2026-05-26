import * as fs from 'fs/promises';
import type { User as AuthUser } from '@auth/core/types';

// In-memory cache to avoid reading the file on every single login attempt.
let allowedEmails: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Checks if a given user's email is in the allowlist.
 * It uses a simple in-memory, time-based cache to reduce file I/O.
 * @param user The user object from the Auth.js callback.
 * @returns {Promise<boolean>} True if the email is allowed, false otherwise.
 */
export async function isEmailAllowed(
  user: Partial<AuthUser>,
): Promise<boolean> {
  const { email, id } = user;
  if (!email) {
    return false; // Cannot allow a user without an email.
  }

  const now = Date.now();
  // Refresh cache if it's empty or expired
  if (!allowedEmails || now - cacheTimestamp > CACHE_TTL) {
    try {
      const fileContent = await fs.readFile(
        'config/allowed_emails.txt',
        'utf-8',
      );
      allowedEmails = new Set(
        fileContent
          .split('\n')
          .map((line) => line.trim().toLowerCase())
          .filter((line) => line && !line.startsWith('#')),
      );
      cacheTimestamp = now;
    } catch (error) {
      console.error(
        '[CRITICAL AUTH ERROR] Could not read allowed_emails.txt. Defaulting to denying all new sign-ins.',
        error,
      );
      allowedEmails = new Set();
    }
  }

  const isAllowed = allowedEmails.has(email.toLowerCase());

  // SECURE LOGGING: Log the user's ID if available, otherwise log a generic message.
  // NEVER log the email address.
  const identifier = id ? `user with ID ${id}` : 'a new user';
  console.log(
    `[Auth] Login attempt for ${identifier}. Allowed: ${isAllowed ? 'YES' : 'NO'}.`,
  );
  return isAllowed;
}

// We also export as a default object to make spying easier in ESM if needed,
// but the named export is preferred for the application code.
export const authUtils = {
  isEmailAllowed,
};

/**
 * ONLY FOR TESTING: Clears the in-memory allowlist cache.
 */
export function clearAllowedEmailsCache() {
  allowedEmails = null;
  cacheTimestamp = 0;
}
