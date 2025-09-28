// Frontend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

// Express identifies this as an error handler because it has 4 arguments.
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) {
  // Specifically handle CSRF errors to return a 403 status.
  if (err.message?.startsWith('Did not get a valid CSRF token')) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
  }

  // Log the full error to the console for debugging all other errors.
  console.error('--- UNHANDLED ERROR ---');
  console.error(err.stack);
  console.error('--- END UNHANDLED ERROR ---');

  // Send a generic, safe 500 response for all other unhandled errors.
  res.status(500).json({
    error: 'An internal server error occurred.',
  });
}
