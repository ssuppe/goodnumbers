// goodnumbers-workspace/goodnumbers/src/routes/journals.ts
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Zod schema for validating CUIDs in route parameters
const paramsSchema = z.object({
  id: z.string().cuid2({ message: 'Invalid ID format' }),
});

// GET /api/journals - Fetch all journals for the logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const journals = await prisma.journal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(journals);
  } catch (error: unknown) {
    const userIdForLog = req.auth?.user?.id || 'unknown';
    console.error(
      `[ERROR] Failed to fetch journals for user ${userIdForLog}:`,
      error,
    );
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// GET /api/journals/:id - Fetch a single journal by its ID
router.get('/:id', protect, async (req, res) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        details: validation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const { id } = validation.data;

    const journal = await prisma.journal.findUnique({
      where: {
        id: id,
        userId: userId, // Ownership Check
      },
      include: {
        clusters: true,
      },
    });

    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.status(200).json(journal);
  } catch (error: unknown) {
    const userIdForLog = req.auth?.user?.id || 'unknown';
    console.error(
      `[ERROR] Failed to fetch journal ${req.params.id} for user ${userIdForLog}:`,
      error,
    );
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// POST /api/journals - Create a new journal entry
router.post('/', protect, async (req, res) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const newJournal = await prisma.journal.create({
      data: {
        userId: userId,
        status: 'PENDING',
        progress: 0,
      },
    });

    res.status(201).json(newJournal);
  } catch (error: unknown) {
    const userIdForLog = req.auth?.user?.id || 'unknown';
    console.error(
      `[ERROR] Failed to create journal for user ${userIdForLog}:`,
      error,
    );
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// GET /api/journals/status/:id - Poll for journal generation progress
router.get('/status/:id', protect, async (req, res) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        details: validation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const { id } = validation.data;

    const journalStatus = await prisma.journal.findUnique({
      where: { id: id, userId: userId },
      select: {
        status: true,
        progress: true,
        statusMessage: true,
      },
    });

    if (!journalStatus) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.status(200).json(journalStatus);
  } catch (error: unknown) {
    const userIdForLog = req.auth?.user?.id || 'unknown';
    console.error(
      `[ERROR] Failed to get status for journal ${req.params.id} for user ${userIdForLog}:`,
      error,
    );
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// Secure Zod schema for updating a journal.
const updateJournalSchema = z.object({
  weeklyVibe: z.string().optional(),
  influencingFactors: z.array(z.string()).optional(),
  goalsForNextWeek: z.string().optional(),
  clusterNotes: z.record(z.string().cuid2(), z.string()).optional(),
});

// PUT /api/journals/:id - Update a journal entry and its notes
router.put('/:id', protect, async (req, res) => {
  try {
    const paramsValidation = paramsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        details: paramsValidation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const { id } = paramsValidation.data;

    const bodyValidation = updateJournalSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: bodyValidation.error.flatten().fieldErrors,
      });
    }
    const { clusterNotes, ...journalData } = bodyValidation.data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const journalUpdateResult = await tx.journal.updateMany({
        where: { id: id, userId: userId },
        data: journalData,
      });

      if (journalUpdateResult.count === 0) {
        throw new Error('Journal not found or permission denied');
      }

      if (clusterNotes) {
        for (const clusterId in clusterNotes) {
          await tx.glycemicEventCluster.updateMany({
            where: { id: clusterId, journalId: id },
            data: { userNotes: clusterNotes[clusterId] },
          });
        }
      }
    });

    const updatedJournal = await prisma.journal.findUnique({
      where: { id },
      include: { clusters: true },
    });

    res.status(200).json(updatedJournal);
  } catch (error: unknown) {
    const userIdForLog = req.auth?.user?.id || 'unknown';
    console.error(
      `[ERROR] Failed to update journal ${req.params.id} for user ${userIdForLog}:`,
      error,
    );
    if ((error as Error).message.includes('permission denied')) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// DELETE /api/journals/:id - Delete a journal entry
router.delete('/:id', protect, async (req, res) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        details: validation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const { id } = validation.data;

    const deleteResult = await prisma.journal.deleteMany({
      where: { id: id, userId: userId },
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    res.status(204).send();
  } catch (error: unknown) {
    const userIdForLog = req.auth?.user?.id || 'unknown';
    console.error(
      `[ERROR] Failed to delete journal ${req.params.id} for user ${userIdForLog}:`,
      error,
    );
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

export const journalsRouter = router;
