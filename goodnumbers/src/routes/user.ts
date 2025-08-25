// goodnumbers/src/routes/user.ts
import express from 'express';
import { userSettingsSchema } from '../lib/schemas.js';
import { encrypt } from '../lib/encryption.js';
import { protect } from '../middleware/auth.js';
import { prisma } from '../db.js';
import rateLimit from 'express-rate-limit';
import { validateRequest } from '../middleware/validateRequest.js';
import { createId } from '@paralleldrive/cuid2';
import { enforceAgreements } from '../middleware/enforceAgreements.js'; // <-- IMPORT
import { doubleCsrfProtection } from '../middleware/csrf.js'; // <-- IMPORT CSRF

const router = express.Router();

// A stricter rate limiter for sensitive operations
const sensitiveOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * PUT /api/user/settings
 * Description: Updates the settings for the authenticated user.
 * Access: Private (requires authentication, signed agreements, and CSRF token)
 */
router.put(
  '/settings',
  protect,
  enforceAgreements,
  doubleCsrfProtection, // <-- APPLY CSRF MIDDLEWARE HERE
  validateRequest(userSettingsSchema),
  async (req, res, next) => {
    try {
      const userId = req.auth?.user?.id;
      if (!userId) {
        console.error(
          '[FATAL] userId not found in request after protect middleware.',
        );
        return res.status(500).json({ message: 'Internal server error.' });
      }

      const { nightscoutUrl, nightscoutToken, preferredUnits } = req.body;

      const encryptedUrl = encrypt(nightscoutUrl);
      const encryptedToken = encrypt(nightscoutToken);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          nightscoutUrl: encryptedUrl,
          nightscoutToken: encryptedToken,
          preferredUnits: preferredUnits,
        },
        select: {
          id: true,
          email: true,
          preferredUnits: true,
        },
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/user/regenerate-rss-token
 * Description: Regenerates the RSS token for the authenticated user.
 * Access: Private (requires authentication, signed agreements, and CSRF token)
 */
router.post(
  '/regenerate-rss-token',
  protect,
  enforceAgreements,
  doubleCsrfProtection, // <-- APPLY CSRF MIDDLEWARE HERE
  sensitiveOperationLimiter,
  async (req, res, next) => {
    try {
      const userId = req.auth?.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
      }

      const newToken = createId();

      await prisma.user.update({
        where: { id: userId },
        data: {
          rssToken: newToken,
        },
      });

      res.status(200).json({ rssToken: newToken });
    } catch (error) {
      next(error);
    }
  },
);

// NOTE: We are intentionally NOT applying `enforceAgreements` to any other user routes
// that might be added, such as GET /api/user/session-status or POST /api/user/sign-agreements,
// as the user must be able to access those before signing.

export default router;
