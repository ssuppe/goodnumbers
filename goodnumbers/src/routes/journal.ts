import { Router } from 'express';
import { prisma } from '../lib/prisma.ts';

const router = Router();

// This handler will only be reached if the request has already passed
// through the 'protect' and 'csrf' middleware successfully.
router.post('/', async (req, res) => {
  // We can safely assume 'req.user' exists because of the 'protect' middleware.
  const userId = req.user!.id;

  try {
    const journal = await prisma.journal.create({
      data: { userId },
    });
    // Respond with a '201 Created' status and the new journal object.
    res.status(201).json({ journal });
  } catch (error) {
    console.error(`[API] Failed to create journal for user ${userId}:`, error);
    res.status(500).json({ error: 'Could not create journal.' });
  }
});

export default router;
