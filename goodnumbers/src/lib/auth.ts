// file: goodnumbers/src/lib/auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import type { JWT } from "@auth/core/jwt";
import type { Session, DefaultUser, User, Profile } from "@auth/core/types";
import GoogleProvider from "@auth/express/providers/google";

import fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ALLOWLIST_FILE_PATH = path.join(
  __dirname,
  "../../config/allowed_emails.txt"
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
    const data = await fs.readFile(ALLOWLIST_FILE_PATH, "utf8");
    const emails = data
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    cachedAllowedEmails = new Set(emails);
    lastReadTime = now;
    console.log(`[Auth.js] SUCCESS: Loaded ${emails.length} allowed emails.`);
    return cachedAllowedEmails;
  } catch (error) {
    console.error(
      `[Auth.js] CRITICAL ERROR: Could not read allowlist file at ${ALLOWLIST_FILE_PATH}.`,
      error
    );
    cachedAllowedEmails = new Set();
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
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, profile }: { user: User; profile?: Profile }) {
      // SECURITY IMPROVEMENT: Use the user ID from the user object for logging,
      // not the email. The `user` object is guaranteed to be present here after
      // the Prisma adapter has found or created the user.
      const userId = user?.id;
      const userEmail = profile?.email;

      if (!userEmail || !userId) {
        console.log(
          "[Auth.js] DENIED: Sign-in failed, no email or user ID from provider/adapter."
        );
        return false;
      }

      const allowedEmails = await getAllowedEmails();
      const isAllowed = allowedEmails.has(userEmail.toLowerCase());

      if (!isAllowed) {
        // PRIVACY IMPROVEMENT: Log the user ID, not the email, to prevent leaking PII.
        console.log(
          `[Auth.js] DENIED: User with ID ${userId} is NOT in the allowlist.`
        );
        return false;
      }

      // --- NEW LOGIC FOR AGREEMENT GATE (with Security Improvements) ---
      // If the user is on the allowlist, we ensure their agreement flag is set to true.
      // This is idempotent: it works for newly created users and safely re-asserts
      // for existing users on every login.
      try {
        // ROBUSTNESS IMPROVEMENT: Update the user by their primary key (`id`) instead of email.
        // This is more direct and less ambiguous than relying on a non-primary key field.
        await prisma.user.update({
          where: { id: userId },
          data: { agreementsSigned: true },
        });

        // PRIVACY IMPROVEMENT: Log the user ID, not the email.
        console.log(
          `[Auth.js] INFO: Ensured agreementsSigned is true for user ID ${userId}.`
        );
      } catch (error) {
        // SECURITY IMPROVEMENT: Log a controlled error message and avoid logging the raw error object,
        // which could contain sensitive information.
        console.error(
          `[Auth.js] CRITICAL: Failed to update agreementsSigned for user ID ${userId}. Denying login.`,
          { errorMessage: (error as Error).message }
        );
        // SECURITY: If we can't update the database to confirm agreement,
        // we must not allow the user to log in.
        return false;
      }
      // --- END OF NEW LOGIC ---

      console.log(`[Auth.js] ALLOWED: User with ID ${userId} is in the allowlist.`);
      return true; // Allow sign-in
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