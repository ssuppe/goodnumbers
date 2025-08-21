# Implementation Plan: Phase 3, Task 1 - Journal CRUD APIs (Revised and Security-Hardened)

**Author:** Technical Lead
**Assignee:** Junior Engineer
**Status:** Not Started

## 1. Overview

This document provides a detailed, step-by-step guide to implementing the core CRUD (Create, Read, Update, Delete) API endpoints for Journals. These endpoints are essential for allowing users to manage their weekly journal entries.

We will follow a strict Test-Driven Development (TDD) methodology. For each piece of functionality, you will first write a failing test, then write the implementation code to make the test pass, and finally refactor if necessary.

**A critical focus of this task is security.** We are handling sensitive user health data, and therefore every endpoint must be hardened against common web vulnerabilities. Pay close attention to the security callouts throughout this document.

Please follow all conventions outlined in `docs/DEVELOP-PROCESS.md` and `GEMINI.md`.

**Note on Best Practices and Test Expectations:** This document emphasizes security best practices. Test expectations for unauthenticated requests to protected endpoints will align with `401 Unauthorized` responses, as authentication middleware will be prioritized over CSRF protection middleware in the application's `index.ts`.

## 2. Pre-Implementation Setup

### 2.1. Create a GitHub Issue

First, create a new issue in the GitHub repository for this task.

- **Title:** `feat(api): P3_T1 Implement Journal CRUD APIs`
- **Description:**

  ```
  This task involves creating the backend API endpoints required for managing user journals.

  **Endpoints to Implement:**
  - `POST /api/journals`
  - `GET /api/journal-status/:id`
  - `GET /api/journals`
  - `GET /api/journals/:id`
  - `PUT /api/journals/:id`
  - `DELETE /api/journals/:id`

  **Acceptance Criteria:**
  - All endpoints are protected by authentication.
  - All endpoints enforce data ownership (a user can only access their own journals).
  - All endpoints are covered by integration tests.
  - Input for `PUT` is validated using a strict Zod schema.
  - All state-changing endpoints (`POST`, `PUT`, `DELETE`) are protected against CSRF attacks.
  - All endpoints are protected by rate limiting.
  ```

### 2.2. Branch Setup

Create your feature branch from the `develop` branch.

```bash
# Ensure you are on the develop branch and have the latest changes
git checkout develop
git pull origin develop

# Create your feature branch
git checkout -b feat/p3-t1-journal-crud-apis

# Push the new branch to the remote repository to link it with the issue
git push -u origin feat/p3-t1-journal-crud-apis
```

### 2.3. Security Middleware Verification (`helmet`)

> **Security Pre-Instruction:** Before writing any new code, it's essential to understand the application's existing security posture. Review the main server entry point file (likely `src/server/index.ts`) to verify if the `helmet` security middleware is already in use. Our goal is to ensure our new API router is protected by it, not to add it if it's already present.

1.  **Check for `helmet`:** Look for a line like `app.use(helmet());`.
2.  **Confirm or Add:**
    - If it's already there, great! Confirm that our new `journalsRouter` will be added _after_ the `helmet` middleware is applied, so it is protected.
    - If it is not present, install it (`npm install helmet`) and add it near the top of your `index.ts` file. This is a critical first line of defense against many common web vulnerabilities.

## 3. Stage 1: Read Endpoints (`GET /api/journals` and `GET /api/journals/:id`)

**Goal:** Implement the endpoints for fetching a user's journals. This stage establishes the foundational read patterns, ownership checks, and error handling.

### Step 1.1: Write the Failing Tests

Create the test file. We will test the unauthorized case, the "get all" case, and the "get one by id" case, including the crucial security test that one user cannot fetch another's journal.

```typescript
// file: goodnumbers-workspace/src/server/routes/journals.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app, server } from "../index";
import request from "supertest";
import { prisma } from "../prisma";
import { cuid } from "@paralleldrive/cuid2";

let testUser;
let otherUser;
let testJournal;

beforeAll(async () => {
  [testUser, otherUser] = await Promise.all([
    prisma.user.create({
      data: { email: "testuser@example.com", name: "Test User" },
    }),
    prisma.user.create({
      data: { email: "otheruser@example.com", name: "Other User" },
    }),
  ]);

  testJournal = await prisma.journal.create({
    data: {
      id: cuid(), // Use cuid to match schema
      userId: testUser.id,
      status: "COMPLETE",
      podcastTitle: "Test Journal",
    },
  });

  // Mock authentication middleware for tests
  app.use((req, res, next) => {
    if (req.headers["x-test-user-id"]) {
      req.session = { user: { id: req.headers["x-test-user-id"] as string } };
    } else {
      req.session = undefined;
    }
    next();
  });
});

afterAll(async () => {
  await prisma.journal.deleteMany({});
  await prisma.user.deleteMany({});
  server.close();
});

describe("Journal Read APIs", () => {
  describe("GET /api/journals", () => {
    it("should return 401 Unauthorized if user is not logged in", async () => {
      const response = await request(app).get("/api/journals");
      expect(response.status).toBe(401);
    });

    it("should return 200 OK and an array of journals for the logged-in user", async () => {
      const response = await request(app)
        .get("/api/journals")
        .set("x-test-user-id", testUser.id);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(testJournal.id);
    });

    it("should return 200 OK and an empty array for a user with no journals", async () => {
      const response = await request(app)
        .get("/api/journals")
        .set("x-test-user-id", otherUser.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe("GET /api/journals/:id", () => {
    it("should return 401 Unauthorized if user is not logged in", async () => {
      const response = await request(app).get(
        `/api/journals/${testJournal.id}`
      );
      expect(response.status).toBe(401);
    });

    it("should return 400 Bad Request for an invalid ID format", async () => {
      const response = await request(app)
        .get(`/api/journals/not-a-valid-id`)
        .set("x-test-user-id", testUser.id);
      expect(response.status).toBe(400);
    });

    it("should return 404 Not Found if journal belongs to another user", async () => {
      const response = await request(app)
        .get(`/api/journals/${testJournal.id}`)
        .set("x-test-user-id", otherUser.id);
      expect(response.status).toBe(404);
    });

    it("should return 200 OK and the journal data if user is owner", async () => {
      const response = await request(app)
        .get(`/api/journals/${testJournal.id}`)
        .set("x-test-user-id", testUser.id);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testJournal.id);
    });
  });
});
```

### Step 1.2: Implement the Endpoints

Create the router. In this step, we will also establish our patterns for **parameter validation** and **secure error logging**.

> **Security Pre-Instruction:**
>
> 1.  **Parameter Validation:** Look for other routes in the codebase. Is there an existing pattern for validating URL parameters (like `:id`)? We want to ensure IDs match the CUID format defined in our Prisma schema. We will use Zod for this.
> 2.  **Error Logging:** Check other `try...catch` blocks in the application. Is there a standard logging utility (like Winston or Pino) or a consistent `console.error` format? We must log errors server-side for security monitoring and debugging, without leaking details to the client.

```typescript
// file: goodnumbers-workspace/src/server/routes/journals.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { protect } from "../middleware/auth";

const router = Router();

// Zod schema for validating CUIDs in route parameters
const paramsSchema = z.object({
  id: z.string().cuid({ message: "Invalid ID format" }),
});

// GET /api/journals - Fetch all journals for the logged-in user
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const journals = await prisma.journal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(journals);
  } catch (error) {
    // Secure Logging: Log the full error for internal review.
    console.error(
      `[ERROR] Failed to fetch journals for user ${req.session.user.id}:`,
      error
    );
    // Generic Response: Do not leak error details to the client.
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

// GET /api/journals/:id - Fetch a single journal by its ID
router.get("/:id", protect, async (req, res) => {
  try {
    // Parameter Validation: Ensure the ID is a valid CUID before querying.
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request parameter",
        details: validation.error.errors,
      });
    }
    const { id } = validation.data;
    const userId = req.session.user.id;

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
      return res.status(404).json({ error: "Journal not found" });
    }
    res.status(200).json(journal);
  } catch (error) {
    console.error(
      `[ERROR] Failed to fetch journal ${req.params.id} for user ${req.session.user.id}:`,
      error
    );
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

export const journalsRouter = router;
```

### Step 1.3: Commit Your Work

```bash
git add .
git commit -m "feat(api): P3_T1 implement GET /journals and /journals/:id with validation"
```

## 4. Stage 2: Create and Monitor Journal (`POST` and `GET /journal-status/:id`)

**Goal:** Implement the endpoint to start journal creation and the endpoint to monitor its progress. Here we will introduce critical security middleware for **Rate Limiting** and modern, stateless **CSRF Protection**.

### Step 2.1: Security Hardening (Middleware)

> **Security Pre-Instruction:** Before implementing the `POST` endpoint, review `src/server/index.ts` to see if rate-limiting or CSRF protection middleware is already configured. Our goal is to apply these protections to our new endpoints consistently with the rest of the application.

1.  **Rate Limiting:** To prevent abuse and DoS attacks, we must limit how many requests a user can make. If not already present, install and configure `express-rate-limit`.

    ```bash
    npm install express-rate-limit
    ```

    ```typescript
    // In src/server/index.ts
    import rateLimit from "express-rate-limit";

    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per window
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Apply to all API routes
    app.use("/api", apiLimiter);
    ```

2.  **CSRF Protection (`csrf-csrf`):** We will use the modern `csrf-csrf` library for stateless CSRF protection.

    First, install the necessary packages.

    ```bash
    npm install csrf-csrf cookie-parser
    npm install --save-dev @types/cookie-parser
    ```

    Next, create a dedicated configuration file for CSRF.

    ```typescript
    // file: goodnumbers-workspace/src/server/middleware/csrf.ts
    import { doubleCsrf } from "csrf-csrf";
    import { Request } from "express";

    // Security: A CSRF secret MUST be a cryptographically strong,
    // randomly generated string and loaded from environment variables.
    if (!process.env.CSRF_SECRET) {
      throw new Error("CSRF_SECRET environment variable is not set!");
    }
    const isProduction = process.env.NODE_ENV === "production";

    export const {
      invalidCsrfTokenError,
      generateCsrfToken,
      doubleCsrfProtection,
    } = doubleCsrf({
      getSecret: (req: Request) => process.env.CSRF_SECRET as string,
      getSessionIdentifier: (req: Request) => req.session?.id || "",
      cookieName: isProduction ? "__Host-csrf-token" : "csrf-token",
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
      getTokenFromRequest: (req: Request) =>
        req.headers["x-csrf-token"] as string,
    });
    ```

    Finally, integrate the middleware into your main server file. Middleware order is critical.

    ```typescript
    // In src/server/index.ts
    import cookieParser from "cookie-parser";
    import { doubleCsrfProtection, generateCsrfToken } from "./middleware/csrf"; // Adjust path

    // ...
    app.use(cookieParser());
    // ... (your session middleware)

    // API route for the frontend to get a CSRF token
    app.get("/api/csrf-token", (req, res) => {
      const csrfToken = generateCsrfToken(req, res);
      res.json({ csrfToken });
    });

    // Apply the CSRF protection middleware to all subsequent routes.
    app.use(doubleCsrfProtection);

    // Mount your API routers AFTER the CSRF protection middleware
    app.use("/api/journals", journalsRouter);
    // ... (your error handling middleware)
    ```

### Step 2.2: Write Failing Tests

Update the test file to handle the new CSRF protection flow.

```typescript
// file: goodnumbers-workspace/src/server/routes/journals.test.ts
// Add these new describe blocks to the test file

describe("CSRF Protection", () => {
  it("should generate a CSRF token", async () => {
    const response = await request(app).get("/api/csrf-token");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("csrfToken");
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("should reject a POST request without a CSRF token", async () => {
    const response = await request(app)
      .post("/api/journals")
      .set("x-test-user-id", testUser.id)
      .send({});
    expect(response.status).toBe(403);
  });
});

describe("Journal Creation and Status APIs", () => {
  let createdJournalId: string;
  let agent: request.SuperAgentTest;
  let csrfToken: string;

  beforeAll(async () => {
    agent = request.agent(app);
    const tokenRes = await agent.get("/api/csrf-token");
    csrfToken = tokenRes.body.csrfToken;

    const response = await agent
      .post("/api/journals")
      .set("x-test-user-id", testUser.id)
      .set("x-csrf-token", csrfToken)
      .send({});

    expect(response.status).toBe(201);
    createdJournalId = response.body.id;
  });

  it("POST /api/journals should return 401 Unauthorized if user is not logged in", async () => {
    const response = await request(app).post("/api/journals").send({});
    expect(response.status).toBe(401);
  });

  it("POST /api/journals should create a new journal with a valid CSRF token", async () => {
    // This test is effectively covered by the beforeAll block, but we keep it for clarity
    // and to ensure the beforeAll setup is correct.
    const response = await agent
      .post("/api/journals")
      .set("x-test-user-id", testUser.id)
      .set("x-csrf-token", csrfToken)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("id");
    expect(response.body.userId).toBe(testUser.id);
    expect(response.body.status).toBe("PENDING");
  });

  it("GET /api/journals/status/:id should return 401 Unauthorized if user is not logged in", async () => {
    const response = await request(app).get(
      `/api/journals/status/${createdJournalId}`
    );
    expect(response.status).toBe(401);
  });

  it("GET /api/journals/status/:id should return 404 if another user tries to get status", async () => {
    const response = await request(app)
      .get(`/api/journals/status/${createdJournalId}`)
      .set("x-test-user-id", otherUser.id);
    expect(response.status).toBe(404);
  });

  it("GET /api/journals/status/:id should return 200 and the correct status for the owner", async () => {
    const response = await request(app)
      .get(`/api/journals/status/${createdJournalId}`)
      .set("x-test-user-id", testUser.id);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("PENDING");
    expect(response.body.progress).toBe(0);
  });
});
```

### Step 2.3: Implement the Endpoints

Add the handlers to your router file.

```typescript
// file: goodnumbers-workspace/src/server/routes/journals.ts
// ... (add these routes to the existing file)

// POST /api/journals - Create a new journal entry
router.post("/", protect, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const newJournal = await prisma.journal.create({
      data: {
        userId: userId,
        status: "PENDING",
        progress: 0,
      },
    });

    res.status(201).json(newJournal);
  } catch (error) {
    console.error(
      `[ERROR] Failed to create journal for user ${req.session.user.id}:`,
      error
    );
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

// GET /api/journal-status/:id - Poll for journal generation progress
router.get("/status/:id", protect, async (req, res) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request parameter",
        details: validation.error.errors,
      });
    }
    const { id } = validation.data;
    const userId = req.session.user.id;

    const journalStatus = await prisma.journal.findUnique({
      where: { id: id, userId: userId },
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
    console.error(
      `[ERROR] Failed to get status for journal ${req.params.id} for user ${req.session.user.id}:`,
      error
    );
    res.status(500).json({ error: "An internal server error occurred." });
  }
});
```

### Step 2.4: Commit Your Work

```bash
git add .
git commit -m "feat(api): P3_T1 implement POST /journals and GET /journal-status/:id"
```

## 5. Stage 3: Update and Delete Journals (`PUT` and `DELETE`)

**Goal:** Implement the final two CRUD operations with secure data validation and hardened transactional updates.

### Step 3.1: Write Failing Tests

Add the final set of tests, ensuring they follow the CSRF token flow for `PUT` and `DELETE` requests.

```typescript
// file: goodnumbers-workspace/src/server/routes/journals.test.ts
// Add these new describe blocks

describe("PUT /api/journals/:id", () => {
  let clusterToUpdate;
  let agent;
  let csrfToken;

  beforeAll(async () => {
    clusterToUpdate = await prisma.glycemicEventCluster.create({
      data: {
        id: cuid(),
        journalId: testJournal.id,
        eventType: "HIGH",
        eventCount: 5,
        meanTimeMinutes: 120,
        clusterDataJson: {},
      },
    });

    // Set up an agent and get a CSRF token once for all tests in this block
    agent = request.agent(app);
    const tokenRes = await agent.get("/api/csrf-token");
    csrfToken = tokenRes.body.csrfToken;
  });

  it("should return 401 Unauthorized if user is not logged in", async () => {
    const response = await request(app)
      .put(`/api/journals/${testJournal.id}`)
      .send({});
    expect(response.status).toBe(401);
  });

  it("should return 400 Bad Request for invalid data", async () => {
    const response = await agent
      .put(`/api/journals/${testJournal.id}`)
      .set("x-test-user-id", testUser.id)
      .set("x-csrf-token", csrfToken)
      .send({ weeklyVibe: 123 }); // Invalid data type
    expect(response.status).toBe(400);
  });

  it("should return 400 Bad Request for insecure `influencingFactors` payload", async () => {
    const response = await agent
      .put(`/api/journals/${testJournal.id}`)
      .set("x-test-user-id", testUser.id)
      .set("x-csrf-token", csrfToken)
      .send({ influencingFactors: { $ne: null } }); // Malicious payload
    expect(response.status).toBe(400);
  });

  it("should correctly update the journal and its cluster notes", async () => {
    const updateData = {
      weeklyVibe: "Sprouting",
      goalsForNextWeek: "Test my new API endpoints.",
      influencingFactors: ["Good Sleep", "Quiet Week"],
      clusterNotes: {
        [clusterToUpdate.id]: "This is a note for the cluster.",
      },
    };
    const response = await agent
      .put(`/api/journals/${testJournal.id}`)
      .set("x-test-user-id", testUser.id)
      .set("x-csrf-token", csrfToken)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.weeklyVibe).toBe(updateData.weeklyVibe);

    const updatedCluster = await prisma.glycemicEventCluster.findUnique({
      where: { id: clusterToUpdate.id },
    });
    expect(updatedCluster.userNotes).toBe(
      updateData.clusterNotes[clusterToUpdate.id]
    );
  });
});

describe("DELETE /api/journals/:id", () => {
  it("should return 401 Unauthorized if user is not logged in", async () => {
    const response = await request(app)
      .delete(`/api/journals/${testJournal.id}`);
    expect(response.status).toBe(401);
  });

  it("should delete the journal and return 204 No Content", async () => {
    const agent = request.agent(app);
    const tokenRes = await agent.get("/api/csrf-token");
    const csrfToken = tokenRes.body.csrfToken;

    const response = await agent
      .delete(`/api/journals/${testJournal.id}`)
      .set("x-test-user-id", testUser.id)
      .set("x-csrf-token", csrfToken);

    expect(response.status).toBe(204);

    const found = await prisma.journal.findUnique({
      where: { id: testJournal.id },
    });
    expect(found).toBeNull();
  });
});
```

### Step 3.2: Implement the Endpoints

Implement the `PUT` and `DELETE` handlers. Pay close attention to the **secure Zod schema** and the **hardened transaction logic**.

> **Security Pre-Instruction:** Review the PRD to understand the expected data structure for user inputs like `influencingFactors`. Never trust client input; always validate it against a strict schema. We will also review our transaction logic to ensure ownership is verified atomically.

````bash
# Install zod if it's not already in the project
npm install zod```

```typescript
// file: goodnumbers-workspace/src/server/routes/journals.ts
// ... (add the Zod schema and the PUT/DELETE routes to the existing file)

// Secure Zod schema for updating a journal.
const updateJournalSchema = z.object({
  weeklyVibe: z.string().optional(),
  influencingFactors: z.array(z.string()).optional(),
  goalsForNextWeek: z.string().optional(),
  clusterNotes: z.record(z.string().cuid(), z.string()).optional(),
});

// PUT /api/journals/:id - Update a journal entry and its notes
router.put('/:id', protect, async (req, res) => {
  try {
    const paramsValidation = paramsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({ error: 'Invalid request parameter', details: paramsValidation.error.errors });
    }
    const { id } = paramsValidation.data;
    const userId = req.session.user.id;

    const bodyValidation = updateJournalSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({ error: 'Invalid request body', details: bodyValidation.error.errors });
    }
    const { clusterNotes, ...journalData } = bodyValidation.data;

    await prisma.$transaction(async (tx) => {
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
  } catch (error) {
    console.error(`[ERROR] Failed to update journal ${req.params.id} for user ${req.session.user.id}:`, error);
    if (error.message.includes('permission denied')) {
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
        return res.status(400).json({ error: 'Invalid request parameter', details: validation.error.errors });
    }
    const { id } = validation.data;
    const userId = req.session.user.id;

    const deleteResult = await prisma.journal.deleteMany({
      where: { id: id, userId: userId },
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(`[ERROR] Failed to delete journal ${req.params.id} for user ${req.session.user.id}:`, error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});
````

### Step 3.3: Commit Your Work

```bash
git add .
git commit -m "feat(api): P3_T1 implement PUT and DELETE /journals/:id with secure validation"
```

## 6. Final Steps

Proceed with the Code Review, Cleanup, and Pull Request process as outlined in the `DEVELOPMENT_PROCESS.md`. This revised plan now reflects all functional requirements and includes critical security hardening measures.
