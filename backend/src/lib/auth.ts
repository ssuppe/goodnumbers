// Frontend/src/lib/auth.ts
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from '@auth/express/providers/credentials';
import { prisma } from '@src/lib/prisma.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { authUtils } from '@src/lib/auth-utils.js';
import type { ExpressAuthConfig } from '@auth/express';
import type { User as AuthUser } from '@auth/core/types';
import { GlucoseUnit } from '@goodnumbers/types';

/**
 * Core authentication logic for the Credentials provider.
 * Separated for direct testing and cleaner configuration.
 */
export async function authorize(
  credentials: Record<string, unknown> | undefined,
): Promise<AuthUser | null> {
  if (!credentials?.email || !credentials?.password) return null;

  const email = credentials.email as string;
  const password = credentials.password as string;
  const action = credentials.action as string | undefined;

  // 1. Password Strength Check
  if (password.length < 8) {
    console.warn(
      `[Auth] Rejected weak password attempt for ${email.substring(0, 3)}...`,
    );
    return null;
  }

  // 2. Check Allowlist FIRST
  const isAllowed = await authUtils.isEmailAllowed({ email });
  if (!isAllowed) {
    console.warn(
      `[Auth] Blocked login/register attempt for non-allowed email: ${email.substring(0, 3)}...`,
    );
    return null;
  }

  // 3. Check Database
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (action === 'register') {
    if (user) {
      console.warn(
        `[Auth] Attempted to register existing user: ${email.substring(0, 3)}...`,
      );
      return null; // Or throw an error for a better UI message
    }
    console.log(`[Auth] Registering allowed user: ${email.substring(0, 3)}...`);
    const hashedPassword = hashPassword(password);
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });
  } else {
    // Login
    if (!user) {
      console.warn(
        `[Auth] Login attempt for non-existent user: ${email.substring(0, 3)}...`,
      );
      return null;
    }

    if (!user.password) {
      // This case might happen if we had legacy OAuth users without passwords
      console.log(`[Auth] Setting password for existing user: ${user.id}`);
      const hashedPassword = hashPassword(password);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });
    } else {
      const isValid = verifyPassword(password, user.password);
      if (!isValid) {
        console.warn(`[Auth] Invalid password for user: ${user.id}`);
        return null;
      }
    }
  }

  return user as AuthUser;
}

// --- Auth.js v5 Configuration ---

export const authConfig: ExpressAuthConfig = {
  adapter: PrismaAdapter(prisma),
  // REQUIRED for Credentials provider:
  // When using the Credentials provider, Auth.js MUST use the "jwt" session strategy.
  // The Prisma adapter will still be used to create/update users, but the session
  // itself will be stored in a signed JWT cookie.
  session: { strategy: 'jwt' },

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        action: { label: 'Action', type: 'text' },
      },
      authorize,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    // With JWT strategy, we must encode custom properties into the token first
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.agreementsSigned = user.agreementsSigned;
        token.preferredUnits = user.preferredUnits;
        token.nightscoutUrl = user.nightscoutUrl;
        token.nightscoutTokenLast3 = user.nightscoutTokenLast3;
      }
      return token;
    },
    // This callback runs on the server and enriches the session object
    // to make user data available to our middleware and frontend.
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.agreementsSigned = token.agreementsSigned as boolean;
        session.user.preferredUnits = token.preferredUnits as GlucoseUnit;
        session.user.nightscoutUrl = token.nightscoutUrl as string | null;
        session.user.nightscoutTokenLast3 = token.nightscoutTokenLast3 as
          | string
          | null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      // Fallback to the base URL
      return baseUrl;
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
