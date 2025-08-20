import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to protect routes that require authentication.
 * It checks for the presence of `req.auth.user.id`, which is populated
 * by the Auth.js session handler.
 */
export const protect = (req: Request, res: Response, next: NextFunction) => {
  // The Auth.js library should populate `req.auth` after a successful login.
  // We check for the user's session and ID here.
  if (!req.auth?.user?.id) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  // If the user is authenticated, proceed to the next middleware or route handler.
  next();
};
