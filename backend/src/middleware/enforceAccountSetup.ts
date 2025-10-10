import { prisma } from '../lib/prisma.js';
import { Request, Response, NextFunction } from 'express';

/**
 * This middleware ensures that a user has completed the initial account setup.
 * It checks if a user has completed their initial account setup (by checking for nightscoutUrl).
 * If not, it redirects them to the setup page.
 * This should run AFTER the enforceAgreements middleware.
 * UPDATED: This function is now synchronous and relies on the upstream 'protect' middleware
 * to populate `req.user`.
 */
export function enforceAccountSetup(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    // This should not happen if 'protect' middleware is used before this,
    // but it's a safe guard.
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (!req.user.nightscoutUrl) {
    return res.redirect('/setup-account');
  }

  next();
}
