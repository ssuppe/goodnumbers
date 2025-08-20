import express from 'express';
import { PrismaClient } from '@prisma/client';
import { userSettingsSchema } from '../lib/schemas';
import { encrypt } from '../lib/encryption';
import { protect } from '../middleware/auth';

import rateLimit from 'express-rate-limit'; // Add this import

const router = express.Router();
const prisma = new PrismaClient();

// --- SECURITY: A stricter rate limiter for sensitive operations ---
// This prevents an attacker from spamming the token regeneration endpoint
// to cause a denial-of-service for a legitimate user's podcast feed.
const sensitiveOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * PUT /api/user/settings
 * Description: Updates the settings for the authenticated user.
 * Access: Private (requires authentication)
 */
router.put('/settings', protect, async (req, res) => {
  try {
    // --- RECOMMENDATION: DEFENSIVE CODING ---
    // The `protect` middleware should guarantee that `req.auth.user.id` exists.
    // However, for maximum safety and to prevent future mistakes (e.g., a developer
    // accidentally using this handler without the middleware), we add a runtime check.
    // This avoids crashes and provides a clearer server-side error if something is misconfigured.
    const userId = req.auth?.user?.id;
    if (!userId) {
      console.error(
        '[FATAL] userId not found in request after protect middleware. This indicates a server misconfiguration.',
      );
      return res.status(500).json({ message: 'Internal server error.' });
    }

    // 1. Validate the request body against our Zod schema.
    const validation = userSettingsSchema.safeParse(req.body);

    if (!validation.success) {
      // If validation fails, return a 400 Bad Request with the error details.
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { nightscoutUrl, nightscoutToken, preferredUnits } = validation.data;

    // 2. Encrypt the sensitive credentials before saving them.
    const encryptedUrl = encrypt(nightscoutUrl);
    const encryptedToken = encrypt(nightscoutToken);

    // 3. Update the user record in the database.
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        nightscoutUrl: encryptedUrl,
        nightscoutToken: encryptedToken,
        preferredUnits: preferredUnits,
      },
      // --- SECURITY FIX: PREVENT INFORMATION DISCLOSURE ---
      // We have modified the `select` clause to prevent leaking sensitive data.
      // NEVER return credentials or any representation of them (even encrypted) to the client.
      // The client only needs confirmation of success and any non-sensitive fields that changed.
      select: {
        id: true,
        email: true,
        preferredUnits: true,
        // REMOVED: nightscoutUrl: true,
      },
    });

    // 4. Return a 200 OK response with the safe, updated user data.
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error in PUT /api/user/settings:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

import { createId } from '@paralleldrive/cuid2';

/**
 * POST /api/user/regenerate-rss-token
 * Description: Regenerates the RSS token for the authenticated user.
 * Access: Private (requires authentication)
 */
router.post(
  '/regenerate-rss-token',
  protect,
  sensitiveOperationLimiter,
  async (req, res) => {
    try {
      const userId = req.auth?.user?.id;
      if (!userId) {
        console.error(
          '[FATAL] userId not found in request after protect middleware. This indicates a server misconfiguration.',
        );
        return res.status(500).json({ message: 'Internal server error.' });
      }

      // SECURE: Generate a new unique token using the official cuid2 library.
      const newToken = createId();

      await prisma.user.update({
        where: { id: userId },
        data: {
          rssToken: newToken,
        },
      });

      res.status(200).json({ newRssToken: newToken });
    } catch (error) {
      // SECURITY: Log only the error message, not the entire error object.
      const message =
        error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Error in POST /api/user/regenerate-rss-token:', message);
      res.status(500).json({ message: 'Internal server error.' });
    }
  },
);

export default router;
