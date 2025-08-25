import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

/**
 * Middleware to enforce that a user has signed the agreements.
 * This middleware MUST run AFTER the authentication middleware (`protect`).
 * It checks the `agreementsSigned` flag in the database for the authenticated user.
 *
 * @param req - The Express request object, expecting `req.auth.user.id` to be populated.
 * @param res - The Express response object.
 * @param next - The Express next function.
 */
export const enforceAgreements = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.auth?.user?.id;

    // This state should be impossible if `protect` runs first.
    // It indicates a server logic error, not a client authentication error.
    if (!userId) {
      console.error(
        "[FATAL] userId not found in request after 'protect' middleware. This indicates a critical server misconfiguration.",
      );
      return res.status(500).json({ message: 'Internal server error' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agreementsSigned: true },
    });

    // If user not found in DB or agreements are not signed, deny access.
    if (!user || !user.agreementsSigned) {
      return res.status(403).json({
        message: 'User agreements must be signed to access this resource.',
        code: 'AGREEMENTS_NOT_SIGNED',
      });
    }

    // If agreements are signed, proceed to the next handler.
    next();
  } catch (error) {
    // Pass database or other unexpected errors to the global error handler.
    // This defaults to a secure "deny" state.
    next(error);
  }
};
