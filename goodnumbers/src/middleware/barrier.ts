// src/middleware/barrier.ts

import type { Request, Response, NextFunction } from 'express';

export const barrierMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log('>>> Barrier middleware reached for path:', req.path);
  // Allow access to the login page, the API endpoint, and the health check
  if (
    req.path === '/barrier-login.html' ||
    req.path.startsWith('/api/barrier-login') ||
    req.path === '/health'
  ) {
    return next();
  }

  if (req.session && req.session.is_authorized) {
    return next();
  }

  // If not authorized, redirect to the login page
  return res.redirect('/barrier-login.html');
};
