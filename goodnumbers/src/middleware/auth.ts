import { getSession } from '@auth/express';
import { authConfig } from '../lib/auth.ts';
import { prisma } from '../lib/prisma.ts';
import type { Request, Response, NextFunction } from 'express';

// Extend the Express Request type to include our custom user object
declare module 'express' {
  interface Request {
    user?: import('@auth/express').User;
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

  // Attach the enriched user object from the session to the request
  req.user = session.user;
  next();
}
