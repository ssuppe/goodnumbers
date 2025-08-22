import { PrismaAdapter } from '@auth/prisma-adapter';
import type { JWT } from 'next-auth/jwt';
import type { Session, DefaultUser, User, Profile } from 'next-auth';
import type { AuthOptions } from 'next-auth';

interface GoogleProfile extends Profile {
  picture?: string;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import GoogleProvider from '@auth/express/providers/google';

import { readFile } from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js'; // Import the shared Prisma client

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ALLOWLIST_FILE_PATH = path.join(
  __dirname,
  '../../config/allowed_emails.txt',
);
let cachedAllowedEmails: Set<string> | null = null;
let lastReadTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000;

export async function getAllowedEmails(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedAllowedEmails && now - lastReadTime < CACHE_DURATION_MS) {
    return cachedAllowedEmails;
  }
  try {
    const data = await readFile(ALLOWLIST_FILE_PATH, 'utf8');
    const emails = data
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    cachedAllowedEmails = new Set(emails);
    lastReadTime = now;
    console.log(`[Auth.js] SUCCESS: Loaded ${emails.length} allowed emails.`);
    return cachedAllowedEmails;
  } catch (error) {
    console.error(
      `[Auth.js] CRITICAL ERROR: Could not read allowlist file at ${ALLOWLIST_FILE_PATH}.`,
      error,
    );
    cachedAllowedEmails = new Set();
    lastReadTime = now;
    return cachedAllowedEmails;
  }
}

export const authConfig: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    {
      id: 'google',
      name: 'Google',
      type: 'oauth',
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: { params: { prompt: 'select_account' } },
      profile(profile: GoogleProfile) {
        // Ensure id is always a string. Google's 'sub' should always be present.
        if (!profile.sub) {
          throw new Error("Google profile 'sub' (ID) is missing.");
        }
        return {
          id: profile.sub as string,
          name: profile.name,
          email: profile.email,
          // Google's profile includes a 'picture' property for the user's avatar.
          image: profile.picture ?? '',
        };
      },
    },
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, profile }: { user: User; profile?: Profile }) {
      const userId = user?.id;
      const userEmail = profile?.email;

      if (!userEmail || !userId) {
        console.log(
          '[Auth.js] DENIED: Sign-in failed, no email or user ID from provider/adapter.',
        );
        return false;
      }

      const allowedEmails = await getAllowedEmails();
      const isAllowed = allowedEmails.has(userEmail.toLowerCase());

      if (!isAllowed) {
        console.log(
          `[Auth.js] DENIED: User with ID ${userId} is NOT in the allowlist.`,
        );
        return false;
      }

      // If the user is on the allowlist, ensure their agreement flag is set to true.
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { agreementsSigned: true },
        });

        console.log(
          `[Auth.js] INFO: Ensured agreementsSigned is true for user ID ${userId}.`,
        );
      } catch (error) {
        console.error(
          `[Auth.js] CRITICAL: Failed to update agreementsSigned for user ID ${userId}. Denying login.`,
          { errorMessage: (error as Error).message },
        );
        // If we can't update the database, we must not allow the user to log in.
        return false;
      }

      console.log(
        `[Auth.js] ALLOWED: User with ID ${userId} is in the allowlist.`,
      );
      // Allow sign-in
      return true;
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
