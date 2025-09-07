import type { Request, Response, NextFunction } from 'express';

export function enforceOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = req.user;
  const isApiRequest = req.path.startsWith('/api/');

  if (!user) {
    console.error(
      '[CRITICAL] enforceOnboarding middleware ran without a user on the request. This should not happen.',
    );
    return res.status(500).json({ error: 'User not found on request object.' });
  }

  const userId = user.id; // For PII-safe logging

  // Check 1: Have agreements been signed?
  if (!user.agreementsSigned) {
    if (req.path === '/agreements') return next(); // Prevent redirect loop

    console.log(`[Auth] User ${userId} requires agreements. Path: ${req.path}`);
    if (isApiRequest) {
      return res.status(403).json({
        error: 'User has not signed the agreements.',
        code: 'AGREEMENTS_NOT_SIGNED',
      });
    }
    return res.redirect('/agreements');
  }

  // Check 2: Has the account been set up?
  if (!user.nightscoutUrl || !user.preferredUnits) {
    if (req.path === '/setup-account') return next(); // Prevent redirect loop

    console.log(
      `[Auth] User ${userId} requires account setup. Path: ${req.path}`,
    );
    if (isApiRequest) {
      return res.status(403).json({
        error: 'User has not completed account setup.',
        code: 'ACCOUNT_NOT_SETUP',
      });
    }
    return res.redirect('/setup-account');
  }

  // If all checks pass, proceed.
  next();
}
