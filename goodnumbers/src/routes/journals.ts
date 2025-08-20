// file: goodnumbers-workspace/src/server/routes/journals.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db'; // Corrected path to prisma
import { protect } from '../middleware/auth';

const router = Router();

// Zod schema for validating CUIDs in route parameters
const paramsSchema = z.object({
  id: z.string().cuid2({ message: 'Invalid ID format' }),
});

// GET /api/journals - Fetch all journals for the logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const journals = await prisma.journal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(journals);
  } catch (error) {
    // Secure Logging: Log the full error for internal review.
    console.error(
      `[ERROR] Failed to fetch journals for user ${req.session.user.id}:`,
      error,
    );
    // Generic Response: Do not leak error details to the client.
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// GET /api/journals/:id - Fetch a single journal by its ID
router.get('/:id', protect, async (req, res) => {
  try {
    // Parameter Validation: Ensure the ID is a valid CUID before querying.
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        details: validation.error.errors,
      });
    }
    const { id } = validation.data;
    const userId = req.auth.user.id;

    const journal = await prisma.journal.findUnique({
      where: {
        id: id,
        userId: userId, // Ownership Check: Crucial for security.
      },
      include: {
        clusters: true,
      },
    });

    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.status(200).json(journal);
  } catch (error) {
    console.error(
      `[ERROR] Failed to fetch journal ${req.params.id} for user ${req.session.user.id}:`,
      error,
    );
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

export const journalsRouter = router;
