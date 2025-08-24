### Implementation Plan: Phase 3, Task 3 - Journal Status API (Security-Hardened)

**Author:** Technical Lead
**Assignee:** Junior Engineer
**Status:** Not Started

## 1. TL;DR

This document outlines the plan to implement a secure, ownership-enforced, and abuse-resistant `GET /api/journal-status/:id` endpoint for polling journal generation progress.

## 2. Invariants (do not change)

- A user must **only** be able to query the status of journals they own.
- The API response must not leak sensitive implementation details or stack traces.
- The endpoint must be protected by authentication. All unauthorized requests must receive a `401 Unauthorized` response.
- The journal ID supplied in the URL must be a valid CUID; otherwise, the request must be rejected with a `400 Bad Request`.

## 3. Assumptions & Scope

- **Assumption:** The `protect` authentication middleware is available and correctly populates `req.auth.user.id` for authenticated users.
- **Assumption:** The `Journal` model in `prisma/schema.prisma` is up-to-date and includes the `status`, `progress`, and `statusMessage` fields.
- **Scope:** This task is strictly limited to implementing the API endpoint to **read** the journal's status from the database. It does **not** include the background worker logic responsible for **updating** the status.
- **Scope:** The new endpoint will be implemented within the existing `journals.ts` router file.

## 4. Objectives

1.  **Implement Endpoint:** Create a functional `GET /api/journal-status/:id` endpoint.
2.  **Ensure Security:** The endpoint must enforce strict ownership, preventing users from accessing status information for journals they do not own.
3.  **Prevent Abuse:** The endpoint must be protected by rate limiting to prevent denial-of-service attacks.
4.  **Achieve Test Coverage:** Attain 100% integration test coverage for the new endpoint, including success, authentication failure, ownership failure, and invalid ID scenarios.
5.  **Validate Inputs:** The endpoint must validate the incoming journal ID and return a `400 Bad Request` for invalid formats.
6.  **Return Specific Data:** The endpoint should only return the `status`, `progress`, and `statusMessage` fields to the client.

## 5. Risks & Mitigations

- **Risk:** **Information Leakage (ID Probing).** A user could potentially probe for the existence of other users' journals by guessing IDs.
  - **Mitigation:** The database query will be constructed with a compound `where` clause (`{ id: journalId, userId: currentUserId }`). A query for a journal that exists but is owned by another user will return no result, which will be handled with a generic `404 Not Found` response. This prevents an attacker from distinguishing between a journal that doesn't exist and one they don't own.
- **Risk:** **Information Leakage (via `statusMessage`).** The background worker, which runs separately, might write detailed internal error messages or stack traces to the `statusMessage` field in the database for debugging purposes. If our API returns this field directly, it would leak sensitive implementation details to the client.
  - **Mitigation:** A strict contract must be established: the `statusMessage` field is a **user-facing string only**. The background worker must never write technical details to it. For this task, you are not building the worker, but you must be aware of this contract. The API's responsibility is to pass the data, and the worker's responsibility is to ensure the data is safe. This risk will be formally documented and transferred to the worker implementation task.
- **Risk:** **Denial of Service (Resource Exhaustion).** Because this is a polling endpoint, it is a natural target for abuse. A malicious user or a buggy frontend could make an excessive number of requests in a short period, overwhelming the database and server.
  - **Mitigation:** We will apply a specific, strict rate limit to this endpoint to control how frequently it can be called per user. This is a crucial defense against both malicious attacks and accidental bugs.
- **Risk:** **Inconsistent API Responses.** Invalid inputs could lead to unhandled errors or inconsistent response formats.
  - **Mitigation:** We will use Zod to strictly validate the URL parameter for the correct CUID format, ensuring all malformed requests receive a standardized `400 Bad Request` response.

## 6. Method Outline

- **Idea:** Provide a mechanism for the frontend client to poll for the status of a long-running journal generation process.
- **Mechanism:** Implement a standard REST API endpoint. The endpoint will receive a journal ID, authenticate the user, validate ownership of the journal via a database query, and return the relevant status fields.
- **Trade-offs (Polling vs. WebSockets):**
  - **Polling (Chosen):** Simple to implement, stateless, and leverages our existing HTTP infrastructure. Sufficient for a process that completes within a few minutes.
  - **WebSockets:** More efficient for real-time updates but introduces significant complexity (connection management, statefulness, new infrastructure). This is overkill for the MVP.
- **Go/No-Go Decision:** **Go.** The REST polling approach is robust, secure, and aligns perfectly with the current architecture and MVP requirements.

## 7. Implementation Notes

- **API Endpoint:** `GET /api/journals/status/:id` (Note: The route will be `/status/:id` within the `journalsRouter` which is mounted at `/api/journals`).
- **Attach Point:** `goodnumbers-workspace/goodnumbers/src/routes/journals.ts`.
- **Authentication:** The endpoint must be protected by the `protect` middleware.
- **Rate Limiting (Security Critical):**
  - This endpoint MUST have its own rate limiter.
  - Create a new `rateLimit` instance with a configuration suitable for polling, such as `windowMs: 60 * 1000` (1 minute) and `max: 30` (30 requests per minute). This allows the client to poll every 2 seconds, which is more than adequate.
  - Apply this new limiter directly to the endpoint definition.
- **Parameter Validation:**
  - Use the existing `paramsSchema` in `journals.ts` to validate the `:id` parameter as a CUID.
  - **Educational Note:** The distinction between returning a `400 Bad Request` for an invalid ID format (e.g., "not-a-cuid") and a `404 Not Found` for a validly formatted but non-existent ID is a subtle but important security practice. It prevents attackers from easily guessing the format of our internal IDs. Your implementation correctly follows this pattern.
- **Database Query:**
  - Use `prisma.journal.findUnique`.
  - The `where` clause must be: `{ where: { id: id, userId: userId } }`.
  - Use a `select` clause to return only the required fields: `{ select: { status: true, progress: true, statusMessage: true } }`.

## 8. Acceptance Gates

- [ ] A `GET` request to `/api/journals/status/:id` without authentication credentials fails with a `401 Unauthorized` status.
- [ ] A `GET` request with an invalid ID format (e.g., "not-a-cuid") fails with a `400 Bad Request` status.
- [ ] An authenticated `GET` request for a journal ID belonging to another user fails with a `404 Not Found` status.
- [ ] An authenticated `GET` request for a valid journal ID owned by the user succeeds with a `200 OK` status and returns a JSON object containing `status`, `progress`, and `statusMessage`.
- [ ] An excessive number of requests (e.g., >30 in one minute) to the endpoint from the same user results in a `429 Too Many Requests` status.
- [ ] All new and existing integration tests pass successfully.

## 9. “Make-sure-you” Checklist

- [ ] Have you added the `protect` middleware to the new route definition?
- [ ] **Have you added a specific, stricter rate-limiting middleware to the route?**
- [ ] Does your Prisma query's `where` clause include **both** the journal `id` and the `userId`?
- [ ] Are you using a `select` clause in your Prisma query to limit the returned data fields?
- [ ] Have you handled the case where the journal is not found (or not owned) by returning a `404` status?
- [ ] Have you added comprehensive integration tests covering success, 401, 404, 429, and 400 scenarios?
- [ ] Have you wrapped your route handler's logic in a `try...catch` block for robust error handling?

## 10. Project Hygiene Prep

(No changes needed here, the existing plan is solid.)

### 10.1. Create a GitHub Issue

- **Title:** `feat(api): P3_T3 Implement Journal Status API`
- **Description:** (As before)

### 10.2. Branch Setup

- **Branch Name:** `feat/p3-t3-journal-status-api`
- (Commands as before)

## 11. In-depth Test Plan (TDD)

### Step 11.1: Write the Failing Tests

(No changes needed to the tests themselves, they are well-written. The implementation will simply need to satisfy them.)

## 12. In-depth Engineering Plan

### Step 12.1: Implement the Endpoint

Now, write the implementation code in `src/routes/journals.ts` to make the failing tests pass. Note the addition of the new rate limiter.

```typescript
// file: goodnumbers-workspace/goodnumbers/src/routes/journals.ts
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { protect } from "../middleware/auth.js";
import { journalQueue } from "../lib/queue.js";

const router = Router();

// Zod schema for validating CUIDs in route parameters
const paramsSchema = z.object({
  id: z.string().cuid2({ message: "Invalid ID format" }),
});

// --- NEW: Rate limiter specifically for the polling endpoint ---
// This is a crucial security measure to prevent abuse.
// It allows for up to 30 requests per minute from a single IP,
// which is more than enough for our frontend's polling needs.
const statusApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests to this endpoint, please try again in a minute.",
  },
});

// GET /api/journals - Fetch all journals for the logged-in user
router.get("/", protect, async (req, res, next) => {
  try {
    const userId = req.auth.user.id;
    const journals = await prisma.journal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(journals);
  } catch (error) {
    next(error);
  }
});

// GET /api/journals/:id - Fetch a single journal by its ID
router.get("/:id", protect, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request parameter",
        details: validation.error.errors,
      });
    }
    const { id } = validation.data;
    const userId = req.auth.user.id;

    const journal = await prisma.journal.findUnique({
      where: { id: id, userId: userId },
      include: { clusters: true },
    });

    if (!journal) {
      return res.status(404).json({ error: "Journal not found" });
    }
    res.status(200).json(journal);
  } catch (error) {
    next(error);
  }
});

// POST /api/journals - Create a new journal entry
router.post("/", protect, async (req, res, next) => {
  try {
    const userId = req.auth.user.id;
    const newJournal = await prisma.journal.create({
      data: {
        userId: userId,
        status: "PENDING",
        progress: 0,
      },
    });
    await journalQueue.add("generate-journal", { journalId: newJournal.id });
    res.status(201).json(newJournal);
  } catch (error) {
    next(error);
  }
});

// --- NEW ENDPOINT IMPLEMENTATION ---

// GET /api/journals/status/:id - Poll for journal generation progress
router.get("/status/:id", protect, statusApiLimiter, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request parameter",
        details: validation.error.errors,
      });
    }
    const { id } = validation.data;
    const userId = req.auth.user.id;

    const journalStatus = await prisma.journal.findUnique({
      where: { id: id, userId: userId }, // Ownership check
      select: {
        status: true,
        progress: true,
        statusMessage: true,
      },
    });

    if (!journalStatus) {
      return res.status(404).json({ error: "Journal not found" });
    }
    res.status(200).json(journalStatus);
  } catch (error) {
    next(error);
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
router.put("/:id", protect, async (req, res, next) => {
  try {
    const paramsValidation = paramsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({ error: "Invalid request parameter" });
    }
    const { id } = paramsValidation.data;
    const userId = req.auth.user.id;

    const bodyValidation = updateJournalSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    const { clusterNotes, ...journalData } = bodyValidation.data;

    await prisma.$transaction(async (tx) => {
      const journalUpdateResult = await tx.journal.updateMany({
        where: { id: id, userId: userId },
        data: journalData,
      });
      if (journalUpdateResult.count === 0) {
        throw new Error("Journal not found or permission denied");
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
  } catch (error) {
    if (error.message.includes("permission denied")) {
      return res.status(404).json({ error: "Journal not found" });
    }
    next(error);
  }
});

// DELETE /api/journals/:id - Delete a journal entry
router.delete("/:id", protect, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request parameter" });
    }
    const { id } = validation.data;
    const userId = req.auth.user.id;

    const deleteResult = await prisma.journal.deleteMany({
      where: { id: id, userId: userId },
    });
    if (deleteResult.count === 0) {
      return res.status(404).json({ error: "Journal not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export const journalsRouter = router;
```

### Step 12.2: Verify and Commit

Run `npm test` again. All tests, including the new ones for rate limiting, should now pass.

Commit your work.

```bash
git add .
git commit -m "feat(api): P3_T3 implement GET /journals/status/:id endpoint with rate limiting"
```

## 13. Final Steps

Proceed with the Code Review, Cleanup, and Pull Request process as outlined in the `DEVELOPMENT_PROCESS.md`. This task is now complete.
