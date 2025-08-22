// goodnumbers/src/routes/user.ts
import express from 'express';
import { userSettingsSchema } from '../lib/schemas.js';
import { encrypt } from '../lib/encryption.js';
import { protect } from '../middleware/auth.js';
import { prisma } from '../db.js';
import rateLimit from 'express-rate-limit';
import { validateRequest } from '../middleware/validateRequest.js';
import { createId } from '@paralleldrive/cuid2';

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
 * Access: Private (requires authentication)
 */
router.put(
  '/settings',
  protect,
  validateRequest(userSettingsSchema), // <-- CORRECT MIDDLEWARE USAGE
  async (req, res, next) => {
    try {
      // --- FIX: ADDED DEFENSIVE RUNTIME CHECK ---
      const userId = req.auth?.user?.id;
      if (!userId) {
        // This should theoretically not be reachable if `protect` middleware is used.
        // This is a defensive safeguard against accidental misconfiguration.
        console.error(
          '[FATAL] userId not found in request after protect middleware.',
        );
        return res.status(500).json({ message: 'Internal server error.' });
      }

      // The body is already validated by the middleware.
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
      // Pass errors to the global error handler
      next(error);
    }
  },
);

/**
 * POST /api/user/regenerate-rss-token
 * Description: Regenerates the RSS token for the authenticated user.
 * Access: Private (requires authentication)
 */
router.post(
  '/regenerate-rss-token',
  protect,
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

      res.status(200).json({ newRssToken: newToken });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
