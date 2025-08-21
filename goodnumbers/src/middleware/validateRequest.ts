// goodnumbers/src/middleware/validateRequest.ts

import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';

/**
 * This is a higher-order function that takes a Zod schema and returns an Express middleware.
 * The returned middleware will validate the request body, query, and params against the provided schema.
 *
 * @param schema - The Zod schema to validate the request against.
 * @returns An Express middleware function.
 */
export const validateRequest = (schema: ZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // The .parse() method will throw a ZodError if validation fails.
      // This now correctly parses the entire request context as specified.
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // If validation is successful, call the next middleware in the stack.
      next();
    } catch (error) {
      // We check if the error is an instance of ZodError.
      if (error instanceof ZodError) {
        // If it is, we send a 400 Bad Request response with the structured error details.
        // This provides clear feedback to the client about what was wrong with the request.
        return res.status(400).json({
          error: 'Validation failed',
          details: error.format(),
        });
      }
      // If the error is not a ZodError, it's an unexpected server error.
      // We pass it to the next middleware, which will be our global error handler.
      next(error);
    }
  };
};
