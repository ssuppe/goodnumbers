// goodnumbers/src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';

/**
 * A global error handling middleware for Express.
 * This middleware MUST have 4 arguments to be recognized by Express as an error handler.
 *
 * @param err - The error object.
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next function.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // --- FIX: IMPROVED LOGGING FOR SECURITY ---
  // Log a structured error message to prevent accidentally logging PII that might be
  // present in the raw error object.
  console.error('--- Global Error Handler Caught an Error ---');
  console.error(`Error Message: ${err.message}`);

  // In production, we don't want to send sensitive stack traces to the client.
  if (process.env.NODE_ENV === 'production') {
    // In a real production app, you might still log the stack to a secure logging service.
    // console.error(`Stack: ${err.stack}`);
    return res
      .status(500)
      .json({ error: 'An internal server error occurred.' });
  } else {
    // In development, provide more detail.
    console.error(`Stack: ${err.stack}`);
    return res.status(500).json({
      error: 'An internal server error occurred.',
      message: err.message,
      stack: err.stack,
    });
  }
};
