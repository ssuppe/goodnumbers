import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";

/**
 * This middleware handles UI flow for onboarding.
 * It checks if a user has completed their initial account setup (by checking for nightscoutUrl).
 * If not, it redirects them to the setup page.
 * This should run AFTER the enforceAgreements middleware.
 */
export async function enforceAccountSetup(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  // The check for agreementsSigned is now handled by the 'enforceAgreements' middleware.
  // This middleware's only job is to check for account setup completion.
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { nightscoutUrl: true },
  });

  if (user && !user.nightscoutUrl) {
    return res.redirect("/setup-account");
  }

  next();
}