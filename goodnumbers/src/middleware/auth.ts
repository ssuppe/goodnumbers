import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to protect routes that require authentication.
 * It checks for the presence of `req.auth.user.id`, which is populated
 * by the Auth.js session handler.
 */
export const protect = (req: Request, res: Response, next: NextFunction) => {
  // For testing purposes, allow authentication via x-test-user-id header
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
    req.auth = { user: { id: req.headers['x-test-user-id'] as string } };
  }

  if (!req.auth?.user?.id) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  // If the user is authenticated, proceed to the next middleware or route handler.
  next();
};
