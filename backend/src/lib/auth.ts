// Frontend/src/lib/auth.ts
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from '@auth/express/providers/google';
import { prisma } from './prisma.js';
import type { ExpressAuthConfig } from '@auth/express';
import * as fs from 'fs/promises';
import type { User as AuthUser } from '@auth/core/types';
import { GlucoseUnit } from '@goodnumbers/common';

// --- Email Allowlist Logic ---

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
async function isEmailAllowed(user: Partial<AuthUser>): Promise<boolean> {
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
      console.log('[Auth] Refreshed email allowlist from file.');
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

// --- Auth.js v5 Configuration ---

export const authConfig: ExpressAuthConfig = {
  adapter: PrismaAdapter(prisma),
  // CRITICAL SECURITY NOTE:
  // The Prisma adapter automatically enforces the "database" session strategy.
  // This is essential for privacy and security. The session cookie will only contain
  // a session token, and sensitive data (like nightscoutUrl) is only ever
  // looked up on the server, never exposed to the client.
  // DO NOT change this to a "jwt" strategy without a thorough security review.
  session: { strategy: 'database' },

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    async signIn({ user }) {
      return await isEmailAllowed(user);
    },
    // This callback runs on the server and enriches the session object
    // to make user data available to our middleware without extra DB calls.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.agreementsSigned = user.agreementsSigned;
        session.user.preferredUnits = user.preferredUnits;
        // NEW: Add the required fields for the setup/settings page
        session.user.nightscoutUrl = user.nightscoutUrl;
        // SECURE: Read the pre-calculated, non-sensitive hint directly.
        session.user.nightscoutTokenLast3 = user.nightscoutTokenLast3;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(process.env.FRONTEND_URL as string)) {
        return url;
      }
      return process.env.FRONTEND_URL as string;
    },
  },
};

// Extend the Session User type to satisfy TypeScript in our application code.
// This lets us access the custom properties we added in the session callback.
declare module '@auth/express' {
  interface User {
    agreementsSigned?: boolean;
    nightscoutUrl?: string | null;
    nightscoutTokenLast3?: string | null;
    preferredUnits?: GlucoseUnit;
  }
}
