// goodnumbers/src/lib/auth.ts
import { PrismaAdapter } from '@auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import type { JWT } from '@auth/core/jwt';
import type { Session, DefaultUser } from '@auth/core/types';
import GoogleProvider from '@auth/express/providers/google';

import fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// --- File path and cache configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWLIST_FILE_PATH = path.join(
  __dirname,
  '../../config/allowed_emails.txt',
);

// Cache variables to store the allowlist in memory.
let cachedAllowedEmails: Set<string> | null = null;
let lastReadTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * --- NEW: Utility function to read and cache the email allowlist ---
 * This function reads the allowed emails from the configuration file.
 * It uses a simple in-memory cache to avoid excessive file I/O.
 * @returns A Promise that resolves to a Set of allowed email strings, normalized to lowercase.
 */
async function getAllowedEmails(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedAllowedEmails && now - lastReadTime < CACHE_DURATION_MS) {
    console.log('[Auth.js] Using cached email allowlist.');
    return cachedAllowedEmails;
  }

  try {
    console.log(`[Auth.js] Reading allowlist from: ${ALLOWLIST_FILE_PATH}`);
    const data = await fs.readFile(ALLOWLIST_FILE_PATH, 'utf8');
    const emails = data
      .split('\n')
      .map((line) => line.trim().toLowerCase()) // SECURITY: Normalize to lowercase for case-insensitive matching.
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    // Using a Set provides a minor performance boost for the `.has()` check.
    cachedAllowedEmails = new Set(emails);
    lastReadTime = now;
    console.log(`[Auth.js] SUCCESS: Loaded ${emails.length} allowed emails.`);
    return cachedAllowedEmails;
  } catch (error) {
    console.error(
      `[Auth.js] CRITICAL ERROR: Could not read allowlist file at ${ALLOWLIST_FILE_PATH}. Defaulting to deny all access.`,
      error,
    );
    // SECURITY: If the file cannot be read, we must default to a secure state: deny all access.
    cachedAllowedEmails = new Set(); // Cache an empty set to prevent further read attempts
    lastReadTime = now;
    return cachedAllowedEmails;
  }
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: { params: { prompt: 'select_account' } },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    /**
     * --- signIn callback for email allowlist validation ---
     * This callback is executed every time a user attempts to sign in via any provider.
     */
    async signIn({ _user, _account, profile }) {
      const userEmail = profile?.email;

      if (!userEmail) {
        console.log(
          '[Auth.js] DENIED: Sign-in attempt failed because no email was returned from provider.',
        );
        return false;
      }

      // TODO: Before production, remove the logging of PII (userEmail) to protect user privacy.
      // Replace with anonymous logging, e.g., "Sign-in attempt for an allowlisted user succeeded."
      console.log(`[Auth.js] INFO: Attempting sign-in for user: ${userEmail}`);
      const allowedEmails = await getAllowedEmails();

      // SECURITY: Normalize the user's email to lowercase for a case-insensitive check.
      const isAllowed = allowedEmails.has(userEmail.toLowerCase());

      if (isAllowed) {
        console.log(`[Auth.js] ALLOWED: User is in the allowlist.`);
        return true;
      } else {
        console.log(`[Auth.js] DENIED: User is NOT in the allowlist.`);
        return false;
      }
    },
    async jwt({ token, user }: { token: JWT; user?: DefaultUser }) {
      if (user && user.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
