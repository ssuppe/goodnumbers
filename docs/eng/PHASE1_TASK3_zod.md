# Engineering Task: P1_T3 - Implement Zod Validation and Global Error Handling

**Version:** 1.0
**Date:** 2025-08-19
**Author:** Dr. Gemini, Technical Lead

## 1. Overview & Goal

This document provides a detailed, step-by-step guide for completing the remaining items in **Phase 1, Task 3** of our `IMPLEMENTATION_PLAN.md`. The primary goal is to establish two critical, foundational patterns for our backend server:

1.  **Schema-Based Input Validation:** We will install the `zod` library and create a reusable Express middleware to validate all incoming API request bodies. This is a critical security measure to prevent data corruption and ensure that our API endpoints only process data in the exact shape and type they expect.
2.  **Global Error Handling:** We will implement a final, catch-all error handling middleware. This ensures that any unexpected errors in our application are handled gracefully and, most importantly, that we never leak sensitive information (like stack traces) to the client in a production environment.

By completing this task, you will have built a robust foundation that will make all future API development faster, safer, and more reliable.

## 2. Prerequisites

Before you begin, ensure you have the latest version of the `develop` branch checked out locally.

```bash
git checkout develop
git pull
```

## 3. Step-by-Step Implementation

We will follow the project's official `DEVELOPMENT_PROCESS.md` precisely. This includes creating a GitHub Issue to track our work and using a dedicated feature branch.

### Step 3.1: GitHub Issue and Branch Setup

First, create a GitHub issue for this task. This will be our central point for tracking progress and discussion.

```bash
# Run this from the project root directory
gh issue create --title "feat(server): P1_T3 Implement Zod validation and global error handling" --body "This task involves completing Phase 1, Task 3 by installing Zod, creating a reusable validation middleware, and implementing a global error handler as specified in docs/eng/PHASE1_TASK3_zod.md."
```

After the issue is created (let's assume it's issue #42 for this example), create a new feature branch from `develop`.

```bash
# The branch name follows the format: type/issue-number-short-description
git checkout -b feat/42-zod-error-handling
```

### Step 3.2: Install Zod Dependency

Navigate to the backend project directory and install the `zod` library.

```bash
cd goodnumbers
npm install zod
cd ..
```

### Step 3.3: Create the Reusable Validation Middleware

This is the core of our validation pattern. We will create a middleware that can be configured with any Zod schema.

Create a new file at `goodnumbers/src/middleware/validateRequest.ts` and add the following content:

```typescript
// goodnumbers/src/middleware/validateRequest.ts

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * This is a higher-order function that takes a Zod schema and returns an Express middleware.
 * The returned middleware will validate the request body against the provided schema.
 *
 * @param schema - The Zod schema to validate the request body against.
 * @returns An Express middleware function.
 */
export const validateRequest = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // The .parse() method will throw a ZodError if validation fails.
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // If validation is successful, call the next middleware in the stack.
      next();
    } catch (error) {
      // We check if the error is an instance of ZodError.
      if (error instanceof ZodError) {
        // If it is, we send a 400 Bad Request response with the structured error details.
        // This provides clear feedback to the client about what was wrong with the request.
        return res.status(400).json({
          error: 'Validation failed',
          details: error.flatten().fieldErrors,
        });
      }
      // If the error is not a ZodError, it's an unexpected server error.
      // We pass it to the next middleware, which will be our global error handler.
      next(error);
    }
  };
};
```

### Step 3.4: Create the Global Error Handler

This middleware will catch any errors that occur in our application, log them, and send a safe, generic response to the client.

Create a new file at `goodnumbers/src/middleware/errorHandler.ts` and add the following content:

```typescript
// goodnumbers/src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';

/**
 * A global error handling middleware for Express.
 * This middleware MUST have 4 arguments to be recognized by Express as an error handler.
 *
 * @param err - The error object.
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next function.
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log the full error to the console for debugging purposes.
  // In a real production environment, you would use a dedicated logging service.
  console.error(err);

  // Check the environment. In production, we don't want to send sensitive
  // information like a stack trace to the client.
  if (process.env.NODE_ENV === 'production') {
    // Send a generic, non-revealing error message.
    return res.status(500).json({ error: 'An internal server error occurred.' });
  } else {
    // In development, send a more detailed error message including the stack trace.
    return res.status(500).json({
      error: 'An internal server error occurred.',
      message: err.message,
      stack: err.stack,
    });
  }
};
```

### Step 3.5: Integrate into the Server (`index.ts`)

Now, let's wire up the new global error handler in our main server file.

Open `goodnumbers/src/index.ts` and add the import for `errorHandler`. Then, add it as the **very last middleware** used by the app. This is critical for it to function correctly.

```typescript
// goodnumbers/src/index.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler'; // <-- IMPORT HERE

const app = express();
const PORT = process.env.PORT || 3000;

// ... (all other middlewares like helmet, rateLimit, express.json)

// --- Core Middlewares ---
app.use(express.json());

// Define the /health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// --- Global Error Handler ---
// This MUST be the last middleware added to the app.
app.use(errorHandler); // <-- USE IT HERE

// Only start listening if the file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export the app for testing purposes
export { app };
```

### Step 3.6: Test-Driven Development (TDD) - Creating a Test Case

To prove our new pattern works, we will create a temporary test endpoint and write integration tests for it.

**1. (RED) Write Failing Tests:**

Open `goodnumbers/tests/integration/server.test.ts` and add a new `describe` block with tests for our validation logic.

```typescript
// goodnumbers/tests/integration/server.test.ts
// ... (existing imports)
import request from 'supertest';
import { app } from '../../src/index';

// ... (existing describe blocks for /health)

describe('POST /api/test-validation', () => {
  it('should return 400 if the name is not a string', async () => {
    const response = await request(app)
      .post('/api/test-validation')
      .send({ name: 123, value: 100 }); // Invalid name

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details.body.name).toContain('Expected string, received number');
  });

  it('should return 400 if the value is less than 1', async () => {
    const response = await request(app)
      .post('/api/test-validation')
      .send({ name: 'test', value: 0 }); // Invalid value

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details.body.value).toContain('Number must be greater than or equal to 1');
  });

  // At this point, running this test will fail because the endpoint doesn't exist.
});
```

**2. (GREEN) Implement to Make Tests Pass:**

First, create a file to hold our Zod schemas.
Create `goodnumbers/src/lib/schemas.ts`:

```typescript
// goodnumbers/src/lib/schemas.ts
import { z } from 'zod';

export const testValidationSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'Name is required',
    }),
    value: z.number().min(1),
  }),
});
```

Now, modify `goodnumbers/src/index.ts` to add the temporary endpoint, using our new `validateRequest` middleware.

```typescript
// goodnumbers/src/index.ts
// ... (other imports)
import { validateRequest } from './middleware/validateRequest';
import { testValidationSchema } from './lib/schemas';

// ... (after the /health endpoint)

// Temporary endpoint to test our validation middleware
app.post(
  '/api/test-validation',
  validateRequest(testValidationSchema),
  (req, res) => {
    // If we get here, it means validation passed.
    res.status(200).json({ message: 'Validation successful!' });
  }
);

// ... (global error handler)
```

Now, run the tests. They should all pass!

**3. (REFACTOR) Add a "Happy Path" Test:**

Let's add one more test to ensure valid data gets a `200 OK` response. Add this inside the `describe` block in `server.test.ts`:

```typescript
// goodnumbers/tests/integration/server.test.ts

// ... (inside the describe block for POST /api/test-validation)
it('should return 200 if the payload is valid', async () => {
  const response = await request(app)
    .post('/api/test-validation')
    .send({ name: 'Valid Name', value: 50 });

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('Validation successful!');
});
```

Run the tests again to confirm everything is working as expected.

### Step 3.7: Cleanup

The `test-validation` endpoint was only for proving our pattern works. Now that it does, we should remove it to keep our main server file clean.

1.  In `goodnumbers/src/index.ts`, delete the entire `app.post('/api/test-validation', ...)` block.
2.  In `goodnumbers/tests/integration/server.test.ts`, delete the entire `describe('POST /api/test-validation', ...)` block.
3.  You can leave the `goodnumbers/src/lib/schemas.ts` file with the `testValidationSchema` as an example for future reference, or delete it. For this exercise, let's leave it.

## 4. Committing the Work

You have now successfully implemented the new patterns. Commit your work using the Conventional Commit standard.

```bash
git add .
git commit -m "feat(server): P1_T3 add zod validation and global error handling" -m "This commit introduces a reusable middleware for Zod-based request validation and a global error handler for the Express server. It establishes the core pattern for secure and robust API development."
```

## 5. Creating the Pull Request

Push your branch and create a Pull Request targeting `develop`.

```bash
git push --set-upstream origin feat/42-zod-error-handling
gh pr create --base develop --title "feat(server): P1_T3 Implement Zod validation and global error handling" --body "Closes #42. This PR establishes the foundational patterns for Zod validation and global error handling as outlined in the implementation plan. The new `validateRequest` middleware can be used for all future endpoints."
```

Be sure to fill out the "How to Test" section in the PR description, explaining that the new patterns are in place and can be verified by reviewing the new middleware files.

## 6. Definition of Done

- [x] The `zod` package is added as a dependency.
- [x] The reusable validation middleware exists at `goodnumbers/src/middleware/validateRequest.ts`.
- [x] The global error handler exists at `goodnumbers/src/middleware/errorHandler.ts`.
- [x] The global error handler is correctly integrated into `goodnumbers/src/index.ts`.
- [x] The patterns have been verified with temporary integration tests, which have since been cleaned up.
- [x] The code is committed with a compliant Conventional Commit message.
- [x] A Pull Request has been opened against the `develop` branch.
