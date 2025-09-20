# Goodnumbers — PHASE 3, TASK1

## TL;DR

Implement the secure, ownership-enforced, and test-driven CRUD (Create, Read, Update, Delete) API for the core `Journal` resource.

## Invariants (do not change)

- **Server-Side Enforcement:** All authorization and validation logic **MUST** be enforced on the server. The client is never trusted.
- **Data Segregation:** A user **MUST NEVER** be able to read, update, or delete another user's data. All database queries for specific resources must be scoped by the authenticated user's ID.
- **Test-Driven Development:** All functionality must be introduced by first writing a failing integration test that codifies the API contract and security requirements.

## Assumptions & Scope

- **Assumption: Project State:** This task begins from the state of the project at the completion of Phase 2, as reflected in the `phase3develop` branch.
- **Assumption: Middleware Availability:** The `protect` (authentication) and `enforceOnboarding` (authorization) middleware functions are implemented, tested, and available for use.
- **Assumption: CSRF Middleware Execution:** The global `ExpressAuth` middleware is assumed to be registered before the journal routes, providing automatic CSRF protection for all state-changing endpoints.
- **Scope:** This task includes creating a new Zod validation schema, a new Express router for journal endpoints, and a comprehensive integration test suite.
- **Out of Scope:** Implementation of the background job queue (deferred to Task 2), frontend UI, and the actual data analysis logic.

## Objectives

1.  **Codify API Contract as Tests:** Create a comprehensive integration test suite that defines and verifies the behavior, security, and ownership rules for all five journal API endpoints.
2.  **Implement Journal Lifecycle API:** Build the `POST`, `GET` (list), `GET` (by ID), `PUT`, and `DELETE` endpoints for the `/api/journals` resource.
3.  **Enforce Security & Ownership:** Correctly apply the existing `protect` and `enforceOnboarding` middleware, and ensure every database operation is strictly scoped to the authenticated user.
4.  **Implement Robust Input Validation:** Create and apply a `zod` schema for the `PUT` endpoint and for URL parameters to ensure data integrity and security.
5.  **Achieve Passing Suite:** Ensure all new integration tests pass, providing a green build for our CI/CD quality gate.

## Risks & Mitigations

- **Risk: (CRITICAL) Horizontal Privilege Escalation.** A user could potentially access or modify another user's journal by guessing its ID.
  - **Mitigation:** The implementation will enforce a strict "no-compromise" rule: every single database query for a specific journal will contain a `where` clause that filters by **both** the journal ID and the `userId` from the authenticated session (`req.user.id`).
- **Risk: (HIGH) Cross-Site Request Forgery (CSRF).** An attacker could trick an authenticated user's browser into making unintentional state-changing requests (e.g., creating or deleting a journal) from a malicious site.
  - **Mitigation:** All state-changing endpoints (`POST`, `PUT`, `DELETE`) **must** be protected by an anti-CSRF mechanism. We will leverage the built-in, double-submit cookie protection provided by Auth.js. The frontend client will be responsible for fetching a token and including it in all state-changing requests.
- **Risk: (Medium) Resource Exhaustion / Denial of Service.** The `POST /api/journals` endpoint is resource-intensive, creating a database record and preparing for a background job. A malicious actor could abuse this endpoint to overwhelm the system or incur high API costs.
  - **Mitigation:** A specific, stricter rate limit will be applied only to the `POST /api/journals` endpoint to prevent rapid, repeated creation of new journals, while the rest of the API remains governed by the global rate limiter.
- **Risk: (Medium) Un-onboarded User Access.** A user who has not completed the onboarding flow could access journal creation endpoints, leading to a confusing user experience or bad data states.
  - **Mitigation:** The entire `/api/journals` route group will be protected by the `enforceOnboarding` middleware, which runs after authentication and guarantees the user has completed all necessary setup steps.
- **Risk: (Low) Invalid Data Submission.** A client could send malformed data to the `PUT` endpoint or a malformed ID in the URL, corrupting a journal entry or causing unnecessary database load.
  - **Mitigation:** A strict, server-side `zod` schema will validate the request body of the `PUT` endpoint, rejecting any request that does not conform to the expected shape. Additionally, all route parameters (like `:id`) will be validated to ensure they are in the expected format (CUID) before they are used in a database query.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Build the complete backend API for managing journal entries, ensuring it is secure and scalable from day one.
- **Mechanism:**
  1.  **TDD (Test-Driven Development):**
      - **RED:** Write a new, comprehensive integration test file (`journals.test.ts`) that covers all success cases, error states (401, 403, 404, 400), data ownership rules, CSRF protection, and invalid parameter handling for all five CRUD endpoints.
      - **GREEN:** Implement the Express router (`src/routes/journal.ts`), the Zod validation schemas (`src/lib/validation.ts`), and wire them into the main application (`src/index.ts`) with the correct middleware and rate limiters to make all tests pass.
      - **REFACTOR:** Review the implementation for clarity, security, and adherence to project conventions.
- **Trade-offs:** This TDD-first approach requires more upfront time to write tests but significantly reduces the risk of security flaws and regressions. It provides a robust safety net for future development. This is a positive trade-off.
- **Go/No-Go:** Go. The approach is secure, testable, and aligns with the project's established development process.

## Implementation Notes

- **API Base Path:** All routes will be under `/api/journals`.
- **Middleware Chain:** The router will be attached in `src/index.ts` using `app.use('/api/journals', protect, enforceOnboarding, journalRoutes)`.
- **CSRF Protection:** The core `ExpressAuth` middleware handles CSRF protection. Our tests must be written to fetch a token from `/api/auth/csrf` and include it in all `POST`, `PUT`, and `DELETE` requests to pass this check.
- **Rate Limiting:** A specific, stricter rate limiter must be applied directly to the `POST /` route within the `journal.ts` router file to prevent abuse of the resource-intensive creation endpoint.
- **Parameter Validation:** The `:id` route parameter used in `GET`, `PUT`, and `DELETE` must be validated to ensure it is a CUID. Requests with a malformed ID should be rejected with a `400 Bad Request` status _before_ attempting a database query.
- **Status Codes:** Per RESTful best practices, a successful `POST` request that creates a resource **must** return a `201 Created` status code. A successful `DELETE` request **must** return a `204 No Content` status code.
- **Ownership Enforcement:** All Prisma queries for single resources (`findUnique`, `update`, `delete`) must use a compound `where` clause: `where: { id: ..., userId: req.user.id }`. For list queries, use `where: { userId: req.user.id }`.
- **Secure Deletion:** The `DELETE` endpoint must return a `404 Not Found` if the journal does not exist _or_ if it belongs to another user. This is a critical security practice to prevent ID enumeration, where an attacker could otherwise determine which IDs are valid by observing `404` vs. `403` responses.
- **Zod Schemas:**
  - `journalUpdateSchema`:
    - `weeklyVibe`: `z.string().optional()`
    - `influencingFactors`: `z.array(z.string()).optional()`
    - `goalsForNextWeek`: `z.string().optional()`
    - `clusterNotes`: `z.record(z.string()).optional()`
  - `idParamSchema`:
    - `id`: `z.string().cuid()` (To validate the journal ID in the URL path).

## Acceptance Gates

1.  All new integration tests in `journals.test.ts` must pass.
2.  The `POST /api/journals` endpoint successfully creates a new journal and returns a `201 Created` status.
3.  The `GET /api/journals` endpoint returns only the journals belonging to the authenticated user.
4.  The `GET`, `PUT`, and `DELETE` endpoints for `/api/journals/:id` all return a `404 Not Found` error when a user attempts to access a journal belonging to another user.
5.  The `PUT /api/journals/:id` endpoint correctly rejects requests with invalid data shapes with a `400 Bad Request` error.
6.  The `GET`, `PUT`, and `DELETE` endpoints for `/api/journals/:id` all return a `400 Bad Request` error if the provided `:id` is not a valid CUID.
7.  The `POST`, `PUT`, and `DELETE` endpoints all return a `403 Forbidden` error if a valid CSRF token is not provided.

## “Make-sure-you” Checklist

- \[ ] Have you created the `phase3develop` branch before starting any work?
- \[ ] Have you created the new integration test file **before** writing the implementation code?
- \[ ] Does your test suite include specific tests to verify that one user cannot access another user's data?
- \[ ] Have you applied both the `protect` and `enforceOnboarding` middleware to the journal router?
- \[ ] Have you added a stricter, endpoint-specific rate limiter to the `POST /api/journals` route?
- \[ ] Does **every** Prisma query that accesses a journal record include a `where` clause with the `userId`?
- \[ ] Have you created and used the new `journalUpdateSchema` for the `PUT` endpoint?
- \[ ] Have you created and used the new `idParamSchema` to validate the `:id` parameter in the URL?
- \[ ] Have your tests for `POST`, `PUT`, and `DELETE` been updated to handle CSRF tokens?

## Project hygiene prep

1.  **Create the Phase 3 Development Branch:**
    ```bash
    git checkout phase2develop
    git pull origin phase2develop
    git checkout -b phase3develop
    git push origin phase3develop
    ```
2.  **Create a GitHub Issue:**
    ```bash
    gh issue create --title "feat(api): P3_T1 Implement Journal CRUD API" --body "Implements the secure, ownership-enforced CRUD API for the Journal resource. Includes TDD with security and validation checks. Closes P3_T1."
    ```
3.  **Create a Feature Branch:**
    ```bash
    git checkout phase3develop
    git pull origin phase3develop
    git checkout -b feat/P3_T1-journal-crud-api
    ```

## In-depth test plan

The TDD process begins by creating a new test file that codifies all requirements as failing tests.

```typescript
// file: goodnumbers/tests/integration/journals.test.ts
import request from "supertest";
import { app } from "../../src/index.ts";
import * as http from "http";
import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();
let server: http.Server;
let user1: User;
let user2: User;
let csrfToken: string;
let agent: request.SuperTest<request.Test>;

// Helper function to get a valid CSRF token.
const getCsrfToken = async (testAgent: request.SuperTest<request.Test>) => {
  const response = await testAgent.get("/api/auth/csrf");
  return response.body.csrfToken;
};

describe("Journal API (/api/journals)", () => {
  beforeAll((done) => {
    server = app.listen(0, () => {
      // Create an agent to maintain cookies across requests
      agent = request.agent(server);
      done();
    });
  });

  beforeEach(async () => {
    // Clean and seed the database for each test
    await prisma.journal.deleteMany();
    await prisma.user.deleteMany();

    user1 = await prisma.user.create({
      data: {
        email: `user1-${Date.now()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: "https://user1.ns.com",
        preferredUnits: "MGDL",
      },
    });

    user2 = await prisma.user.create({
      data: {
        email: `user2-${Date.now()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: "https://user2.ns.com",
        preferredUnits: "MGDL",
      },
    });

    // Seed a journal for user2 to test ownership rules
    await prisma.journal.create({
      data: {
        userId: user2.id,
        status: "COMPLETE",
      },
    });

    // Fetch a fresh CSRF token before each test
    csrfToken = await getCsrfToken(agent);
  });

  afterAll(async (done) => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    server.close(done);
  });

  // Test Suite for POST /api/journals
  describe("POST /api/journals", () => {
    it("should return 401 Unauthorized if no user is authenticated", async () => {
      const res = await agent.post("/api/journals").send({ csrfToken });
      expect(res.status).toBe(401);
    });

    it("should return 403 Forbidden if the CSRF token is missing", async () => {
      const res = await agent
        .post("/api/journals")
        .set("x-test-user-id", user1.id)
        .send({}); // No CSRF token
      expect(res.status).toBe(403);
    });

    it("should create a new journal with PENDING status and return 201 Created", async () => {
      const res = await agent
        .post("/api/journals")
        .set("x-test-user-id", user1.id)
        .send({ csrfToken });

      expect(res.status).toBe(201);
      expect(res.body.journal).toBeDefined();
      expect(res.body.journal.userId).toBe(user1.id);
      expect(res.body.journal.status).toBe("PENDING");

      const dbJournal = await prisma.journal.findUnique({
        where: { id: res.body.journal.id },
      });
      expect(dbJournal).not.toBeNull();
    });
  });

  // Test Suite for GET /api/journals
  describe("GET /api/journals", () => {
    it("should return 401 Unauthorized if no user is authenticated", async () => {
      const res = await agent.get("/api/journals");
      expect(res.status).toBe(401);
    });

    it("should return only the journals belonging to the authenticated user", async () => {
      // Create a journal for user1
      await prisma.journal.create({ data: { userId: user1.id } });

      const res = await agent
        .get("/api/journals")
        .set("x-test-user-id", user1.id);

      expect(res.status).toBe(200);
      expect(res.body.journals).toBeInstanceOf(Array);
      expect(res.body.journals.length).toBe(1);
      expect(res.body.journals.userId).toBe(user1.id);
    });
  });

  // Test Suite for GET /api/journals/:id
  describe("GET /api/journals/:id", () => {
    it("should return 400 Bad Request if the journal ID is not a valid CUID", async () => {
      const res = await agent
        .get(`/api/journals/invalid-id-format`)
        .set("x-test-user-id", user1.id);
      expect(res.status).toBe(400);
    });

    it("should return the journal if it belongs to the authenticated user", async () => {
      const journal = await prisma.journal.create({
        data: { userId: user1.id },
      });
      const res = await agent
        .get(`/api/journals/${journal.id}`)
        .set("x-test-user-id", user1.id);

      expect(res.status).toBe(200);
      expect(res.body.journal.id).toBe(journal.id);
    });

    it("should return 404 Not Found if the journal belongs to another user", async () => {
      const otherUserJournal = await prisma.journal.findFirst({
        where: { userId: user2.id },
      });
      const res = await agent
        .get(`/api/journals/${otherUserJournal!.id}`)
        .set("x-test-user-id", user1.id);

      expect(res.status).toBe(404);
    });
  });

  // Test Suite for PUT /api/journals/:id
  describe("PUT /api/journals/:id", () => {
    it("should update the journal if it belongs to the user", async () => {
      const journal = await prisma.journal.create({
        data: { userId: user1.id },
      });
      const updatePayload = {
        weeklyVibe: "Sprouting",
        goalsForNextWeek: "Test goals",
        influencingFactors: ["Busy", "Poor Sleep"],
        csrfToken,
      };

      const res = await agent
        .put(`/api/journals/${journal.id}`)
        .set("x-test-user-id", user1.id)
        .send(updatePayload);

      expect(res.status).toBe(200);
      const updatedJournal = await prisma.journal.findUnique({
        where: { id: journal.id },
      });
      expect(updatedJournal?.weeklyVibe).toBe("Sprouting");
      expect(updatedJournal?.influencingFactors).toEqual([
        "Busy",
        "Poor Sleep",
      ]);
    });

    it("should return 404 Not Found if trying to update another user's journal", async () => {
      const otherUserJournal = await prisma.journal.findFirst({
        where: { userId: user2.id },
      });
      const res = await agent
        .put(`/api/journals/${otherUserJournal!.id}`)
        .set("x-test-user-id", user1.id)
        .send({ weeklyVibe: "Hacked", csrfToken });

      expect(res.status).toBe(404);
    });

    it("should return 400 Bad Request for an invalid request body", async () => {
      const journal = await prisma.journal.create({
        data: { userId: user1.id },
      });
      const invalidPayload = {
        influencingFactors: "this should be an array, not a string",
        csrfToken,
      };

      const res = await agent
        .put(`/api/journals/${journal.id}`)
        .set("x-test-user-id", user1.id)
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  // Test Suite for DELETE /api/journals/:id
  describe("DELETE /api/journals/:id", () => {
    it("should delete the journal if it belongs to the user and return 204 No Content", async () => {
      const journal = await prisma.journal.create({
        data: { userId: user1.id },
      });

      const res = await agent
        .delete(`/api/journals/${journal.id}`)
        .set("x-test-user-id", user1.id)
        .send({ csrfToken });

      expect(res.status).toBe(204);
      const deletedJournal = await prisma.journal.findUnique({
        where: { id: journal.id },
      });
      expect(deletedJournal).toBeNull();
    });

    it("should return 404 Not Found if trying to delete another user's journal", async () => {
      const otherUserJournal = await prisma.journal.findFirst({
        where: { userId: user2.id },
      });

      const res = await agent
        .delete(`/api/journals/${otherUserJournal!.id}`)
        .set("x-test-user-id", user1.id)
        .send({ csrfToken });

      expect(res.status).toBe(404);
      const journalStillExists = await prisma.journal.findUnique({
        where: { id: otherUserJournal!.id },
      });
      expect(journalStillExists).not.toBeNull();
    });
  });
});
```

## In-depth engineering plan

### Commit 1: RED — Write Failing Integration Tests

First, we codify all requirements for the journal API as a set of failing tests.

#### **Action 1: Create the Test File**

Create a new file `goodnumbers/tests/integration/journals.test.ts` and add the full content from the test plan above.

#### **Action 2: Verify Failure and Commit**

Run the test suite. The tests will fail with `404 Not Found` and `403 Forbidden` errors because the `/api/journals` routes do not exist yet and CSRF protection isn't handled. This is our **RED** state.

```bash
cd goodnumbers
npm test
git add .
git commit -m "test(api): add failing tests for journal crud api"
```

---

### Commit 2: GREEN — Implement and Fix

Now, write the necessary code to make all tests pass.

#### **Action 1: Create Zod Validation Schemas**

Update `goodnumbers/src/lib/validation.ts` to include the schemas for updating a journal and for validating URL parameters.

```typescript
// file: goodnumbers/src/lib/validation.ts
import { z } from "zod";

export const userSettingsSchema = z.object({
  nightscoutUrl: z.string().url().optional().nullable(),
  nightscoutToken: z.string().min(1).optional().nullable(),
  preferredUnits: z.enum(["MGDL", "MMOL"]).optional(),
  agreementsSigned: z.boolean().optional(),
});

// NEW: Add the schema for journal updates
export const journalUpdateSchema = z.object({
  weeklyVibe: z.string().optional(),
  influencingFactors: z.array(z.string()).optional(),
  goalsForNextWeek: z.string().optional(),
  clusterNotes: z.record(z.string()).optional(),
});

// NEW: Add a schema for validating CUIDs in URL parameters
export const idParamSchema = z.object({
  id: z.string().cuid({ message: "Invalid journal ID format." }),
});
```

#### **Action 2: Create the Journal Routes**

Create a new file for the journal router. Implement all five endpoint handlers with validation and a specific rate limiter for the creation endpoint.

```typescript
// file: goodnumbers/src/routes/journal.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.ts";
import { journalUpdateSchema, idParamSchema } from "../lib/validation.ts";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const router = Router();

// Create a specific, stricter rate limiter for the journal creation endpoint.
const journalCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 creation requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many journal creation requests. Please try again later.",
  },
});

// POST /api/journals - Create a new journal
router.post("/", journalCreationLimiter, async (req, res) => {
  const userId = req.user!.id;
  try {
    const journal = await prisma.journal.create({
      data: { userId },
    });
    res.status(201).json({ journal });
  } catch (error) {
    console.error(`[API] Failed to create journal for user ${userId}:`, error);
    res.status(500).json({ error: "Could not create journal." });
  }
});

// GET /api/journals - Get all journals for a user
router.get("/", async (req, res) => {
  const userId = req.user!.id;
  try {
    const journals = await prisma.journal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ journals });
  } catch (error) {
    console.error(`[API] Failed to fetch journals for user ${userId}:`, error);
    res.status(500).json({ error: "Could not fetch journals." });
  }
});

// A small, reusable middleware to validate the `:id` parameter.
// This keeps the route handlers clean and follows the "Don't Repeat Yourself" principle.
const validateIdParam = (req, res, next) => {
  try {
    idParamSchema.parse(req.params);
    next(); // If validation succeeds, proceed to the route handler.
  } catch (error) {
    if (error instanceof z.ZodError) {
      // If validation fails, immediately respond with an error.
      return res.status(400).json({ errors: error.issues });
    }
    // For unexpected errors, pass them to the global error handler.
    next(error);
  }
};

// GET /api/journals/:id - Get a single journal
router.get("/:id", validateIdParam, async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  try {
    const journal = await prisma.journal.findUnique({
      where: { id, userId }, // CRITICAL: Enforce ownership
    });
    if (!journal) {
      return res.status(404).json({ error: "Journal not found." });
    }
    res.status(200).json({ journal });
  } catch (error) {
    console.error(
      `[API] Failed to fetch journal ${id} for user ${userId}:`,
      error
    );
    res.status(500).json({ error: "Could not fetch journal." });
  }
});

// PUT /api/journals/:id - Update a journal
router.put("/:id", validateIdParam, async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  try {
    const validatedData = journalUpdateSchema.parse(req.body);
    const journal = await prisma.journal.update({
      where: { id, userId }, // CRITICAL: Enforce ownership
      data: validatedData,
    });
    res.status(200).json({ journal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      // SECURITY: This is the desired behavior for ownership enforcement.
      // If a record with the given `id` exists but does not match the `userId`,
      // Prisma's `update` fails with P2025, correctly triggering a 404 Not Found.
      // This prevents an attacker from distinguishing between a non-existent
      // record and a record they don't have permission to access.
      return res.status(404).json({ error: "Journal not found." });
    }
    console.error(
      `[API] Failed to update journal ${id} for user ${userId}:`,
      error
    );
    res.status(500).json({ error: "Could not update journal." });
  }
});

// DELETE /api/journals/:id - Delete a journal
router.delete("/:id", validateIdParam, async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  try {
    await prisma.journal.delete({
      where: { id, userId }, // CRITICAL: Enforce ownership
    });
    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      // SECURITY: This is the desired behavior for ownership enforcement, same as in the PUT handler.
      // If Prisma cannot find a record that matches both the `id` and the `userId`,
      // it means either the journal doesn't exist or the user doesn't own it.
      // In either case, returning a 404 is the most secure response.
      return res.status(404).json({ error: "Journal not found." });
    }
    console.error(
      `[API] Failed to delete journal ${id} for user ${userId}:`,
      error
    );
    res.status(500).json({ error: "Could not delete journal." });
  }
});

export default router;
```

#### **Action 3: Wire Up the Router in the Main App**

Update `goodnumbers/src/index.ts` to use the new journal router with the correct middleware chain.

```typescript
// file: goodnumbers/src/index.ts
// ... (keep all existing imports and createApp logic)
import userRoutes from "./routes/user.ts";
import journalRoutes from "./routes/journal.ts"; // NEW: Import journal routes
import { protect } from "./middleware/auth.ts";
import { enforceOnboarding } from "./middleware/onboarding.ts";
import { escapeHtml } from "./lib/utils.ts";

// ... Inside the createApp() function ...

// --- API Routes ---
app.use("/api/user", userRoutes);
// NEW: Add the journal routes with the full security middleware chain
app.use("/api/journals", protect, enforceOnboarding, journalRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ... (rest of the file remains the same)
```

#### **Action 4: Verify Success and Commit**

Run the test suite again. All tests, including the new journal API tests, should now pass. This is our **GREEN** state.

```bash
cd goodnumbers
npm test
git add .
git commit -m "feat(api): P3_T1 implement journal crud api"
```

---

### Commit 3: REFACTOR — Review and Push

Review the code for clarity, security, and adherence to our conventions. The critical ownership checks, validation, CSRF protection, and rate limiting are now in place, and the code is well-organized.

After a final review, push the branch and create a Pull Request.

```bash
cd goodnumbers
git push origin feat/P3_T1-journal-crud-api
gh pr create --base phase3develop --title "feat(api): P3_T1 Implement Journal CRUD API" --body "Closes #<issue_number>. This PR implements the secure and ownership-enforced CRUD API for the Journal resource."
```
