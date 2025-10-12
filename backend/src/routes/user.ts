// Frontend/src/routes/user.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { protect } from '../middleware/auth.js';
import { enforceAgreements } from '../middleware/enforceAgreements.js'; // Import it
import { userSettingsSchema } from '@goodnumbers/schemas';
import { encrypt } from '../lib/encryption.js';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

// Create a specific rate limiter for this sensitive endpoint.
const settingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      'Too many requests to update settings, please try again after 15 minutes.',
  },
});

const router = Router();

router.put(
  '/settings',
  protect,
  enforceAgreements, // Re-add enforceAgreements here
  settingsLimiter,
  async (req, res) => {
    // SECURITY: The user's identity is sourced from the `req.user` object,
    // which is securely populated by the upstream `protect` middleware.
    // All subsequent operations are authorized for this user ID only.
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const validatedSettings = userSettingsSchema.parse(req.body);
      const dataToUpdate: z.infer<typeof userSettingsSchema> = {
        ...validatedSettings,
      };

      // Securely handle the Nightscout token
      if (typeof validatedSettings.nightscoutToken === 'string') {
        const token = validatedSettings.nightscoutToken;
        // 1. Store the encrypted full token
        dataToUpdate.nightscoutToken = encrypt(token);
        // 2. Store the non-sensitive 3-char hint
        dataToUpdate.nightscoutTokenLast3 = token.slice(-3);
      } else if (validatedSettings.nightscoutToken === null) {
        // If the user submitted a blank token, we do not update it.
        // However, we should not clear the hint.
        delete dataToUpdate.nightscoutToken;
      }

      await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.issues });
      }
      console.error(
        `[API] Failed to update settings for user ${userId}:`,
        error,
      );
      res.status(500).json({ error: 'Could not save settings.' });
    }
  },
);

export default router;
