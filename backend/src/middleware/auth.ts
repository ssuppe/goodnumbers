// Frontend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

import { getSession } from '@auth/express';
import { authConfig } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { GlucoseUnit } from '@goodnumbers/common';

// Extend the Request type to include the user property using module augmentation
declare module 'express-serve-static-core' {
  export interface Request {
    user?: {
      id: string;
      email: string | null; // <-- FIX: Changed from string to string | null
      agreementsSigned: boolean;
      nightscoutUrl?: string | null;
      nightscoutToken?: string | null;
      preferredUnits?: GlucoseUnit | null;
    };
  }
}

// This middleware protects routes by ensuring the user is authenticated.
// It also populates `req.user` with basic user information.
export async function protect(req: Request, res: Response, next: NextFunction) {
  const testUserId = req.headers['x-test-user-id'] as string;

  // For integration tests, we can bypass Auth.js by setting a special header.
  if (process.env.NODE_ENV === 'test' && testUserId) {
    const testUser = await prisma.user.findUnique({
      where: { id: testUserId },
    });

    if (testUser) {
      req.user = {
        id: testUser.id,
        email: testUser.email || null, // Ensure consistency
        agreementsSigned: testUser.agreementsSigned,
        nightscoutUrl: testUser.nightscoutUrl,
        nightscoutToken: testUser.nightscoutToken,
        preferredUnits: testUser.preferredUnits as GlucoseUnit,
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
      req.user = user as typeof req.user; // Attach the user object to the request
      return next();
    }
  }

  // If no valid session or user found, return 401 Unauthorized
  res.status(401).json({ error: 'Unauthorized.' });
}
