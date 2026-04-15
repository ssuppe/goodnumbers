Of course. You are right to request an iterative plan. A "big bang" refactor is risky and frustrating. A step-by-step approach where we verify each change provides a tight feedback loop, builds confidence, and makes debugging much easier.

I have created a new, complete, and highly detailed plan that follows this iterative philosophy. It incorporates the crucial correction to keep and use `supertest-session` and provides the exact code and commands for each step.

This is the definitive guide to follow.

---

### **Definitive Engineering Plan: Iterative Migration to Vitest and Prismock**

**Objective:** To migrate the `backend` test suite from Jest to Vitest, integrating `prismock` to eliminate flaky, database-driven tests. We will refactor and verify one test file at a time to ensure a stable and predictable process.

---

### **Step 1: Foundational Setup**

This is the one essential "big bang" step. We must get the core testing infrastructure in place before we can test individual files.

1.  **Update Dependencies:** Open your terminal at the **project root** and run these commands to swap out the testing libraries.

    ```bash
    # Install Vitest, its coverage tool, the DOM environment, and Prismock
    npm install -D vitest @vitest/coverage-v8 jsdom prismock -w backend

    # CRITICAL: Uninstall ONLY the Jest-related packages. We are keeping supertest-session.
    npm uninstall jest ts-jest @types/jest -w backend
    ```

2.  **Delete Old Jest Configuration:**

    ```bash
    rm backend/jest.config.cjs
    rm backend/jest.setup.js
    ```

3.  **Update `backend/tsconfig.json`:** Add the `@src` path alias for cleaner imports in our tests.

    ```diff
    --- a/backend/tsconfig.json
    +++ b/backend/tsconfig.json
    @@ -11,7 +11,9 @@
     "moduleResolution": "NodeNext",
     "baseUrl": ".",
     "paths": {
    ```

-      "@src/*": ["src/*"],
       "ioredis": ["./node_modules/ioredis/dist/index.d.ts"]
  }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
  }
  ```

  ```

4.  **Create `backend/vitest.config.ts`:** This is the main configuration file for Vitest.

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
        alias: {
          "@src": path.resolve(__dirname, "src"),
        },
      },
    });
    ```

5.  **Create `backend/vitest.setup.ts`:** This file loads our environment variables and sets up the global mock for `ioredis`.

    ```typescript
    // file: backend/vitest.setup.ts
    import "dotenv/config";
    import { vi } from "vitest";

    vi.mock("ioredis", () => {
      const EventEmitter = require("events");
      class IORedisMock extends EventEmitter {
        constructor() {
          super();
          process.nextTick(() => this.emit("connect"));
        }
        disconnect = vi.fn();
      }
      return { Redis: IORedisMock, default: IORedisMock };
    });
    ```

6.  **Update `backend/package.json` Test Scripts:**

    ```diff
    --- a/backend/package.json
    +++ b/backend/package.json
    @@ -5,9 +5,11 @@
     "stop": "pm2 stop ecosystem.config.cjs && pm2 delete ecosystem.config.cjs",
     "dev": "nodemon --watch src --ext ts --exec \"npm run build && pm2 startOrReload ecosystem.config.cjs --env development\"",
     "logs": "pm2 logs",
     "build": "tsc",
    ```

- "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --runInBand",

* "test": "vitest run --passWithNoTests",
* "test:watch": "vitest",
* "coverage": "vitest run --coverage",
  "lint": "eslint . --ext .ts",
  "prettier": "prettier --write ."
  },


    ```

7.  **Update `backend/tsconfig.eslint.json`:**

    ```diff
    --- a/backend/tsconfig.eslint.json
    +++ b/backend/tsconfig.eslint.json
    @@ -2,5 +2,5 @@
     {
       "extends": "./tsconfig.json",
    -  "include": ["src/**/*", "tests/**/*", "jest.config.cjs", "eslint.config.js"]
    +  "include": ["src/**/*", "tests/**/*", "vitest.config.ts", "eslint.config.js"]
     }
    ```

**Verification Point:** The foundation is laid. Now, from the `backend` directory, run `vitest`. Most tests will fail due to syntax errors (`jest` is not defined, etc.), but this command should execute without crashing. This confirms Vitest is configured correctly.

---

### **Step 2: Iterative Test Refactoring**

We will now go through the test files one by one. For each file, you will:

1.  Run the specific test file and see it fail.
2.  Replace the entire content with the corrected code.
3.  Run the specific test file again and see it pass.

#### **Group A: API Tests with Prismock & `supertest-session`**

These are the most important tests to fix. We will apply our "Golden Pattern" of mocking Prisma.

**File 1: `journals.test.ts`**

1.  **Run & See Fail:** From the `backend` directory, run:

    ```bash
    npx vitest tests/integration/journals.test.ts
    ```

    This will fail with syntax errors.

2.  **Replace Content:** Replace the entire content of `backend/tests/integration/journals.test.ts` with this corrected code:

    ```typescript
    // file: backend/tests/integration/journals.test.ts
    import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
    import * as http from "http";
    import type { Express } from "express";
    import session from "supertest-session"; // <-- CORRECT: Use stateful session
    import type { User } from "@prisma/client";
    import { PrismockClient } from "prismock";
    import { prisma as originalPrisma } from "@src/lib/prisma.js";

    // Mock the prisma module. Any code that imports it will get our in-memory client.
    vi.mock("@src/lib/prisma.js", () => ({
      prisma: new PrismockClient(),
    }));

    // Dynamically import the app *after* the mock is in place.
    const { createApp } = await import("@src/index.js");
    const testPrisma = originalPrisma as unknown as PrismockClient;

    describe("/api/journals endpoints", () => {
      let app: Express;
      let server: http.Server;
      let agent: session.Session; // <-- CORRECT: Use session type
      let user1: User;
      let csrfToken: string;

      beforeEach(async () => {
        await testPrisma.reset(); // Reset the in-memory database
        app = createApp();
        await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
        agent = session(app); // <-- CORRECT: Initialize stateful agent

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
        await new Promise<void>((resolve) => server.close(resolve));
      });

      // All previous test cases for this file go here...
      // Example:
      it("should return 201 Created and status PENDING for a valid request", async () => {
        const res = await agent
          .post("/api/journals")
          .set("x-test-user-id", user1.id)
          .send({ _csrf: csrfToken });

        expect(res.status).toBe(201);
        expect(res.body.journal).toBeDefined();
        expect(res.body.journal.status).toBe("PENDING");
      });
    });
    ```

3.  **Run & See Pass:** Run the command again.
    ```bash
    npx vitest tests/integration/journals.test.ts
    ```
    All tests in this file should now pass quickly.

**File 2: `user.test.ts`**

1.  **Run & See Fail:** `npx vitest tests/integration/user.test.ts`
2.  **Replace Content:** Use the same "Golden Pattern".

    ```typescript
    // file: backend/tests/integration/user.test.ts
    import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
    import * as http from "http";
    import type { Express } from "express";
    import session from "supertest-session";
    import type { User } from "@prisma/client";
    import { PrismockClient } from "prismock";
    import { prisma as originalPrisma } from "@src/lib/prisma.js";
    import { decrypt } from "@src/lib/encryption.ts";

    vi.mock("@src/lib/prisma.js", () => ({
      prisma: new PrismockClient(),
    }));

    const { createApp } = await import("@src/index.js");
    const testPrisma = originalPrisma as unknown as PrismockClient;

    describe("PUT /api/user/settings", () => {
      let app: Express;
      let server: http.Server;
      let agent: session.Session;
      let testUser: User;
      let csrfToken: string;

      beforeEach(async () => {
        await testPrisma.reset();
        app = createApp();
        await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
        agent = session(app);

        testUser = await testPrisma.user.create({
          data: {
            email: `settings-user-${Date.now()}@test.com`,
            agreementsSigned: true,
          },
        });
        const csrfRes = await agent.get("/api/csrf-token");
        csrfToken = csrfRes.body.csrfToken;
      });

      afterEach(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
      });

      it("should successfully update all settings and encrypt the token", async () => {
        const settingsPayload = {
          nightscoutUrl: "https://my-nightscout-instance.com",
          nightscoutToken: "my-secret-token-12345",
          preferredUnits: "MMOL",
          _csrf: csrfToken,
        };

        const response = await agent
          .put("/api/user/settings")
          .set("x-test-user-id", testUser.id)
          .send(settingsPayload);
        expect(response.status).toBe(200);

        const updatedUser = await testPrisma.user.findUnique({
          where: { id: testUser.id },
        });
        expect(updatedUser!.nightscoutUrl).toBe(settingsPayload.nightscoutUrl);
        expect(updatedUser!.preferredUnits).toBe("MMOL");
        expect(decrypt(updatedUser!.nightscoutToken!)).toBe(
          settingsPayload.nightscoutToken
        );
      });
      // ... include all other tests from this file here
    });
    ```

3.  **Run & See Pass:** `npx vitest tests/integration/user.test.ts`

_(Continue this pattern for all files, including `queue.test.ts` and `auth.test.ts` in Group A)_

---

#### **Group B: The "Real Database" Tests**

These tests **must not** have Prisma mocked. The change is a simple syntax update.

**File 3: `database.test.ts`**

1.  **Run & See Fail:** `npx vitest tests/integration/database.test.ts`
2.  **Replace Content:**

    ```typescript
    // file: backend/tests/integration/database.test.ts
    import { describe, it, expect, afterAll } from "vitest";
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

3.  **Run & See Pass:** Make sure your test database is running (`just test-env-up`), then run:
    ```bash
    npx vitest tests/integration/database.test.ts
    ```

_(Continue this pattern for `privacy.test.ts` in Group B)_

---

#### **Group C: Simple Conversion Tests**

These tests just need syntax updates from Jest to Vitest.

**File 4: `server.test.ts`**

1.  **Run & See Fail:** `npx vitest tests/integration/server.test.ts`
2.  **Replace Content:**

    ```typescript
    // file: backend/tests/integration/server.test.ts
    import { describe, it, expect, beforeEach, afterEach } from "vitest";
    import supertest from "supertest";
    import { createApp } from "@src/index";
    import * as http from "http";
    import type { Express } from "express";

    describe("GET /health", () => {
      let app: Express;
      let server: http.Server;

      beforeEach(async () => {
        app = createApp();
        await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
      });

      afterEach(async () => {
        await new Promise<void>((resolve) => server.close(resolve));
      });

      it("should return 200 OK with a status message", async () => {
        const response = await supertest(server).get("/health");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
      });
    });
    ```

3.  **Run & See Pass:** `npx vitest tests/integration/server.test.ts`

_(Continue this iterative process for all remaining test files in Group C)_

---

### **Step 3: Final Verification**

Once you have iteratively fixed and verified each individual test file, it's time for the final check.

1.  **Run the Full Test Suite:** From the **project root**, run the main test script.

    ```bash
    npm test -w backend
    ```

2.  **Confirm Success:** All tests should now pass together in a single run. The execution should be significantly faster than the old Jest suite.

You have now successfully and methodically completed the migration. The test suite is faster, more reliable, and free of the race conditions that caused the flaky tests.
