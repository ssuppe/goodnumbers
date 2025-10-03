import { Request, Response, NextFunction } from "express";

/**
 * This middleware acts as a strict API authorization gate.
 * It checks if the authenticated user has the 'agreementsSigned' flag set to true.
 * If not, it terminates the request with a 403 Forbidden error.
 */
export function enforceAgreements(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Allow PUT /api/user/settings to proceed if it's an attempt to sign agreements
  if (
    req.method === 'PUT' &&
    req.path === '/settings' && // Note: req.path is relative to the middleware mount point
    req.user &&
    !req.user.agreementsSigned &&
    req.body &&
    req.body.agreementsSigned === true
  ) {
    return next();
  }

  if (req.user && req.user.agreementsSigned) {
    return next();
  }
  return res.status(403).json({
    error: "User has not signed the required agreements.",
    code: "AGREEMENTS_NOT_SIGNED",
  });
}
