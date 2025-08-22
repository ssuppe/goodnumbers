# Implementation Plan: Phase 2, Task 3 - User Settings API

**Author:** Tech Lead
**Date:** 2025-08-17
**Task:** [Phase 2, Task 3: Implement User Settings API](../IMPLEMENTATION_PLAN.md)
**Related Docs:** [Technical Specification](../../TECHNICAL_SPECIFICATION.md), [Development Process](../../DEVELOPMENT_PROCESS.md)

## 1. Overview & Goal

Welcome to your next task! The goal is to build the backend API endpoint that allows a logged-in user to securely save their settings. This is a critical piece of the "Setup Account" flow described in the PRD and is essential for connecting a user's account to their Nightscout data source.

This task involves creating a new authenticated `PUT` endpoint at `/api/user/settings`. You will implement input validation using `zod`, use our existing encryption utility to protect sensitive credentials, and write comprehensive integration tests to ensure the endpoint is secure and functions correctly.

This document will guide you through every step, from creating the GitHub issue to submitting the final Pull Request. We will follow a **Test-Driven Development (TDD)** approach. Please read each step carefully.

### Security & Privacy Review: `PHASE2_TASK3.md`

Overall, this is an exceptionally well-written and thorough implementation plan. The adoption of Test-Driven Development (TDD), robust input validation with `zod`, and adherence to the technical specification's encryption requirements are all best practices.

However, I have identified one high-severity security concern and a few additional recommendations for improvement to further harden the application and provide a better learning experience for the junior engineer.

### Concerns and Recommendations

#### Concern #1: Information Disclosure in API Response (High Severity)

- **The Issue:** The proposed implementation for the `PUT /api/user/settings` endpoint in `goodnumbers/src/routes/user.ts` returns the encrypted `nightscoutUrl` back to the client in the API response. The comment in the code, `// Returning the encrypted URL is acceptable`, is incorrect.
- **The Risk:** This is a form of information disclosure. While the data is encrypted, leaking ciphertext violates the **Principle of Least Privilege**. An API should never return more data than is absolutely necessary for the client's next action. Exposing the ciphertext provides an attacker who may have compromised a user's session with data that could potentially be used in other attacks, especially if the encryption key is ever compromised or found to be weak. There is no functional reason for the client to receive this encrypted value back after a successful update.
- **The Recommendation:**
  1.  Modify the `select` clause in the `prisma.user.update` query within `goodnumbers/src/routes/user.ts` to **exclude** the `nightscoutUrl` field. The response should only confirm success and return non-sensitive data like `id`, `email`, and the updated `preferredUnits`.
  2.  Update the corresponding integration test in `goodnumbers/tests/integration/user.test.ts` to explicitly assert that `response.body.nightscoutUrl` is `undefined`, just as it currently does for `nightscoutToken`. This ensures our tests enforce our security policy.

#### Concern #2: Lack of Defensive Coding Against Null Assertions (Low Severity / Best Practice)

- **The Issue:** In `goodnumbers/src/routes/user.ts`, the code `const userId = req.auth!.user!.id!;` uses the non-null assertion operator (`!`). This tells the TypeScript compiler to trust that these properties exist.
- **The Risk:** While the `protect` middleware should ensure `req.auth` is populated, relying on the `!` operator can make code brittle. If a developer accidentally uses this route handler in the future without the `protect` middleware, the application will crash with a runtime error. This is a minor risk but presents a good teaching opportunity for building more resilient, defensive code.
- **The Recommendation:**
  1.  Add a runtime check for the `userId` in `goodnumbers/src/routes/user.ts` immediately after the `protect` middleware. This creates a stronger guarantee and provides a more graceful failure mode. While somewhat redundant given the middleware, it's a powerful defensive programming pattern.
  2.  If `userId` is not found, the handler should log a server-side error (indicating a programming mistake, e.g., missing middleware) and return a generic 500 Internal Server Error.

#### Concern #3: Potential for PII Leakage in Global Error Handler (Medium Severity / Best Practice)

- **The Issue:** The proposed `goodnumbers/src/index.ts` file includes a global error handler that logs the full error stack: `console.error(err.stack);`.
- **The Risk:** In a production environment, error objects (especially from the database or other libraries) can sometimes contain sensitive user data within their messages or properties. Logging the entire raw error stack to standard output could inadvertently expose Personally Identifiable Information (PII) or other sensitive details in your server logs.
- **The Recommendation:**
  1.  Modify the global error handler in `goodnumbers/src/index.ts` to be more cautious. For a production environment, it's better to use a structured logger (like Pino or Winston) that can sanitize output. For this task, a simple improvement is to log a more generic message along with the error's message property, but to be mindful that even `err.message` could contain PII. The key is to instill the habit of never logging raw error objects directly in a production context.

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
  --title "feat(api): P2_T3 implement endpoint for user settings" \
  --body "### Task Description
This task implements Phase 2, Task 3 from the implementation plan.
It involves:
- Creating a new `PUT /api/user/settings` endpoint.
- Adding a `protect` middleware to ensure the endpoint is only accessible to authenticated users.
- Using `zod` to validate the request body (`nightscoutUrl`, `nightscoutToken`, `preferredUnits`).
- Using the `encryption` utility to securely store Nightscout credentials in the database.
- Writing integration tests using `supertest` to verify all functionality, including success cases, auth failures, and validation errors.

**Reference:** `docs/eng/PHASE2_TASK3.md`"
```

The `gh` tool will output the number of the newly created issue. Make a note of it. We will use `#YY` as a placeholder for this number in the rest of the guide.

### Step 2: Create a New Feature Branch

Now, from the up-to-date `develop` branch, create a dedicated branch for this task. Following our naming convention will help us understand the purpose of the branch at a glance.

```bash
# Make sure you are on the `develop` branch.
# Use the real issue number from the previous step.
git checkout -b feat/YY-user-settings-api
```

You are now on your feature branch and ready to start development.

### Step 3: Implementation (Test-Driven Development)

We will follow the "Red-Green-Refactor" cycle. We'll start by writing a test that defines what we want to build, watch it fail, then write the code to make it pass, and finally, improve our work.

#### Sub-step 3.1: The "Red" Phase - Write a Failing Test

Our first goal is to write a test for the functionality we intend to build. This test will fail because we haven't written any implementation code yet. This is the "Red" state.

We need to test an authenticated endpoint. To do this cleanly, we will first define a `protect` middleware. This middleware will be responsible for checking if a user is logged in. In our tests, we can then _mock_ this middleware to simulate a logged-in user without needing to perform a real login.

First, create the `protect` middleware file.

<!-- goodnumbers/src/middleware/auth.ts -->

```typescript
import { Request, Response, NextFunction } from "express";

/**
 * Middleware to protect routes that require authentication.
 * It checks for the presence of `req.auth.user.id`, which is populated
 * by the Auth.js session handler.
 */
export const protect = (req: Request, res: Response, next: NextFunction) => {
  // The Auth.js library should populate `req.auth` after a successful login.
  // We check for the user's session and ID here.
  if (!req.auth?.user?.id) {
    return res.status(401).json({ message: "Not authorized" });
  }

  // If the user is authenticated, proceed to the next middleware or route handler.
  next();
};
```

Now, create a new test file for our user-related API endpoints. We will add a test case for updating settings. Notice how we use `jest.mock` to replace our real `protect` middleware with a fake one for testing purposes. This gives us full control over the authentication check within our test environment.

<!-- goodnumbers/tests/integration/user.test.ts -->

```typescript
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import supertest from "supertest";
import express from "express";
import { PrismaClient, User } from "@prisma/client";
import { decrypt } from "../../src/lib/encryption"; // We will need this to verify encryption

// --- Mocking the authentication middleware ---
// We will store the mock user in a variable that our tests can control.
let mockUserForAuth: User | null = null;

// We use jest.mock to replace the real 'protect' middleware with a fake one.
jest.mock("../../src/middleware/auth", () => ({
  // The 'protect' export will now be this mock function.
  protect: jest.fn(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (mockUserForAuth) {
        // If a mock user is set, we attach it to the request object,
        // simulating a successful authentication.
        req.auth = {
          user: {
            id: mockUserForAuth.id,
            email: mockUserForAuth.email,
          },
        };
      } else {
        // If no mock user is set, we clear req.auth to simulate an unauthenticated user.
        req.auth = undefined;
      }
      next(); // Always call next() to proceed.
    }
  ),
}));

// We need to import the router *after* the mock has been defined.
// At this stage, the file doesn't exist yet, but we're planning ahead.
// import userRouter from '../../src/routes/user';

// Setup Express app for testing
const app = express();
app.use(express.json());
// app.use('/api/user', userRouter); // We will uncomment this once the router is created.

const prisma = new PrismaClient();
const request = supertest(app);

describe("User API", () => {
  // Clean up the database and reset the mock user before each test
  beforeEach(async () => {
    await prisma.journal.deleteMany();
    await prisma.user.deleteMany();
    mockUserForAuth = null;
  });

  describe("PUT /api/user/settings", () => {
    it("should return 404 because the endpoint does not exist yet", async () => {
      // 1. Arrange: Create a user in the database to act as our logged-in user.
      const user = await prisma.user.create({
        data: {
          email: "test@example.com",
          name: "Test User",
        },
      });
      mockUserForAuth = user; // Set this user for our mocked 'protect' middleware.

      const settingsPayload = {
        nightscoutUrl: "https://my-nightscout-site.com",
        nightscoutToken: "my-secret-token-123",
        preferredUnits: "MMOL",
      };

      // 2. Act: Make the API call to the endpoint that we will build.
      const response = await request
        .put("/api/user/settings")
        .send(settingsPayload);

      // 3. Assert: For now, we expect a 404 Not Found because the route is not defined.
      expect(response.status).toBe(404);
    });
  });
});
```

**Run the test and watch it fail.** Navigate to the `goodnumbers` directory and run the test command.

```bash
cd goodnumbers
npm test -- tests/integration/user.test.ts
```

The test will fail, but likely with a `TypeError` because we have commented out the router imports. The key takeaway is that the setup is not complete. Our next step is to make this test pass.

#### Sub-step 3.2: The "Green" Phase - Implement the Endpoint

Now, we'll write the code to make our test pass.

**1. Create a Shared Zod Schemas File**

It's good practice to keep our validation schemas organized in one place. Let's create a file for them.

<!-- goodnumbers/src/lib/schemas.ts -->

```typescript
import { z } from "zod";

/**
 * Zod schema for validating the user settings update payload.
 */
export const userSettingsSchema = z.object({
  // The Nightscout URL must be a valid URL string.
  nightscoutUrl: z.string().url({ message: "Invalid Nightscout URL format." }),

  // The token must be a non-empty string.
  nightscoutToken: z
    .string()
    .min(1, { message: "Nightscout token cannot be empty." }),

  // The preferred units must be one of the two allowed values.
  preferredUnits: z.enum(["MGDL", "MMOL"], {
    errorMap: () => ({
      message: "Preferred units must be either MGDL or MMOL.",
    }),
  }),
});
```

**2. Create the User API Router**

This file will contain the logic for our new endpoint. It will use the `protect` middleware, validate the input with our Zod schema, encrypt the sensitive data, and update the database.

<!-- goodnumbers/src/routes/user.ts -->

```typescript
import express from "express";
import { PrismaClient } from "@prisma/client";
import { userSettingsSchema } from "../lib/schemas";
import { encrypt } from "../lib/encryption";
import { protect } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * PUT /api/user/settings
 * Description: Updates the settings for the authenticated user.
 * Access: Private (requires authentication)
 */
router.put("/settings", protect, validateRequest(userSettingsSchema), async (req, res, next) => {
  try {
    // --- RECOMMENDATION: DEFENSIVE CODING ---
    // The `protect` middleware should guarantee that `req.auth.user.id` exists.
    // However, for maximum safety and to prevent future mistakes (e.g., a developer
    // accidentally using this handler without the middleware), we add a runtime check.
    // This avoids crashes and provides a clearer server-side error if something is misconfigured.
    const userId = req.auth?.user?.id;
    if (!userId) {
      console.error(
        "[FATAL] userId not found in request after protect middleware. This indicates a server misconfiguration."
      );
      return res.status(500).json({ message: "Internal server error." });
    }

    // The body is already validated by the middleware.
    const { nightscoutUrl, nightscoutToken, preferredUnits } = req.body;

    // 2. Encrypt the sensitive credentials before saving them.
    const encryptedUrl = encrypt(nightscoutUrl);
    const encryptedToken = encrypt(nightscoutToken);

    // 3. Update the user record in the database.
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        nightscoutUrl: encryptedUrl,
        nightscoutToken: encryptedToken,
        preferredUnits: preferredUnits,
      },
      // --- SECURITY FIX: PREVENT INFORMATION DISCLOSURE ---
      // We have modified the `select` clause to prevent leaking sensitive data.
      // NEVER return credentials or any representation of them (even encrypted) to the client.
      // The client only needs confirmation of success and any non-sensitive fields that changed.
      select: {
        id: true,
        email: true,
        preferredUnits: true,
        },
    });

    // 4. Return a 200 OK response with the safe, updated user data.
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in PUT /api/user/settings:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

export default router;
```

**3. Wire the New Router into the Main Server**

Now we need to tell our main Express application to use this new router.

<!-- goodnumbers/src/index.ts -->

```typescript
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ExpressAuth } from "@auth/express";
import { authConfig } from "./lib/auth.ts"; // Note: .ts extension for ESM

// Import the new user router
import userRouter from "./routes/user.ts";

const app = express();
const port = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "https://authjs.dev",
          "https://lh3.googleusercontent.com",
        ],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://oauth2.googleapis.com",
          "https://www.googleapis.com",
        ],
        formAction: ["'self'", "https://accounts.google.com"],
        frameSrc: ["'self'", "https://accounts.google.com"],
      },
    },
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --- Body Parser Middleware ---
// This is crucial for Express to be able to read req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Static Files ---
app.use(express.static("public"));

// --- Auth.js Middleware ---
app.use("/api/auth", ExpressAuth(authConfig));

// --- API Routes ---
// Use the new user router for all routes starting with /api/user
app.use("/api/user", userRouter);

// --- Health Check Endpoint ---
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// --- Global Error Handler ---
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction
  ) => {
    // --- RECOMMENDATION: SECURE LOGGING ---
    // In a production environment, never log the entire raw error object (`err`) or stack (`err.stack`),
    // as it may contain sensitive user data or system information. Use a structured,
    // production-ready logger (like Pino or Winston) that can sanitize output.
    // For now, we log a more controlled message.
    console.error("--- Global Error Handler Caught an Error ---");
    console.error(`Error Message: ${err.message}`);
    // For debugging, you might log the stack, but be aware of the risk of leaking PII.
    // console.error(`Stack: ${err.stack}`);

    // Always send a generic, non-revealing error message to the client.
    res.status(500).json({ message: "An internal server error occurred." });
  }
);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
```

**4. Update the Test File**

Now, let's update our test to reflect the desired "Green" state. We will uncomment the router imports and change our assertion to expect a `200 OK` status. We'll also query the database directly to verify that the data was saved correctly and, importantly, that it was encrypted.

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
    await prisma.journal.deleteMany(); // Cascade delete might handle this, but being explicit is safer
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
          preferredUnits: "MGDL", // Start with an initial value
        },
      });
      mockUserForAuth = user;

      const settingsPayload = {
        nightscoutUrl: "https://my-nightscout-site.com",
        nightscoutToken: "my-secret-token-123",
        preferredUnits: "MMOL", // Update to a new value
      };

      // Act
      const response = await request
        .put("/api/user/settings")
        .send(settingsPayload);

      // Assert - API response
      expect(response.status).toBe(200);
      expect(response.body.preferredUnits).toBe("MMOL");
      expect(response.body.id).toBe(user.id);

      // --- SECURITY TEST IMPROVEMENT ---
      // We must explicitly test that NEITHER the token NOR the URL are returned
      // in the response body. This test now enforces our security policy.
      expect(response.body.nightscoutToken).toBeUndefined();
      expect(response.body.nightscoutUrl).toBeUndefined();

      // Assert - Database state
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.preferredUnits).toBe("MMOL");

      // Verify that the credentials in the DB are encrypted
      expect(dbUser!.nightscoutUrl).not.toBe(settingsPayload.nightscoutUrl);
      expect(dbUser!.nightscoutToken).not.toBe(settingsPayload.nightscoutToken);

      // Decrypt the values from the DB to confirm they match the original payload
      expect(decrypt(dbUser!.nightscoutUrl!)).toBe(
        settingsPayload.nightscoutUrl
      );
      expect(decrypt(dbUser!.nightscoutToken!)).toBe(
        settingsPayload.nightscoutToken
      );
    });

    it("should return 401 Unauthorized if the user is not authenticated", async () => {
      // Arrange: No user is set for the mock middleware (mockUserForAuth is null)
      const settingsPayload = {
        nightscoutUrl: "https://my-nightscout-site.com",
        nightscoutToken: "my-secret-token-123",
        preferredUnits: "MMOL",
      };

      // Act
      const response = await request
        .put("/api/user/settings")
        .send(settingsPayload);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Not authorized");
    });

    it("should return 400 Bad Request for invalid URL", async () => {
      // Arrange
      const user = await prisma.user.create({
        data: { email: "test2@example.com" },
      });
      mockUserForAuth = user;
      const invalidPayload = {
        nightscoutUrl: "not-a-valid-url", // Invalid data
        nightscoutToken: "a-token",
        preferredUnits: "MGDL",
      };

      // Act
      const response = await request
        .put("/api/user/settings")
        .send(invalidPayload);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.errors.nightscoutUrl).toBeDefined();
    });

    it("should return 400 Bad Request for invalid preferredUnits enum", async () => {
      // Arrange
      const user = await prisma.user.create({
        data: { email: "test3@example.com" },
      });
      mockUserForAuth = user;
      const invalidPayload = {
        nightscoutUrl: "https://a-valid-url.com",
        nightscoutToken: "a-token",
        preferredUnits: "INVALID_UNIT", // Invalid data
      };

      // Act
      const response = await request
        .put("/api/user/settings")
        .send(invalidPayload);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.errors.preferredUnits).toBeDefined();
    });
  });
});
```

Now, run the test again. It should pass!

```bash
cd goodnumbers
npm test -- tests/integration/user.test.ts
```

All tests should pass. Our code is now robust and well-tested.

### Step 4: Commit Your Work

Now, let's commit these changes to your feature branch. We'll create a single, clean commit that summarizes the work you've done.

```bash
# Navigate back to the workspace root
cd ..

# Add all the new and modified files to the staging area
git add .

# Commit the changes using our Conventional Commit standard
git commit -m "feat(api): P2_T3 implement endpoint for user settings" -m "This commit introduces the PUT /api/user/settings endpoint, allowing authenticated users to update their Nightscout credentials and preferred glucose units. It adds a reusable 'protect' middleware for securing routes, validates input using Zod, and encrypts sensitive credentials before storing them in the database. The feature is covered by integration tests for success, unauthorized access, and invalid input scenarios."
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
git push origin feat/YY-user-settings-api

# Create the Pull Request using the gh CLI, targeting the `develop` branch
gh pr create \
 --base develop \
 --title "feat(api): P2_T3 implement endpoint for user settings" \
 --body "### Description
This PR implements the `PUT /api/user/settings` endpoint as defined in Phase 2, Task 3.

- A new reusable `protect` middleware is introduced in `src/middleware/auth.ts` to handle authentication checks for protected routes.
- The endpoint validates the request body using a Zod schema from `src/lib/schemas.ts`.
- It securely encrypts the `nightscoutUrl` and `nightscoutToken` using the existing `encryption` utility before persisting them to the database.
- The entire feature is covered by integration tests in `tests/integration/user.test.ts`, which verify:
  - Successful updates for an authenticated user.
  - Correct data encryption in the database.
  - Rejection of requests from unauthenticated users (401).
  - Rejection of requests with invalid data (400).

**Closes #YY** (Replace with the actual issue number you created)

### How to Test

1.  Check out this branch.
2.  Run `cd goodnumbers && npm install`.
3.  Ensure your `.env` file has an `ENCRYPTION_KEY`.
4.  Run `npx prisma migrate dev` to make sure your database is up to date.
5.  Run the new test suite specifically: `npm test -- tests/integration/user.test.ts`.
6.  **Verify all tests pass.**
7.  (Optional Manual Test) Run the server (`npm run dev`) and use a tool like Postman or Insomnia to make a `PUT` request to `http://localhost:3000/api/user/settings`. You will not be able to test the authenticated path manually, but you can verify that you get a 401 Unauthorized response, which is the correct behavior for an unauthenticated request."
```

Once the PR is created, please notify the team. Excellent work!
