import pkg from 'express';
const { Request, Response, NextFunction } = pkg;

import { getSession } from '@auth/express';
import { authConfig } from '../lib/auth.ts';
import { prisma } from '../lib/prisma.ts';

// Extend the Request type to include the user property using module augmentation
declare module 'express' {
  export interface Request {
    user?: {
      id: string;
      email: string;
      agreementsSigned: boolean;
      nightscoutUrl?: string | null;
      nightscoutToken?: string | null;
      preferredUnits?: 'MGDL' | 'MMOL' | null;
    };
  }
}

// This middleware protects routes by ensuring the user is authenticated.
// It also populates `req.user` with basic user information.
export async function protect(req: Request, res: Response, next: NextFunction) {
  // For integration tests, we can bypass Auth.js by setting a special header.
  // In a real application, this would be removed or heavily restricted.
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
    const testUserId = req.headers['x-test-user-id'] as string;
    const testUser = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    if (testUser) {
      req.user = {
        id: testUser.id,
        email: testUser.email || '',
        agreementsSigned: testUser.agreementsSigned,
        nightscoutUrl: testUser.nightscoutUrl,
        nightscoutToken: testUser.nightscoutToken,
        preferredUnits: testUser.preferredUnits,
      };
      return next();
    }
  }

  // Get the session from Auth.js
  const session = await getSession(req, authConfig);

  if (session?.user?.email) {
    // Fetch the full user object from Prisma to get application-specific fields
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        agreementsSigned: true,
        nightscoutUrl: true,
        nightscoutToken: true,
        preferredUnits: true,
      },
    });

    if (user) {
      req.user = user; // Attach the user object to the request
      return next();
    }
  }

  // If no valid session or user found, return 401 Unauthorized
  res.status(401).json({ error: 'Unauthorized.' });
}
