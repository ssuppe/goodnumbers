import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getJournalQueue } from '../lib/queue.js';
import { journalIdParamSchema } from '@goodnumbers/schemas'; // Import the new schema
import { z } from 'zod';
import rateLimit from 'express-rate-limit'; // 1. Import rate-limit

const router = Router();

// 2. Define a specific rate limiter for the status polling endpoint.
// This provides a defense-in-depth measure against abuse.
const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many status requests. Please try again in a minute.',
  },
});

router.get('/', async (req, res, next) => {
  try {
    const journals = await prisma.journal.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        podcastTitle: true,
        podcastDescription: true,
        weeklyVibe: true,
      },
    });
    res.status(200).json(journals);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const userId = req.user!.id;
  let journal;

  try {
    // 1. Create the journal with PENDING status.
    journal = await prisma.journal.create({
      data: { userId, status: 'PENDING' },
    });

    // 2. Enqueue the job for the worker.
    const journalQueue = getJournalQueue();
    await journalQueue.add('process-journal', { journalId: journal.id });

    res.status(201).json({ journal });
  } catch (error) {
    // 3. CRITICAL ROLLBACK LOGIC: If enqueueing fails, delete the orphaned journal.
    if (journal) {
      console.error(
        `[API] CRITICAL: Job enqueue failed for journal ${journal.id}. Rolling back.`,
      );
      await prisma.journal.delete({ where: { id: journal.id } });
    }
    next(error);
  }
});

// 3. Add the new route, applying the rate limiter before the handler.
router.get('/:id/status', statusLimiter, async (req, res, next) => {
  try {
    // 1. Validate input first. This is our primary security gate.
    const { id: journalId } = journalIdParamSchema.parse(req.params);
    const userId = req.user!.id;

    const journalStatus = await prisma.journal.findFirst({
      where: { id: journalId, userId: userId },
      select: { status: true, progress: true, statusMessage: true },
    });

    if (!journalStatus) {
      console.log(
        `[INFO][SECURITY] Journal status not found. UserID='${userId}' attempted to access JournalID='${journalId}'`,
      );
      return res.status(404).json({ error: 'Journal not found.' });
    }

    res.status(200).json(journalStatus);
  } catch (error) {
    // 2. Handle validation errors specifically.
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    // 3. Pass all other unexpected errors to the global handler.
    next(error);
  }
});

export default router;
