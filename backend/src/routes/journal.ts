import { Router } from 'express';
import { prisma, Prisma } from '../lib/prisma.js';
import { getJournalQueue } from '../lib/queue.js';
import {
  journalIdParamSchema,
  journalUpdateSchema,
} from '@goodnumbers/schemas'; // Import the new schema
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
        status: true,
        analysisInsights: true,
        scoreCardData: true,
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

// 4. Add the route to fetch a single journal by ID.
router.get('/:id', async (req, res, next) => {
  try {
    const { id: journalId } = journalIdParamSchema.parse(req.params);
    const userId = req.user!.id;

    const journal = await prisma.journal.findFirst({
      where: { id: journalId, userId: userId },
      include: {
        clusters: {
          orderBy: {
            meanTimeMinutes: 'asc',
          },
        },
      },
    });

    if (!journal) {
      return res.status(404).json({ error: 'Journal not found.' });
    }

    res.status(200).json(journal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id: journalId } = journalIdParamSchema.parse(req.params);
    const userId = req.user!.id;
    const updates = journalUpdateSchema.parse(req.body);

    const { clusterNotes, ...journalUpdates } = updates;

    // FIX: Map 'influencingFactors' explicitly to handle Prisma's strict JSON null types.
    const cleanUpdates: Prisma.JournalUpdateInput = {
      ...journalUpdates,
      influencingFactors:
        journalUpdates.influencingFactors === null
          ? Prisma.DbNull
          : ((journalUpdates.influencingFactors ?? undefined) as
              | Prisma.InputJsonValue
              | undefined),
    };

    // 1. Update the Journal fields
    await prisma.journal.update({
      where: { id: journalId, userId: userId },
      data: cleanUpdates,
    });

    // 2. Update Cluster Notes if provided
    if (clusterNotes) {
      // We need to verify these clusters belong to the journal (and thus the user)
      // A transaction would be ideal here for atomicity
      const updatePromises = Object.entries(clusterNotes).map(
        ([clusterId, note]) =>
          prisma.glycemicEventCluster.updateMany({
            where: {
              id: clusterId,
              journalId: journalId, // Ensure ownership via relation
            },
            data: { userNotes: note },
          }),
      );
      await prisma.$transaction(updatePromises);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    // Handle RecordNotFound from Prisma if ownership check fails
    // (prisma.update throws if record not found)
    // We'll let the global handler catch it or map it to 404/403 if we want to be specific
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id: journalId } = journalIdParamSchema.parse(req.params);
    const userId = req.user!.id;

    await prisma.journal.delete({
      where: { id: journalId, userId: userId },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    next(error);
  }
});

export default router;
