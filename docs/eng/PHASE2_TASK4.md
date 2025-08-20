# Implementation Plan: Phase 2, Task 4 - Regenerate RSS Token API

**Author:** Tech Lead
**Date:** 2025-08-20
**Task:** [Phase 2, Task 4: Implement RSS Token Regeneration API](../IMPLEMENTATION_PLAN.md)
**Related Docs:** [Technical Specification](../../TECHNICAL_SPECIFICATION.md), [Development Process](../../DEVELOPMENT_PROCESS.md)

## 1. Overview & Goal

Welcome to your next task! The goal is to build the backend API endpoint that allows a logged-in user to regenerate their private podcast RSS token. This is an important security and privacy feature, as it gives users control to invalidate an old feed URL if they suspect it has been compromised or if they simply wish to refresh it.

This task involves creating a new authenticated `POST` endpoint at `/api/user/regenerate-rss-token`. You will use our existing `protect` middleware, apply a specific rate-limiter to prevent abuse, install a new dependency for generating secure unique IDs, and write a focused integration test to prove the endpoint works correctly and securely.

This document will guide you through every step, following our standard **Test-Driven Development (TDD)** approach.

## 2. Step-by-Step Implementation Guide

### Step 0: Prepare Your Local Environment

First, ensure your local environment is synchronized with the main development branch. This is a critical first step to prevent merge conflicts later.

```bash
# Navigate to the project root
cd goodnumbers-workspace

# Switch to the main development branch
git checkout develop

# Pull the latest changes from the remote repository
git pull origin develop
```

### Step 1: Create a GitHub Issue

Every task must be tracked with a GitHub issue. This provides visibility for the team and a central place for any task-related discussions.

Run the following command from your terminal (ensure you have the `gh` CLI tool installed and authenticated). This will create the issue for our task.

```bash
# Remember to run this from the goodnumbers-workspace directory
gh issue create \
  --title "feat(api): P2_T4 implement RSS token regeneration endpoint" \
  --body "### Task Description
This task implements Phase 2, Task 4 from the implementation plan.
It involves:
- Creating a new `POST /api/user/regenerate-rss-token` endpoint.
- Securing the endpoint with the `protect` middleware.
- Applying a specific rate limit to prevent abuse.
- Using the secure `@paralleldrive/cuid2` library to generate a new unique `rssToken`.
- Updating the user's record in the database.
- Returning the new token to the client.
- Writing an integration test to verify the functionality and security of the endpoint.

**Reference:** `docs/eng/PHASE2_TASK4.md`"
```

The `gh` tool will output the number of the newly created issue. Make a note of it. We will use `#ZZ` as a placeholder for this number in the rest of the guide.

### Step 2: Create a New Feature Branch

Now, from the up-to-date `develop` branch, create a dedicated branch for this task. Following our naming convention will help us understand the purpose of the branch at a glance.

```bash
# Make sure you are on the `develop` branch.
# Use the real issue number from the previous step.
git checkout -b feat/ZZ-rss-token-api
```

You are now on your feature branch and ready to start development.

### Step 3: Implementation (Test-Driven Development)

We will follow the "Red-Green-Refactor" cycle. We'll start by writing a test for the functionality we want to build, watch it fail, then write the code to make it pass.

#### Sub-step 3.1: Install Secure Dependency

For this task, we need a library to generate secure, unique identifiers. The original `cuid` library is no longer considered secure. We will use its official successor, `@paralleldrive/cuid2`.

Run the following command from within the `goodnumbers/` directory:

```bash
# Navigate to the correct directory first
cd goodnumbers

# Install the secure CUIDv2 library
npm install @paralleldrive/cuid2

# Navigate back to the root
cd ..
```

#### Sub-step 3.2: The "Red" Phase - Write a Failing Test

Our first development goal is to add a new test to `goodnumbers/tests/integration/user.test.ts` that defines how the new endpoint should behave. This test will fail at first because we haven't written any implementation code yet.

Open the existing user test file and add a new `describe` block for the `POST /api/user/regenerate-rss-token` endpoint.

<!-- goodnumbers/tests/integration/user.test.ts -->

```typescript
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import supertest from "supertest";
import express from "express";
import { PrismaClient, User } from "@prisma/client";
import { decrypt } from "../../src/lib/encryption";

// --- Mocking the authentication middleware ---
let mockUserForAuth: User | null = null;

jest.mock("../../src/middleware/auth", () => ({
  protect: jest.fn(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (mockUserForAuth) {
        req.auth = {
          user: {
            id: mockUserForAuth.id,
            email: mockUserForAuth.email,
          },
        };
      } else {
        req.auth = undefined;
      }
      next();
    }
  ),
}));

// Import the router *after* the mock is defined.
import userRouter from "../../src/routes/user";

const app = express();
app.use(express.json());
app.use("/api/user", userRouter); // Wire up the router for testing

const prisma = new PrismaClient();
const request = supertest(app);

describe("User API", () => {
  beforeEach(async () => {
    await prisma.journal.deleteMany();
    await prisma.user.deleteMany();
    mockUserForAuth = null;
  });

  describe("PUT /api/user/settings", () => {
    it("should update user settings for an authenticated user and not return sensitive data", async () => {
      // Arrange
      const user = await prisma.user.create({
        data: {
          email: "test@example.com",
          name: "Test User",
          preferredUnits: "MGDL",
        },
      });
      mockUserForAuth = user;

      const settingsPayload = {
        nightscoutUrl: "https://my-nightscout-site.com",
        nightscoutToken: "my-secret-token-123",
        preferredUnits: "MMOL",
      };

      // Act
      const response = await request
        .put("/api/user/settings")
        .send(settingsPayload);

      // Assert - API response
      expect(response.status).toBe(200);
      expect(response.body.preferredUnits).toBe("MMOL");
      expect(response.body.id).toBe(user.id);
      expect(response.body.nightscoutToken).toBeUndefined();
      expect(response.body.nightscoutUrl).toBeUndefined();

      // Assert - Database state
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.preferredUnits).toBe("MMOL");
      expect(decrypt(dbUser!.nightscoutUrl!)).toBe(
        settingsPayload.nightscoutUrl
      );
      expect(decrypt(dbUser!.nightscoutToken!)).toBe(
        settingsPayload.nightscoutToken
      );
    });

    // ... other tests for PUT /api/user/settings remain here ...
  });

  // --- NEW TEST SUITE FOR THIS TASK ---
  describe("POST /api/user/regenerate-rss-token", () => {
    it("should generate a new rssToken for an authenticated user", async () => {
      // 1. Arrange: Create a user with a known, initial rssToken.
      const user = await prisma.user.create({
        data: {
          email: "rss-user@example.com",
          name: "RSS User",
          rssToken: "initial_token_123", // The initial token
        },
      });
      mockUserForAuth = user; // Simulate this user being logged in.
      const originalToken = user.rssToken;

      // 2. Act: Call the new endpoint. No request body is needed.
      const response = await request.post("/api/user/regenerate-rss-token");

      // 3. Assert: Check the API response and the database state.
      // API Response Assertions
      expect(response.status).toBe(200);
      expect(response.body.rssToken).toBeDefined();
      expect(response.body.rssToken).not.toBe(originalToken); // Crucially, the token must have changed.

      // Database State Assertions
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.rssToken).not.toBe(originalToken); // The token in the DB must be new.
      expect(dbUser!.rssToken).toBe(response.body.rssToken); // The DB token must match the one returned to the client.
    });

    it("should return 401 Unauthorized if the user is not authenticated", async () => {
      // 1. Arrange: No user is set for the mock middleware (mockUserForAuth remains null).

      // 2. Act: Call the endpoint.
      const response = await request.post("/api/user/regenerate-rss-token");

      // 3. Assert: We expect an authorization failure.
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Not authorized");
    });
  });
});
```

**Run the test and watch it fail.** Navigate to the `goodnumbers` directory and run the test command.

```bash
cd goodnumbers
npm test -- tests/integration/user.test.ts
```

The test will fail with a `404 Not Found` error because the route `/api/user/regenerate-rss-token` doesn't exist yet. This is our "Red" state.

#### Sub-step 3.3: The "Green" Phase - Implement the Endpoint

Now, we'll write the minimum amount of code in `goodnumbers/src/routes/user.ts` to make our new test pass.

<!-- goodnumbers/src/routes/user.ts -->

```typescript
import express from "express";
import { PrismaClient } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { userSettingsSchema } from "../lib/schemas";
import { encrypt } from "../lib/encryption";
import { protect } from "../middleware/auth";
// SECURE: Import from the official, secure 'cuid2' package
import { createId } from "@paralleldrive/cuid2";

const router = express.Router();
const prisma = new PrismaClient();

// --- SECURITY: A stricter rate limiter for sensitive operations ---
// This prevents an attacker from spamming the token regeneration endpoint
// to cause a denial-of-service for a legitimate user's podcast feed.
const sensitiveOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * PUT /api/user/settings
 * Description: Updates the settings for the authenticated user.
 * Access: Private (requires authentication)
 */
router.put("/settings", protect, async (req, res) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) {
      console.error(
        "[FATAL] userId not found in request after protect middleware. This indicates a server misconfiguration."
      );
      return res.status(500).json({ message: "Internal server error." });
    }

    const validation = userSettingsSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid request body.",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { nightscoutUrl, nightscoutToken, preferredUnits } = validation.data;

    const encryptedUrl = encrypt(nightscoutUrl);
    const encryptedToken = encrypt(nightscoutToken);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        nightscoutUrl: encryptedUrl,
        nightscoutToken: encryptedToken,
        preferredUnits: preferredUnits,
      },
      select: {
        id: true,
        email: true,
        preferredUnits: true,
      },
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    // SECURITY: Log only the error message, not the entire error object,
    // to prevent leaking sensitive information in production logs.
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in PUT /api/user/settings:", message);
    res.status(500).json({ message: "Internal server error." });
  }
});

/**
 * POST /api/user/regenerate-rss-token
 * Description: Generates a new, unique RSS token for the user, invalidating the old one.
 * Access: Private (requires authentication)
 */
router.post(
  "/regenerate-rss-token",
  protect,
  sensitiveOperationLimiter,
  async (req, res) => {
    try {
      const userId = req.auth?.user?.id;
      if (!userId) {
        console.error(
          "[FATAL] userId not found in request after protect middleware. This indicates a server misconfiguration."
        );
        return res.status(500).json({ message: "Internal server error." });
      }

      // SECURE: Generate a new unique token using the official cuid2 library.
      const newToken = createId();

      await prisma.user.update({
        where: { id: userId },
        data: {
          rssToken: newToken,
        },
      });

      res.status(200).json({ rssToken: newToken });
    } catch (error) {
      // SECURITY: Log only the error message, not the entire error object.
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      console.error("Error in POST /api/user/regenerate-rss-token:", message);
      res.status(500).json({ message: "Internal server error." });
    }
  }
);

export default router;
```

**Run the test again.** It should now pass!

```bash
cd goodnumbers
npm test -- tests/integration/user.test.ts
```

All tests in the file should now pass. You have successfully implemented and verified the new feature.

### Step 4: Commit Your Work

Now, let's commit these changes to your feature branch. We'll create a single, clean commit that summarizes the work you've done.

```bash
# Navigate back to the workspace root
cd ..

# Add all the new and modified files to the staging area
git add .

# Commit the changes using our Conventional Commit standard
git commit -m "feat(api): P2_T4 implement RSS token regeneration endpoint" -m "This commit introduces the POST /api/user/regenerate-rss-token endpoint. It allows an authenticated user to generate a new private RSS token using the secure '@paralleldrive/cuid2' library. The feature is secured by the 'protect' middleware, includes a specific rate-limiter to prevent abuse, and is covered by an integration test."
```

### Step 5: Final Quality & Security Checks

Before opening a Pull Request, it's mandatory to run our local quality gates from within the `goodnumbers` directory.

```bash
# Navigate into the project folder
cd goodnumbers

# Run the dependency audit to check for vulnerabilities
npm audit
```

If `npm audit` finds any high or critical vulnerabilities, they must be addressed before you proceed. If it's all clear, run our complete test suite to ensure your changes didn't break anything else.

```bash
# Run all automated tests
npm test
```

If all checks pass, you are ready to create the Pull Request.

```bash
# Navigate back to the workspace root
cd ..
```

### Step 6: Create the Pull Request

Push your branch to the remote repository and open a Pull Request (PR) to merge your work into the `develop` branch.

```bash
# Push your branch to the remote repository
git push origin feat/ZZ-rss-token-api

# Create the Pull Request using the gh CLI, targeting the `develop` branch
gh pr create \
 --base develop \
 --title "feat(api): P2_T4 implement RSS token regeneration endpoint" \
 --body "### Description
This PR implements the `POST /api/user/regenerate-rss-token` endpoint as defined in Phase 2, Task 4.

This allows an authenticated user to securely invalidate their old podcast RSS feed URL and receive a new one.

- The endpoint is protected by the existing `protect` middleware.
- A specific, stricter rate-limiter has been applied to this endpoint to prevent potential abuse (DoS).
- On a successful request, a new CUIDv2 is generated using the `@paralleldrive/cuid2` library and saved as the user's `rssToken` in the database.
- The new token is returned to the client.
- The feature is covered by an integration test in `tests/integration/user.test.ts`.

**Closes #ZZ** (Replace with the actual issue number you created)

### How to Test

1.  Check out this branch.
2.  Run `cd goodnumbers && npm install`.
3.  Run the test suite specifically for this feature: `npm test -- tests/integration/user.test.ts`.
4.  **Verify all tests pass.**"
```

Once the PR is created, please notify the team. Excellent work!
