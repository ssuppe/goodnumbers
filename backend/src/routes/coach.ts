import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getJournalQueue } from '../lib/queue.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for starting coaching sessions (max 10 requests per 15 min window)
const coachSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many coaching session requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * POST /api/coach/sessions
 * Starts an on-demand Quick Coach session for the authenticated user:
 * 1. Checks user has valid Nightscout credentials configured
 * 2. Checks user does not already have a PENDING session (409 Conflict)
 * 3. Creates a 7-day lookback journal with status PENDING
 * 4. Enqueues BullMQ process-journal job (with transactional rollback on failure)
 */
router.post('/sessions', coachSessionLimiter, async (req, res, next) => {
  const userId = req.user!.id;
  let journal;

  try {
    // 1. Fetch user to verify Nightscout configuration
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nightscoutUrl: true, nightscoutToken: true },
    });

    if (!user?.nightscoutUrl || !user?.nightscoutToken) {
      return res.status(400).json({
        error:
          'Nightscout credentials required to start a coaching session. Please configure them in Settings.',
        code: 'NIGHTSCOUT_REQUIRED',
      });
    }

    // 2. Concurrency guard: reject if a session is already pending or actively processing
    const activePending = await prisma.journal.findFirst({
      where: {
        userId,
        status: { notIn: ['COMPLETE', 'FAILED'] },
      },
    });

    if (activePending) {
      return res.status(409).json({
        error:
          'A session is already in progress. Please wait for it to complete.',
        code: 'SESSION_IN_PROGRESS',
      });
    }

    // 3. Compute 7-day window
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 4. Create PENDING journal
    journal = await prisma.journal.create({
      data: {
        userId,
        status: 'PENDING',
        startDate,
        endDate: now,
      },
    });

    // 5. Enqueue BullMQ job
    const queue = getJournalQueue();
    await queue.add('process-journal', { journalId: journal.id });

    return res.status(201).json({
      journalId: journal.id,
      status: 'PENDING',
    });
  } catch (error) {
    // Rollback orphaned journal if enqueueing failed
    if (journal) {
      console.error(
        `[API] Enqueue failed for coach journal ${journal.id}. Rolling back record.`,
      );
      try {
        await prisma.journal.delete({ where: { id: journal.id } });
      } catch (deleteError) {
        console.error(
          `[API] Rollback failed for journal ${journal.id}:`,
          deleteError,
        );
      }
    }
    next(error);
  }
});

export default router;
