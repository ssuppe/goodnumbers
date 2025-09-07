import { Router } from 'express';
import { prisma } from '../lib/prisma.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

// This route allows a user to sign the agreements.
// It is protected (must be logged in) but does NOT use the onboarding middleware.
router.post('/agreements', protect, async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { agreementsSigned: true },
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(
      `[API] Failed to update agreements for user ${req.user.id}:`,
      error,
    );
    res.status(500).json({ error: 'Could not save agreements.' });
  }
});

export default router;
