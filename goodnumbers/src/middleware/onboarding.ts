// Frontend/src/middleware/onboarding.ts
import { Request, Response, NextFunction } from 'express';

import { prisma } from '../lib/prisma.js';

// This middleware enforces the user onboarding flow.
// Users must sign agreements and set up their Nightscout account
// before accessing the main application.
export async function enforceOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // If the user is not authenticated, the `protect` middleware should have
  // already handled it. This middleware assumes an authenticated user.
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agreementsSigned: true, nightscoutUrl: true },
    });

    if (!user) {
      // This should ideally not happen if `protect` middleware works correctly
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if agreements are signed
    if (!user.agreementsSigned) {
      // Redirect to agreements page if not signed
      return res.redirect('/agreements');
    }

    // Check if Nightscout URL is set (basic account setup)
    if (!user.nightscoutUrl) {
      // Redirect to setup account page if not set
      return res.redirect('/setup-account');
    }

    // If all checks pass, proceed to the next middleware/route handler
    next();
  } catch (error) {
    console.error('[Onboarding Middleware] Error enforcing onboarding:', error);
    res
      .status(500)
      .json({ error: 'Internal server error during onboarding check.' });
  }
}
