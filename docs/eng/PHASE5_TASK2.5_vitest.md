Of course. Here is the complete, final, and highly detailed engineering plan. It incorporates all of our refinements, including the path alias, the targeted `prismock` strategy, correct variable scoping, and specific instructions for every single test file.

This document is designed to be a comprehensive guide that a junior engineer can follow step-by-step to successfully complete the migration.

---

# Goodnumbers — `todo.md` (Final Version)

## TL;DR

Migrate the backend test runner from Jest to Vitest and integrate the `prismock` library. This will resolve ESM compatibility issues, eliminate flaky tests caused by database race conditions, and significantly improve the speed and reliability of the test suite by using an in-memory database for most tests.

## Invariants (do not change)

- **Data Segregation**: A user can **only** access data they own. All database queries for specific resources must include a `WHERE userId = '...'` clause.
- **Data Privacy**: Deleting a parent resource (like a `User` or `Journal`) **must** trigger the deletion of all its child data to prevent orphaned, sensitive information.
- **Server-Side Authorization**: The server **must not** trust the client. All access-control decisions must be made and enforced on the server.

## Assumptions & Scope

- **Assumption**: All tasks up to and including Phase 5, Task 2 (`feat/phase5-task2-shared-schemas`) are complete and have been merged into the `phase5develop` branch.
- **Assumption**: The primary motivation is to fix test flakiness and improve test performance by moving from a real database in tests to an in-memory mock.
- **Scope**: This task is strictly limited to the `backend` workspace. It involves swapping testing dependencies, creating new configuration files for Vitest, and refactoring existing test files to use the Vitest API and `prismock`.
- **Out of Scope**: This task does not involve adding new application features, writing new feature tests, or modifying any code in the `frontend` or `packages` workspaces.

## Objectives

1.  **Replace Test Runner**: Successfully remove all Jest-related dependencies and configuration from the `backend` workspace and replace them with Vitest.
2.  **Eliminate Flakiness**: Integrate `prismock` to mock the Prisma client in API-level integration tests, ensuring each test runs in a perfectly isolated, in-memory database.
3.  **Guarantee No Regressions**: Ensure 100% of the tests pass under the new Vitest and Prismock setup.
4.  **Improve Maintainability**: Introduce a new `@src` path alias to make test file imports cleaner and more resilient to refactoring.
5.  **Preserve Confidence**: Retain a small number of critical tests (`database.test.ts`, `privacy.test.ts`) that run against a real test database to verify fundamental connectivity and schema behavior.

## Acceptance Gates

1.  The command `npm test -w backend`, run from the project root, **must pass** all tests using the Vitest runner.
2.  The files `backend/tests/integration/database.test.ts` and `backend/tests/integration/privacy.test.ts` **must** still pass, confirming they are correctly connecting to and testing against the real test database.
3.  The test execution time for the API tests (e.g., `journals.test.ts`) should be noticeably faster.
4.  The files `backend/jest.config.cjs` and `backend/jest.setup.js` **must be deleted**.

## In-depth engineering plan

### Step 1: Update Dependencies

1.  **Install Vitest & Prismock, Uninstall Jest**: Run the following commands from the **project root**. This adds the new testing tools and removes the old ones.

    ```bash
    npm install -D vitest @vitest/coverage-v8 jsdom prismock -w backend
    npm uninstall jest ts-jest @types/jest -w backend
    ```

### Step 2: Establish Path Aliases and New Configuration

This step makes our code cleaner and sets up the foundation for Vitest.

1.  **Configure TypeScript Path Alias**: Edit `backend/tsconfig.json`. We need to tell the TypeScript compiler what `@src` means so your code editor can understand the imports.

    ```json
    // file: backend/tsconfig.json
    {
      "compilerOptions": {
        "target": "ESNext",
        "module": "nodenext",
        "rootDir": "./src",
        "outDir": "./dist",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "isolatedModules": true,
        "moduleResolution": "NodeNext",
        "baseUrl": ".",
        "paths": {
          "@src/*": ["src/*"],
          "ioredis": ["./node_modules/ioredis/dist/index.d.ts"]
        }
      },
      "include": ["src/**/*"],
      "exclude": ["node_modules"]
    }
    ```

2.  **Delete Old Jest Config**:

    ```bash
    rm backend/jest.config.cjs backend/jest.setup.js
    ```

3.  **Create `vitest.config.ts`**: Create the new configuration file in the `backend/` directory. This file tells Vitest how to run our tests and, crucially, contains the _runtime_ version of our path alias.

    ```typescript
    // file: backend/vitest.config.ts
    /// <reference types="vitest" />
    import { defineConfig } from "vitest/config";
    import path from "node:path";

    export default defineConfig({
      test: {
        environment: "node",
        setupFiles: ["./vitest.setup.ts"],
        globals: true,
        coverage: {
          provider: "v8",
          reporter: ["text", "json", "html"],
        },
      },
      resolve: {
        alias: [
          {
            find: "@src",
            replacement: path.resolve(__dirname, "src"),
          },
          { find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" },
        ],
      },
    });
    ```

4.  **Create `vitest.setup.ts`**: This simple file ensures environment variables and the global `ioredis` mock are loaded for all tests.

    ```typescript
    // file: backend/vitest.setup.ts
    import "dotenv/config";
    import { vi } from "vitest";
    // The path must be relative to this setup file
    import { Redis as IORedisMock } from "./tests/mocks/ioredis.mock.cjs";

    vi.mock("ioredis", () => {
      // This factory function returns the mock module
      return {
        Redis: IORedisMock,
        default: IORedisMock, // Also mock the default export for CJS/ESM interop
      };
    });
    ```

### Step 3: Update `package.json` and `tsconfig.eslint.json`

1.  **Update `backend/package.json` scripts**: Replace the `test` scripts to use `vitest` commands.

    ```json
    // file: backend/package.json
    {
      // ...
      "scripts": {
        "start": "pm2 start ecosystem.config.cjs --env production",
        "stop": "pm2 stop ecosystem.config.cjs && pm2 delete ecosystem.config.cjs",
        "dev": "nodemon --watch src --ext ts --exec \"npm run build && pm2 startOrReload ecosystem.config.cjs --env development\"",
        "logs": "pm2 logs",
        "build": "tsc",
        "test": "vitest run --passWithNoTests",
        "test:watch": "vitest",
        "coverage": "vitest run --coverage",
        "lint": "eslint . --ext .ts",
        "prettier": "prettier --write ."
      }
      // ...
    }
    ```

2.  **Update `backend/tsconfig.eslint.json`**: Update the `include` path to reference the new Vitest config file for ESLint.

    ```json
    // file: backend/tsconfig.eslint.json
    {
      "extends": "./tsconfig.json",
      "include": [
        "src/**/*",
        "tests/**/*",
        "vitest.config.ts",
        "eslint.config.js"
      ]
    }
    ```

### Step 4: Refactor Test Files

This is the most critical phase. We will refactor tests file-by-file.

#### Group A: The "Golden Pattern" - API Tests with Prismock

These tests will be refactored to use an isolated, in-memory database.

**1. Refactor `backend/tests/integration/journals.test.ts`**

- **Action**: Replace the entire contents of the file with the following code. This is our new template for reliable API tests.

  ```typescript
  // file: backend/tests/integration/journals.test.ts
  import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
  import * as http from "http";
  import type { Express } from "express";
  import session from "supertest-session";
  import type { User, Journal } from "@prisma/client";
  import { PrismockClient } from "prismock";
  import { prisma as originalPrisma } from "@src/lib/prisma.js";

  // Step 1: Mock the prisma module for this file only.
  vi.mock("@src/lib/prisma.js", () => ({
    prisma: new PrismockClient(),
  }));

  // Step 2: Dynamically import the app. It will now receive the mocked prisma client.
  const { createApp } = await import("@src/index.js");

  // Step 3: Get a typed handle to the mocked prisma instance for seeding data.
  const testPrisma = originalPrisma as unknown as PrismockClient;

  describe("/api/journals endpoints", () => {
    // Step 4: Declare all shared variables in the outer scope.
    let app: Express;
    let server: http.Server;
    let agent: session.Session;
    let user1: User;
    let csrfToken: string;

    beforeEach(async () => {
      // Step 5: Setup a pristine environment for EVERY test.
      await testPrisma.reset();
      const { app: freshApp } = createApp();
      app = freshApp;
      await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      });
      agent = session(app);

      user1 = await testPrisma.user.create({
        data: {
          email: `user1-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: "https://user1.ns.com",
        },
      });
      const csrfRes = await agent.get("/api/csrf-token");
      csrfToken = csrfRes.body.csrfToken;
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    // Step 6: Your tests now run in a perfectly isolated environment.
    it("should return 401 Unauthorized if no user is authenticated", async () => {
      const res = await agent.post("/api/journals").send({ _csrf: csrfToken });
      expect(res.status).toBe(401);
    });

    it("should return 403 Forbidden if the user has not signed agreements", async () => {
      const unagreedUser = await testPrisma.user.create({
        data: {
          email: `unagreed-${Date.now()}@test.com`,
          agreementsSigned: false,
          nightscoutUrl: "https://unagreed.ns.com",
        },
      });

      const response = await agent
        .post("/api/journals")
        .set("x-test-user-id", unagreedUser.id)
        .send({ _csrf: csrfToken });

      expect(response.status).toBe(403);
    });

    // ... continue this pattern for all other tests in the file
  });
  ```

**2. Apply the Golden Pattern to Other API Tests**

- **Action**: Apply the same pattern shown above to the following files. The core structure (mocking, imports, `beforeEach`/`afterEach` hooks) will be the same. You will need to adjust the data seeding in `beforeEach` based on what each test file needs.
  - `backend/tests/integration/user.test.ts`
  - `backend/tests/integration/queue.test.ts`
  - `backend/tests/integration/auth.test.ts`

#### Group B: The "Real Database" Tests

These tests must continue to hit the real test database to be valuable.

- **Action**: For the files below, **DO NOT ADD** the `vi.mock` call for Prisma. The only change is to update the Jest imports to Vitest.

**1. Refactor `backend/tests/integration/database.test.ts`**

```typescript
// file: backend/tests/integration/database.test.ts
import { describe, it, expect, afterAll } from "vitest"; // <-- CHANGE HERE
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Database Connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should connect to the database and perform a query", async () => {
    const userCount = await prisma.user.count();
    expect(userCount).toBeGreaterThanOrEqual(0);
  });
});
```

**2. Refactor `backend/tests/integration/privacy.test.ts`**

```typescript
// file: backend/tests/integration/privacy.test.ts
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest"; // <-- CHANGE HERE
import { prisma } from "@src/lib/prisma.js"; // <-- Use the new alias

describe("User Data Privacy", () => {
  // ... (the rest of the file's logic remains the same)
});
```

#### Group C: The "Simple Conversion" Tests

These files don't use the database directly but need syntax updates.

- **Action**: For each file listed below, perform these two changes:
  1.  Change imports from `@jest/globals` to `vitest`.
  2.  Change any instance of the `jest` global object to `vi` (e.g., `jest.fn()` becomes `vi.fn()`).

**1. Refactor `backend/tests/unit/encryption.test.ts`**

```typescript
// file: backend/tests/unit/encryption.test.ts
process.env.ENCRYPTION_KEY =
  "151b795a05b8758bb36b9b3813333d5484373c0b735697525834c643a2b8593c";

import { encrypt, decrypt } from "@src/lib/encryption.js"; // <-- Use alias
import { describe, it, expect, vi } from "vitest"; // <-- CHANGE HERE

describe("Encryption Utility", () => {
  // ... (rest of the tests are unchanged)
});

describe("Encryption Utility Initialization", () => {
  it("should throw an error if ENCRYPTION_KEY is not set", async () => {
    // ...
    await expect(async () => {
      vi.resetModules(); // <-- CHANGE HERE
      await import("@src/lib/encryption.js");
    }).rejects.toThrow(/* ... */);
    // ...
  });
  // ...
});
```

**2. Apply Simple Conversion to Remaining Files**

- **Action**: Apply the same import and `jest`->`vi` object changes to the following files:
  - `backend/tests/unit/auth.allowlist.test.ts`
  - `backend/tests/unit/auth.test.ts`
  - `backend/tests/unit/worker.test.ts`
  - `backend/tests/integration/server.test.ts`
  - `backend/tests/integration/session.test.ts`
  - `backend/tests/integration/startup.test.ts`

### Step 5: Verify Migration

1.  **Run Tests**: From the **project root**, execute the entire test suite.

    ```bash
    npm test -w backend
    ```

    All tests should pass reliably. The API tests should complete much faster than before. You have now completed the migration.
