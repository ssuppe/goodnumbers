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
  // Log the full error to the console for debugging purposes.
  // In a real production environment, you would use a dedicated logging service.
  console.error(err);

  // Check the environment. In production, we don't want to send sensitive
  // information like a stack trace to the client.
  if (process.env.NODE_ENV === 'production') {
    // Send a generic, non-revealing error message.
    return res
      .status(500)
      .json({ error: 'An internal server error occurred.' });
  } else {
    // In development, send a more detailed error message including the stack trace.
    return res.status(500).json({
      error: 'An internal server error occurred.',
      message: err.message,
      stack: err.stack,
    });
  }
};
