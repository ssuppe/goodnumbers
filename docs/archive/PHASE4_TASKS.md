# Goodnumbers — `P4_REMEDIATION.md`

### TL;DR

Finalize the Phase 4 security sprint by correcting a critical data-integrity flaw with cascading deletes and implementing a robust, server-side authorization middleware for user agreements, refactoring the old onboarding logic in the process.

### Invariants (do not change)

- **Data Segregation**: A user can **only** access data they own. All database queries for specific resources must include a `WHERE userId = '...'` clause.
- **Data Privacy**: Deleting a parent resource (like a `User` or `Journal`) **must** trigger the deletion of all its child data to prevent orphaned, sensitive information.
- **Server-Side Authorization**: The server **must not** trust the client. All access-control decisions, including enforcement of user agreements, must be made and enforced on the server via middleware that terminates the request, not just redirects it.

### Assumptions & Scope

- **Assumption**: All tasks up to and including Phase 3, Task 3 are complete and merged into the `develop` branch.
- **Assumption**: The existing `protect` middleware correctly populates `req.user` with an authenticated user's data from the database.
- **Scope**: This plan is strictly limited to implementing the two incomplete tasks from the "Phase 4: Security Hardening Sprint" as defined in `IMPLEMENTATION_PLAN.md`.
  1.  Correcting the cascading delete behavior for `GlycemicEventCluster`.
  2.  Refactoring the old `enforceOnboarding` middleware into two distinct, single-purpose middlewares (`enforceAgreements` and `enforceAccountSetup`) and applying them correctly across all sensitive API routes.
- **Out of Scope**: No other features will be added. The functionality of the redirects for the placeholder UI pages (`/agreements`, `/setup-account`) will be preserved but handled by the appropriate, refactored middleware.

### Objectives

1.  **Fix Data-Integrity Flaw**: Ensure that when a `Journal` is deleted, all of its associated `GlycemicEventCluster` records are automatically deleted from the database.
2.  **Implement Server-Side Agreement Gate**: Create a new middleware (`enforceAgreements.ts`) that checks if the authenticated user has signed the necessary agreements and returns a `403 Forbidden` JSON error if they have not.
3.  **Refactor Onboarding Logic**: Rename and refactor the existing `enforceOnboarding.ts` middleware into a new `enforceAccountSetup.ts` middleware whose only responsibility is to check if `nightscoutUrl` is set, redirecting if it is not.
4.  **Apply Correct Authorization Chain**: Secure all sensitive API endpoints by applying the new middleware chain in the correct order: `protect` (authentication), followed by `enforceAgreements` (API authorization), followed by `enforceAccountSetup` (UI-flow redirect).
5.  **Achieve 100% Test Coverage**: The new logic for the database cascade and the authorization middleware must be fully validated by new, specific integration tests.

### Risks & Mitigations

- **Risk**: **Orphaned Health Data**. If the cascading delete is not fixed, deleting a journal will leave sensitive `GlycemicEventCluster` data in the database, violating user privacy.
  - **Mitigation**: Add the `onDelete: Cascade` directive to the Prisma schema and verify its behavior with a dedicated integration test that proves the child data is deleted.
- **Risk**: **Authorization Bypass**. The current redirect-based `enforceOnboarding` middleware can be bypassed by non-browser API clients, allowing access to endpoints without signing the user agreement.
  - **Mitigation**: Implement the new `enforceAgreements` middleware that explicitly denies access with a `403 Forbidden` status code, and ensure it is applied to all sensitive API endpoints before the business logic is executed.

### Method Outline (idea → mechanism → trade-offs → go/no-go)

#### 1. Workstream: Data Integrity Fix

- **Idea**: Ensure deleting a journal cleans up all associated cluster data.
- **Mechanism**:
  1.  Modify the `prisma/schema.prisma` file to add an `onDelete: Cascade` directive to the `journal` relation within the `GlycemicEventCluster` model. This tells the database to automatically delete child rows when the parent is deleted.
  2.  Generate and apply a new database migration to enact this schema change.
  3.  Write a new integration test within the existing `tests/integration/privacy.test.ts` file that creates a `Journal` with a child `GlycemicEventCluster`, deletes the `Journal`, and then asserts that the `GlycemicEventCluster` record is no longer present in the database.
- **Trade-offs**: None. This is a non-negotiable fix for data privacy and integrity. It aligns with the existing cascade behavior on the `User` model.
- **Go/No-Go**: **Go**.

#### 2. Workstream: Authorization Refactor

- **Idea**: Separate the concerns of API authorization (agreement signed) and UI-flow enforcement (profile complete) into two distinct, single-purpose middlewares.
- **Mechanism**:
  1.  **Create `enforceAgreements.ts`**: This new middleware will be the API security gate. It will perform one check: `if (!req.user.agreementsSigned)`. If the check fails, it immediately responds with `403 Forbidden` and a JSON error. Otherwise, it calls `next()`.
  2.  **Refactor `enforceOnboarding.ts`**: This existing file will be renamed to `enforceAccountSetup.ts`. Its logic will be simplified to perform only one check: `if (!req.user.nightscoutUrl)`. If this check fails, it will perform the redirect to `/setup-account` as before.
  3.  **Update Middleware Chains**: All routes currently using `enforceOnboarding` will be updated to use the new, more secure chain: `protect, enforceAgreements, enforceAccountSetup`. This ensures that a request is first authenticated, then authorized for API access, and finally, if it's a browser-based request, checked for UI flow completion.
  4.  **Update Tests**: Write new integration tests to verify that requests from a user with `agreementsSigned: false` are correctly rejected with a `403` status, proving the new middleware is working.
- **Trade-offs**: This adds a second middleware to the chain, which is a negligible performance cost. The benefit is a massive improvement in security and code clarity, as each middleware now has a single, clear responsibility.
- **Go/No-Go**: **Go**.

### Implementation Notes

- **Database Schema**: The `onDelete: Cascade` directive must be added to the `journal` relation on the `GlycemicEventCluster` model in `prisma/schema.prisma`.
- **API Contract (New `enforceAgreements` Middleware)**:
  - **Condition**: User's `agreementsSigned` flag is `false`.
  - **Response**: `403 Forbidden`
  - **Body**:
    ```json
    {
      "error": "User has not signed the required agreements.",
      "code": "AGREEMENTS_NOT_SIGNED"
    }
    ```
- **Middleware Application Points**: The new chain `(protect, enforceAgreements, enforceAccountSetup)` will be applied to:
  - `src/index.ts`: The entire `/api/journals` route group.
  - `src/routes/user.ts`: The `PUT /api/user/settings` endpoint.

### Acceptance Gates

1.  The new integration test in `privacy.test.ts` that deletes a `Journal` and confirms its child `GlycemicEventCluster` is also deleted **must pass**.
2.  Integration tests for `POST /api/journals` and `PUT /api/user/settings` made by a user with `agreementsSigned: false` **must fail with a `403` status** and the correct error code.
3.  The same tests made by a user with `agreementsSigned: true` but no `nightscoutUrl` **must still trigger a `302` redirect**, confirming the refactored `enforceAccountSetup` middleware works as intended.
4.  The same tests made by a fully onboarded user (`agreementsSigned: true` and `nightscoutUrl` is set) **must pass with a `2xx` status**.

### “Make-sure-you” Checklist

- [ ] Confirm the new database migration is generated and named descriptively (e.g., `fix-cluster-cascade-delete`).
- [ ] Ensure the new `enforceAgreements` middleware **terminates the request** with `return res.status(403)...` and does not call `next()` when it fails.
- [ ] Verify that `enforceAgreements` is placed **after** `protect` and **before** `enforceAccountSetup` in all middleware chains.
- [ ] Rename the file `src/middleware/enforceOnboarding.ts` to `src/middleware/enforceAccountSetup.ts` and update all `import` statements.
- [ ] Run the entire test suite (`npm test`) to ensure no regressions were introduced.

### Project Hygiene Prep

1.  **Create a Branch**: Following `DEVELOPMENT_PROCESS.md`, create a new feature branch from the latest `develop` branch.

    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b fix/phase4-hardening-remediation
    ```

2.  **Create an Issue**: Create a GitHub Issue to track this work.

    ```bash
    gh issue create --title "fix(security): P4 Remediate incomplete hardening tasks" --body "This work addresses the remaining items from Phase 4: fixing cascading deletes on GlycemicEventCluster and refactoring the onboarding middleware into a secure, two-stage authorization process."
    ```

3.  **Adopt Test-Driven Development**: For each of the two workstreams, you will first write a failing test that captures the requirement, then implement the code to make it pass.

### In-depth Test Plan

#### **Workstream 1: Data Integrity Test**

**Action**: Modify the existing privacy test file to include a new test case for the Journal -> Cluster cascade.

```typescript
// file: tests/integration/privacy.test.ts
import { PrismaClient } from "@prisma/client";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

const prisma = new PrismaClient();

describe("User Data Privacy & Cascading Deletes", () => {
  // Modified describe block title
  // ... existing 'should delete all related data when a user is deleted' test remains unchanged ...

  // ADD THIS NEW TEST CASE
  it("should delete GlycemicEventClusters when their parent Journal is deleted", async () => {
    // Arrange: Create a user with a journal and a cluster
    const user = await prisma.user.create({
      data: {
        email: `cascade-test-${Date.now()}@example.com`,
        journals: {
          create: {
            status: "COMPLETE",
            clusters: {
              create: {
                eventType: "HIGH",
                eventCount: 5,
                meanTimeMinutes: 720,
                clusterDataJson: {},
              },
            },
          },
        },
      },
      include: { journals: { include: { clusters: true } } },
    });
    const journalId = user.journals[0].id;
    const clusterId = user.journals[0].clusters[0].id;

    // Assert precondition: The cluster exists
    const clusterBeforeDelete = await prisma.glycemicEventCluster.findUnique({
      where: { id: clusterId },
    });
    expect(clusterBeforeDelete).not.toBeNull();

    // Act: Delete the parent journal
    await prisma.journal.delete({ where: { id: journalId } });

    // Assert postcondition: The cluster is now gone
    const clusterAfterDelete = await prisma.glycemicEventCluster.findUnique({
      where: { id: clusterId },
    });
    expect(clusterAfterDelete).toBeNull();

    // Cleanup the user
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

#### **Workstream 2: Authorization Enforcement Tests**

**Action**: Add the following tests to `tests/integration/user.test.ts` and `tests/integration/journals.test.ts`.

```typescript
// file: tests/integration/user.test.ts
// ... (inside the 'PUT /api/user/settings' describe block)

it("should return 403 Forbidden if the user has not signed agreements", async () => {
  // Arrange: Create a user who has NOT signed agreements
  const unagreedUser = await prisma.user.create({
    data: {
      email: `unagreed-user-${Date.now()}@test.com`,
      agreementsSigned: false,
    },
  });

  // Act
  const response = await agent
    .put("/api/user/settings")
    .set("x-test-user-id", unagreedUser.id) // Authenticate as this user
    .send({ preferredUnits: "MMOL", _csrf: csrfToken });

  // Assert
  expect(response.status).toBe(403);
  expect(response.body.code).toBe("AGREEMENTS_NOT_SIGNED");
});
```

```typescript
// file: tests/integration/journals.test.ts
// ... (inside the 'POST /api/journals' describe block)

it("should return 403 Forbidden if the user has not signed agreements", async () => {
  // Arrange: Create a user who has NOT signed agreements
  const unagreedUser = await prisma.user.create({
    data: {
      email: `unagreed-journal-user-${Date.now()}@test.com`,
      agreementsSigned: false, // Explicitly set to false
      nightscoutUrl: "https://some-url.com", // Ensure they would otherwise pass the next step
    },
  });

  // Act
  const response = await agent
    .post("/api/journals")
    .set("x-test-user-id", unagreedUser.id)
    .send({ _csrf: csrfToken });

  // Assert
  expect(response.status).toBe(403);
  expect(response.body.code).toBe("AGREEMENTS_NOT_SIGNED");
});

it("should redirect to /setup-account if agreements are signed but account is not set up", async () => {
  // Arrange: User has signed agreements but has no Nightscout URL
  const agreedUser = await prisma.user.create({
    data: {
      email: `agreed-not-setup-user-${Date.now()}@test.com`,
      agreementsSigned: true,
      nightscoutUrl: null, // Explicitly null
    },
  });

  // Act
  const response = await agent
    .post("/api/journals")
    .set("x-test-user-id", agreedUser.id)
    .send({ _csrf: csrfToken });

  // Assert
  expect(response.status).toBe(302); // Expect a redirect
  expect(response.headers.location).toBe("/setup-account");
});
```

### In-depth Engineering Plan

#### **Step 1: RED — Write Failing Cascade-Delete Test**

1.  **Modify Test File**: Open `tests/integration/privacy.test.ts` and add the new `it(...)` block from the test plan above.
2.  **Verify Failure**: Run `npm test`. The new test will fail on a foreign key constraint error. Prisma's default `onDelete: Restrict` behavior prevents you from deleting the `Journal` while a `GlycemicEventCluster` still refers to it. This is our **RED** state.
3.  **Commit**:
    ```bash
    git add tests/integration/privacy.test.ts
    git commit -m "test(db): add failing test for cluster cascade delete"
    ```

#### **Step 2: GREEN — Implement Cascade-Delete Fix**

1.  **Modify Schema**: Open `prisma/schema.prisma`. In the `GlycemicEventCluster` model, update the `journal` relation to add `onDelete: Cascade`.

    ```prisma
    // file: prisma/schema.prisma
    // ...
    model GlycemicEventCluster {
      id                  String    @id @default(cuid())
      journalId           String
      // This is the line to change
      journal             Journal   @relation(fields: [journalId], references: [id], onDelete: Cascade)

      // ... rest of the model
    }
    // ...
    ```

2.  **Create Migration**: Run the Prisma migrate command. This applies the schema change to your development database and creates a new migration file.
    ```bash
    npx prisma migrate dev --name fix-cluster-cascade-delete
    ```
3.  **Verify Success**: Run `npm test`. The `privacy.test.ts` suite should now fully pass. This is our **GREEN** state.
4.  **Commit**:
    ```bash
    git add prisma/
    git commit -m "fix(db): P4_T1 ensure cascading deletes on GlycemicEventCluster"
    ```

#### **Step 3: RED — Write Failing Authorization Tests**

1.  **Modify Test Files**: Add the new `it` blocks for the `403 Forbidden` checks and the `302 redirect` check to `tests/integration/user.test.ts` and `tests/integration/journals.test.ts` as specified in the test plan.
2.  **Verify Failure**: Run `npm test`. The new tests will fail. The `403` tests will fail because the old middleware will `redirect` instead of returning a `403`. The `302` redirect test will also fail for the same reason (it will redirect to `/agreements` instead of `/setup-account`). This is our **RED** state.
3.  **Commit**:
    ```bash
    git add tests/integration/user.test.ts tests/integration/journals.test.ts
    git commit -m "test(security): add failing tests for refactored authz middleware"
    ```

#### **Step 4: GREEN — Refactor and Implement Authorization Middleware**

1.  **Create `enforceAgreements.ts`**: Create a new file at `src/middleware/enforceAgreements.ts`. This middleware will be our strict API gate.

    ```typescript
    // file: src/middleware/enforceAgreements.ts
    import { Request, Response, NextFunction } from "express";

    /**
     * This middleware acts as a strict API authorization gate.
     * It checks if the authenticated user has the 'agreementsSigned' flag set to true.
     * If not, it terminates the request with a 403 Forbidden error.
     */
    export function enforceAgreements(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      if (req.user && req.user.agreementsSigned) {
        return next();
      }
      return res.status(403).json({
        error: "User has not signed the required agreements.",
        code: "AGREEMENTS_NOT_SIGNED",
      });
    }
    ```

2.  **Rename and Refactor `enforceOnboarding.ts`**:
    - First, rename the file `src/middleware/enforceOnboarding.ts` to `src/middleware/enforceAccountSetup.ts`.
    - Then, update its contents to remove the agreement check, simplifying its responsibility.

    ```typescript
    // file: src/middleware/enforceAccountSetup.ts
    import { Request, Response, NextFunction } from "express";
    import { prisma } from "../lib/prisma.js";

    /**
     * This middleware handles UI flow for onboarding.
     * It checks if a user has completed their initial account setup (by checking for nightscoutUrl).
     * If not, it redirects them to the setup page.
     * This should run AFTER the enforceAgreements middleware.
     */
    export async function enforceAccountSetup(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized." });
      }

      // The check for agreementsSigned is now handled by the 'enforceAgreements' middleware.
      // This middleware's only job is to check for account setup completion.
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { nightscoutUrl: true },
      });

      if (user && !user.nightscoutUrl) {
        return res.redirect("/setup-account");
      }

      next();
    }
    ```

3.  **Apply New Middleware Chain**:
    - Modify `src/index.ts` to import and use the new middlewares in the correct order.

    ```typescript
    // file: src/index.ts
    // ...
    import { protect } from "./middleware/auth.js";
    import { enforceAgreements } from "./middleware/enforceAgreements.js";
    import { enforceAccountSetup } from "./middleware/enforceAccountSetup.js"; // Updated import

    // ...

    // Apply the full, secure middleware chain to the journals API
    app.use(
      "/api/journals",
      protect,
      enforceAgreements, // First, authorize API access
      enforceAccountSetup, // Then, handle UI flow
      csrfProtection,
      journalRoutes,
    );

    // ...

    // Update the dashboard route as well
    app.get(
      "/dashboard",
      protect,
      enforceAgreements,
      enforceAccountSetup,
      (req, res) => {
        res.send(`Welcome, ${escapeHtml(req.user!.email)}!`);
      },
    );

    // ...
    ```

    - Modify `src/routes/user.ts` to protect the settings route.

    ```typescript
    // file: src/routes/user.ts
    import { Router } from "express";
    import { prisma } from "../lib/prisma.js";
    import { protect } from "../middleware/auth.js";
    import { enforceAgreements } from "../middleware/enforceAgreements.js"; // Import it
    // ... other imports

    const router = Router();

    router.put(
      "/settings",
      protect,
      enforceAgreements,
      settingsLimiter,
      async (req, res) => {
        // ... route handler logic remains the same
      },
    );

    export default router;
    ```

4.  **Verify Success**: Run `npm test`. All tests, including the new authorization tests, should now pass. This is our **GREEN** state.
5.  **Commit**:
    ```bash
    git mv src/middleware/enforceOnboarding.ts src/middleware/enforceAccountSetup.ts
    git add .
    git commit -m "feat(security): P4_T3 refactor onboarding to enforceAgreements middleware"
    ```

#### **Step 5: REFACTOR — Final Review**

1.  Review all changed files. The primary refactor—splitting one middleware into two with clear responsibilities—has already been completed.
2.  Run `npm run lint` and `npm run prettier` to ensure all code conforms to the project's style guidelines. The task is now complete and adheres to a higher security standard.
