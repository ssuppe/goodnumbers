// Frontend/src/routes/journal.ts
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getJournalQueue } from '../lib/queue.js';

const router = Router();

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
        `[API] CRITICAL: Job enqueue failed for journal ${journal.id}. Rolling back.`
      );
      await prisma.journal.delete({ where: { id: journal.id } });
    }
    next(error);
  }
});

export default router;
