import { Request, Response, NextFunction } from 'express';

/**
 * This middleware is for UI routes. If the user has not signed agreements,
 * it redirects them to the /agreements page. Otherwise, it calls next().
 */
export function redirectIfNotAgreed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.user && !req.user.agreementsSigned) {
    return res.redirect('/agreements');
  }
  next();
}
