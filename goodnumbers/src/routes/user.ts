import express from 'express';
import { PrismaClient } from '@prisma/client';
import { userSettingsSchema } from '../lib/schemas';
import { encrypt } from '../lib/encryption';
import { protect } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

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

export default router;
