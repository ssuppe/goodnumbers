Of course. Based on the initial design and our discussion, I have produced a complete and verbose engineering plan for Phase 3, Task 3.

This document integrates the security hardening recommendations for rate limiting and logging, and includes detailed explanations for each step, making it suitable for a junior engineer to follow.

Here is the updated engineering document:

# Goodnumbers — Phase 3, Task 3: Secure Journal Status Endpoint

**Version:** 2.0
**Author:** Software & Security Expert

## 1. Overview for the Junior Engineer

Welcome to Task 3 of Phase 3. The goal of this task is to implement a new, secure API endpoint that allows our frontend application to check on the progress of a journal's generation. When a user creates a journal, it kicks off a long-running background job. This new endpoint, `GET /api/journals/:id/status`, is what the frontend will "poll" (call repeatedly) to ask, "Is it done yet?".

This document is your complete guide to implementing this feature. It's designed to be extremely detailed, not just explaining _what_ to do, but _why_ you're doing it. The highest priority for this task is **security**. We will be handling user data, so it is critical that we build this endpoint with a security-first mindset. We will ensure that a user can _only_ see the status of their own journals and that the endpoint is protected from abuse.

We will follow the Test-Driven Development (TDD) process outlined in `DEVELOPMENT_PROCESS.md`. You will write the tests first to define the endpoint's behavior, see them fail, and then write the application code to make them pass.

---

## 2. Invariants (do not change)

- **Data Segregation**: A user can **only** access data they own. All database queries for specific resources must include a `WHERE userId = '...'` clause.
- **Authentication**: All endpoints under `/api/journals/` must be protected by the `protect` middleware.
- **Consistent Validation**: All client-provided inputs, including URL parameters, must be validated before use.

## 3. Assumptions & Scope

- **Assumption**: The `protect` middleware correctly authenticates a user and attaches a `user` object with a valid `id` to the Express `request` object.
- **Assumption**: The `Journal` model in `prisma/schema.prisma` contains the necessary status fields (`status`, `progress`, `statusMessage`).
- **Scope**: This task is strictly limited to implementing the read-only `GET /api/journals/:id/status` endpoint.

## 4. Objectives

1.  Implement a new API route: `GET /api/journals/:id/status`.
2.  The endpoint shall return a `200 OK` with the `status`, `progress`, and `statusMessage` for the requested journal.
3.  The endpoint must return a `400 Bad Request` if the journal ID in the URL is malformed.
4.  The endpoint must return a `404 Not Found` if the journal ID does not exist or if it belongs to another user.
5.  The endpoint must be protected against high-frequency polling abuse (rate limiting).
6.  Achieve 100% test coverage for the new route handler logic.

## 5. Risks & Mitigations

- **Risk**: **Information Leakage (IDOR)**. A malicious user could attempt to guess journal IDs to read the status of another user's private data.
  - **Mitigation**: Implement a strict data ownership check within the database query (`WHERE id = ? AND userId = ?`). The `404` response will be the same for "not found" and "not owned" to prevent ID enumeration.
- **Risk**: **Invalid Input**. A malformed journal ID (e.g., not a `cuid`) could cause an unexpected database error or even an injection vulnerability if not handled properly.
  - **Mitigation**: Use `zod` to validate the format of the `id` from `req.params` _before_ it is used in any database query.
- **Risk**: **Resource Exhaustion (Denial-of-Service)**. A buggy client or malicious actor could call this polling endpoint at an extremely high frequency, putting an unnecessary load on the database and server.
  - **Mitigation**: Apply a specific `express-rate-limit` middleware directly to this route to control how often a single client can poll for status updates.
- **Risk**: **Lack of Security Auditing**. If an attacker attempts to guess journal IDs, the server will correctly deny access, but we would have no record of this suspicious activity.
  - **Mitigation**: Implement structured, informational-level logging whenever a request is made for a journal that isn't found for the authenticated user. This creates a security audit trail.

## 6. Security Deep Dive: The "Why" Behind Our Choices

This section explains the security principles we are building into this endpoint. Understanding these is crucial.

- **Input Validation First**: We always validate client input _before_ doing anything else. This "fail-fast" approach is a core security principle. By using `zod` at the top of our handler, we ensure that malformed or malicious data never even reaches our database query logic.
- **Preventing IDOR (Insecure Direct Object Reference)**: This is the most common and dangerous vulnerability in APIs like this. It occurs when the application only uses an object's ID (like `journalId`) to fetch it, without checking if the _current user_ has permission to see it. Our mitigation is the `WHERE { id: journalId, userId: req.user.id }` clause. This guarantees that we only ever find a journal if it both exists AND belongs to the person making the request.
- **Response Obfuscation**: Notice that we return a `404 Not Found` whether the journal doesn't exist at all or if it belongs to another user. This is intentional. If we returned `403 Forbidden` for a journal owned by someone else, an attacker could write a script to guess IDs and learn which ones are valid just by looking at the response code. Our generic `404` prevents this "ID enumeration" attack.
- **Defense-in-Depth with Rate Limiting**: This endpoint is designed to be polled. We must assume it will be called frequently. A rate limit acts as a crucial safety valve. It protects our server and database from being overwhelmed by a single, misbehaving client, ensuring the service remains available for everyone else.
- **Security Logging for Auditing**: Logging failed access attempts is like having a security camera. If someone is trying to rattle the doorknobs on all the journals, we want to know about it. Our informational log message provides a valuable audit trail that security tools (or a human) can later analyze to detect patterns of abuse.

## 7. Implementation Notes

- **File to Modify (Validation)**: `src/lib/validation.ts`
- **File to Modify (Routing)**: `src/routes/journal.ts`
- **Validation Schema**: Add a new schema to `src/lib/validation.ts` for URL parameters. A simple `cuid` check is sufficient.
  ```typescript
  // In src/lib/validation.ts
  export const journalIdParamSchema = z.object({
    id: z.string().cuid({ message: "Invalid journal ID format." }),
  });
  ```
- **Database Query**:
  - Use `prisma.journal.findFirst`.
  - The `where` clause must be: `{ id: journalId, userId: req.user.id }`.
  - Use a `select` clause to retrieve only `{ status: true, progress: true, statusMessage: true }`.
- **API Contract**:
  - **Request**: `GET /api/journals/:id/status`
  - **Success Response (200 OK)**:
    ```json
    { "status": "PENDING", "progress": 10, "statusMessage": "Starting..." }
    ```
  - **Bad Request (400 Bad Request)**:
    ```json
    {
      "errors": [
        {
          "code": "invalid_string",
          "message": "Invalid journal ID format.",
          "path": ["id"]
        }
      ]
    }
    ```
  - **Not Found / No Access (404 Not Found)**:
    ````json
    { "error": "Journal not found." }
    ```    *   **Too Many Requests (429 Too Many Requests)**:
    ```json
    { "error": "Too many status requests. Please try again in a minute." }
    ````

## 8. In-depth Test Plan

The following tests will be added to `tests/integration/journals.test.ts`.

```typescript
// file: tests/integration/journals.test.ts
// ... (imports and beforeEach setup from previous plan) ...

// Test suite for the new GET /api/journals/:id/status endpoint
describe("GET /api/journals/:id/status", () => {
  let user1;
  let user2;
  let journal1;

  beforeEach(async () => {
    // Create distinct users and a journal for user1
    [user1, user2] = await prisma.user.createManyAndReturn({
      data: [
        {
          email: `user1-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: "...",
        },
        {
          email: `user2-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: "...",
        },
      ],
    });
    journal1 = await prisma.journal.create({
      data: {
        userId: user1.id,
        status: "PROCESSING",
        progress: 50,
        statusMessage: "Analyzing data...",
      },
    });
  });

  it("should return 401 Unauthorized if no user is authenticated", async () => {
    const res = await agent.get(`/api/journals/${journal1.id}/status`);
    expect(res.status).toBe(401);
  });

  it("should return 400 Bad Request for a malformed journal ID", async () => {
    const malformedId = "this-is-not-a-cuid";
    const res = await agent
      .get(`/api/journals/${malformedId}/status`)
      .set("x-test-user-id", user1.id);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toContain("Invalid journal ID format.");
  });

  it("should return 404 Not Found for a non-existent journal ID", async () => {
    const nonExistentId = "clxxxxxxxxxxxxxxxxxxxxxx"; // A valid CUID that doesn't exist
    const res = await agent
      .get(`/api/journals/${nonExistentId}/status`)
      .set("x-test-user-id", user1.id);
    expect(res.status).toBe(404);
  });

  it("should return 404 Not Found when requesting a journal owned by another user", async () => {
    const res = await agent
      .get(`/api/journals/${journal1.id}/status`) // journal1 is owned by user1
      .set("x-test-user-id", user2.id); // but we are authenticated as user2
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Journal not found.");
  });

  it("should return 200 OK with the correct status for a journal owned by the user", async () => {
    const res = await agent
      .get(`/api/journals/${journal1.id}/status`)
      .set("x-test-user-id", user1.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "PROCESSING",
      progress: 50,
      statusMessage: "Analyzing data...",
    });
  });
});
```

## 9. In-depth Engineering Plan

### Step 1: RED — Write Failing Tests

1.  **Modify Test File**: Open `tests/integration/journals.test.ts` and add the new `describe('GET /api/journals/:id/status', ...)` block from the plan above.
2.  **Verify Failure**: Run `npm test`. The new tests will fail with `404 Not Found` because the route does not exist yet. This is our "Red" state and confirms our tests are set up correctly.
3.  **Commit**:
    ```bash
    git add tests/integration/journals.test.ts
    git commit -m "test(api): add failing tests for journal status endpoint"
    ```

### Step 2: GREEN — Implement the Feature

1.  **Update Validation Schema**: Open `src/lib/validation.ts` and add the `journalIdParamSchema`.

    ```typescript
    // file: src/lib/validation.ts
    import { z } from "zod";

    // ... existing userSettingsSchema ...

    export const journalIdParamSchema = z.object({
      id: z.string().cuid({ message: "Invalid journal ID format." }),
    });
    ```

2.  **Implement Route Handler**: Open `src/routes/journal.ts`. We will add the rate limiter and the new route handler here.

    ```typescript
    // file: src/routes/journal.ts
    import { Router } from "express";
    import { prisma } from "../lib/prisma.js";
    import { getJournalQueue } from "../lib/queue.js";
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

    // ... existing POST route ...

    // 3. Add the new route, applying the rate limiter before the handler.
    router.get("/:id/status", statusLimiter, async (req, res, next) => {
      try {
        // A. Validate input first. This is our primary security gate.
        const { id: journalId } = journalIdParamSchema.parse(req.params);
        const userId = req.user!.id;

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
            `[INFO][SECURITY] Journal status not found. UserID='${userId}' attempted to access JournalID='${journalId}'`,
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
    ```

3.  **Verify Success**: Run `npm test`. All tests, including the new ones, should now pass. This is our **GREEN** state.
4.  **Commit**:
    ```bash
    git add src/lib/validation.ts src/routes/journal.ts
    git commit -m "feat(api): P3_T3 implement journal status polling endpoint"
    ```

### Step 3: REFACTOR — Review and Clean Up

1.  **Review Code**: Read through the new code in `src/routes/journal.ts`. The logic is clean, follows our established patterns, and includes detailed comments explaining the security rationale. The `try...catch` block correctly distinguishes between validation errors and other unexpected errors.
2.  **Final Polish**: Run `npm run lint` and `npm run prettier` to ensure code style consistency. No further refactoring is needed at this time.
