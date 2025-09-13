import { getSession } from '@auth/express';
import { authConfig } from '../lib/auth.ts';
import { prisma } from '../lib/prisma.ts';
import type { Request, Response, NextFunction } from 'express';

// Extend the Express Request type to include our custom user object
declare module 'express' {
  interface Request {
    user?: import('@auth/express').User & {
      agreementsSigned?: boolean;
      nightscoutUrl?: string;
      preferredUnits?: string;
    }; // Extend with relevant fields
  }
}

export async function protect(req: Request, res: Response, next: NextFunction) {
  // Hardened hook for integration tests.
  // This MUST be disabled in production for security reasons.
  if (process.env.NODE_ENV !== 'production' && req.headers['x-test-user-id']) {
    const userId = req.headers['x-test-user-id'] as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      // In tests, we attach the full user object from the DB to simulate
      // the enriched session.
      req.user = user;
      return next();
    }
  }

  const session = await getSession(req, authConfig);
  if (!session?.user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    return res.redirect('/api/auth/signin');
  }

  // Fetch the latest user data from the database
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email || undefined }, // Use email for lookup, assuming it's unique and always present in session.user
  });

  if (!dbUser) {
    // This should ideally not happen if session.user exists, but handle defensively
    console.error(
      `[Auth] User from session (${session.user.email}) not found in DB.`,
    );
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'User data not found' });
    }
    return res.redirect('/api/auth/signin');
  }

  // Attach the fresh user object from the database to the request
  req.user = { ...session.user, ...dbUser }; // Merge session user with DB user to ensure all fields are present
  next();
}
