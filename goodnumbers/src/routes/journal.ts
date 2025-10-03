import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getJournalQueue } from '../lib/queue.js';
import { journalIdParamSchema } from "../lib/validation.js"; // Import the new schema
import { z } from "zod";
import rateLimit from "express-rate-limit"; // 1. Import rate-limit

const router = Router();

// 2. Define a specific rate limiter for the status polling endpoint.
// This provides a defense-in-depth measure against abuse.
const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many status requests. Please try again in a minute.",
  },
});

// Add a schema for userId validation
const userIdSchema = z.string().cuid({ message: "Invalid user ID format." });

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

// 3. Add the new route, applying the rate limiter before the handler.
router.get("/:id/status", statusLimiter, async (req, res, next) => {
  try {
    // A. Validate input first. This is our primary security gate.
    const { id: journalId } = journalIdParamSchema.parse(req.params);
    // Validate userId as well
    const userId = userIdSchema.parse(req.user!.id); // Add Zod validation for userId

    // B. Perform database query with validated data, including the ownership check.
    const journalStatus = await prisma.journal.findFirst({
      where: {
        id: journalId,
        userId: userId, // CRITICAL: This ensures a user can only see their own journals.
      },
      select: {
        status: true,
        progress: true,
        statusMessage: true,
      },
    });

    // C. Handle the "not found" case.
    if (!journalStatus) {
      // SECURITY LOGGING: Record the failed attempt. This helps detect
      // potential enumeration attacks or bugs. Note that we do NOT log
      // any sensitive data from the request body or other headers.
      console.log(
        `[INFO][SECURITY] Journal status not found. UserID='${userId}' attempted to access JournalID='${journalId}'`
      );
      // Return a generic 404 to prevent ID enumeration.
      return res.status(404).json({ error: "Journal not found." });
    }

    // D. Return the data on success.
    res.status(200).json(journalStatus);
  } catch (error) {
    // E. Handle validation errors specifically.
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    // F. Pass all other unexpected errors to the global handler.
    next(error);
  }
});

export default router;
