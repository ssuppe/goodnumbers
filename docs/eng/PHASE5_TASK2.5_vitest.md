Excellent. This is exactly the right question to ask. A plan is only as good as its last review, and scrutinizing it for hidden assumptions is a mark of a senior engineer.

I have re-reviewed the entire plan, pretending I was the junior engineer executing it from a clean slate. My conclusion is that the plan is **99% correct, but there is one critical omission** that would cause an immediate test failure.

The plan correctly identifies the need to refactor test files that use the `jest` global, but it misses a case where the `jest` global is used inside one of our **mock files**.

### The Missing Step

The file `backend/tests/mocks/ioredis.mock.cjs` currently contains this line:

```javascript
// file: backend/tests/mocks/ioredis.mock.cjs
// ...
disconnect = jest.fn();
// ...
```

When we run the tests with Vitest, the `jest` global object will not be defined in the scope of this CommonJS module, and any test that tries to import `ioredis` (which is most of them) will fail with a `ReferenceError: jest is not defined`.

### The Correction

The fix is simple and improves the mock by making it test-runner-agnostic. We need to replace the dependency on `jest.fn()` with a plain function that has the same behavior for our purposes (i.e., it can be called without error).

The engineering plan needs one additional step to patch this file.

Here is the corrected and finalized engineering plan. I have inserted the new step into its logical place in the "Refactor Test Files" section.

---

# Goodnumbers — `todo.md` (Final Version)

## TL;DR

Migrate the backend test runner from Jest to Vitest to resolve ESM compatibility issues, simplify configuration, and improve the overall developer testing experience.

## Invariants (do not change)

- **Data Segregation**: A user can **only** access data they own. All database queries for specific resources must include a `WHERE userId = '...'` clause.
- **Data Privacy**: Deleting a parent resource (like a `User` or `Journal`) **must** trigger the deletion of all its child data to prevent orphaned, sensitive information.
- **Server-Side Authorization**: The server **must not** trust the client. All access-control decisions must be made and enforced on the server.

## Assumptions & Scope

- **Assumption**: All tasks up to and including Phase 5, Task 2 (`feat/phase5-task2-shared-schemas`) are complete and have been merged into the `phase5develop` branch.
- **Assumption**: The primary motivation is to resolve tooling friction related to Jest's experimental ESM support, not to change the logic or coverage of existing tests.
- **Scope**: This task is strictly limited to the `backend` workspace. It involves swapping testing dependencies, creating new configuration files for Vitest, and refactoring existing test files and mocks to use the Vitest API.
- **Out of Scope**: This task does not involve adding new application features, writing new feature tests, or modifying any code in the `frontend` or `packages` workspaces.

## Objectives

1.  **Replace Test Runner**: Successfully remove all Jest-related dependencies and configuration from the `backend` workspace and replace them with Vitest.
2.  **Guarantee No Regressions**: Ensure 100% of the existing unit and integration tests pass under the new Vitest test runner.
3.  **Simplify Configuration**: Eliminate the need for the `NODE_OPTIONS="--experimental-vm-modules"` flag in `npm` scripts and simplify the overall test configuration into a single `vitest.config.ts` file.
4.  **Improve Developer Experience**: The new test runner should be faster and provide a more stable, less error-prone foundation for future test development.

## Risks & Mitigations

- **Risk**: Subtle differences in the mocking and module resolution APIs between Jest and Vitest could cause hard-to-debug test failures.
  - **Mitigation**: A full regression test of the entire suite will be the primary acceptance gate. Critical mocks (`ioredis`, `bullmq`) will be carefully ported and tested first.
- **Risk**: The new Vitest configuration could fail to correctly resolve TypeScript paths or aliases, breaking imports within tests.
  - **Mitigation**: The new `vitest.config.ts` will be explicitly configured with an `alias` section that mirrors the functionality of Jest's `moduleNameMapper` and the project's `tsconfig.json`.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea**: Replace the project's test runner, which is causing friction due to ESM compatibility issues, with a modern, ESM-native alternative.
- **Mechanism**:
  1.  Swap npm dependencies: Uninstall `jest`, `ts-jest`, `@types/jest` and install `vitest`, `@vitest/coverage-v8`, `jsdom`.
  2.  Replace `jest.config.cjs` and `jest.setup.js` with a single, strongly-typed `vitest.config.ts` and `vitest.setup.ts`.
  3.  Update the `test` script in `backend/package.json` to call `vitest` instead of `jest`.
  4.  Systematically refactor all `*.test.ts` files and associated mock files to remove dependencies on the `jest` global object.
  5.  Execute the full test suite to verify a successful migration.
- **Trade-offs**: This requires a one-time engineering effort to update dependencies and refactor test files. This cost is vastly outweighed by the long-term benefits of a faster, more stable testing environment that removes a significant source of developer friction and debugging.
- **Go/No-Go**: **Go**. The existing tooling issues are a known impediment to productivity.

## Implementation Notes

- **New Dependencies**: `vitest`, `@vitest/coverage-v8`, `jsdom` will be added as dev dependencies to `backend`.
- **Removed Dependencies**: `jest`, `ts-jest`, `@types/jest` will be removed from `backend`.
- **New Configuration**: A new file, `backend/vitest.config.ts`, will be the single source of truth for test configuration.
- **API Conversion**: The `jest` global object in test files is replaced by the `vi` object. Key conversions include:
  - `jest.fn()` → `vi.fn()`
  - `jest.spyOn()` → `vi.spyOn()`
  - `jest.unstable_mockModule()` → `vi.mock()`
  - `@jest/globals` imports → `vitest` imports.

## Acceptance Gates

1.  The command `npm test -w backend`, run from the project root, **must pass** all tests using the Vitest runner.
2.  The `test` script in `backend/package.json` **must not** contain the `--experimental-vm-modules` flag.
3.  The files `backend/jest.config.cjs` and `backend/jest.setup.js` **must be deleted**.
4.  The command `npm run coverage -w backend` **must successfully generate** a code coverage report.

## “Make-sure-you” Checklist

- \[ ] Run `npm install` from the project root after modifying `backend/package.json` to ensure dependencies are updated correctly.
- \[ ] Verify that all instances of the `jest` global object (e.g., `jest.fn`) in test files and mock files have been replaced.
- \[ ] Confirm that all module mocks have been converted from the `jest.unstable_mockModule` pattern to the `vi.mock` factory pattern.
- \[ ] Double-check that the `vitest.config.ts` includes the necessary aliases to mock `ioredis`.

## Project hygiene prep

1.  **Create a Branch**: Following `DEVELOPMENT_PROCESS.md`, create a new branch from the latest `phase5develop`.

    ```bash
    git checkout phase5develop
    git pull origin phase5develop
    git checkout -b chore/phase5-task3-migrate-to-vitest
    ```

2.  **Create an Issue**: Create a GitHub Issue to track this work.

    ```bash
    gh issue create --title "chore(testing): P5_T3 Migrate backend test runner from Jest to Vitest" --body "This work migrates the backend test runner from Jest to Vitest to resolve persistent ESM compatibility issues and improve the developer testing experience, as per the Phase 5, Task 3 engineering plan."
    ```

3.  **Adopt Test-Driven Approach**: This is a refactoring task. The "test" is to ensure the behavior of the test suite itself does not change.
    - **RED**: Run `npm test -w backend` before any changes to establish a passing baseline.
    - **GREEN**: After implementing the migration, run `npm test -w backend` again. The goal is for the exact same tests to pass.
    - **REFACTOR**: Clean up any warnings or configuration issues from the Vitest output.

## In-depth test plan

The validation for this migration is a form of **differential testing** against the last known-good state of the test suite. The core metamorphic property we are testing is that changing the test runner should not change the test outcomes.

1.  **Regression Oracle**:
    - **Execution**: Run `npm test -w backend` before the migration and save the output.
    - **Oracle**: After the migration, run `npm test -w backend` again. The test summary (number of tests passed, failed, skipped) must be identical to the pre-migration run. This confirms the migration was successful and introduced no regressions.

2.  **Contract Tests (Mocks)**:
    - The most critical part of the migration is ensuring the module mocks still function as expected. We will pay special attention to `tests/integration/queue.test.ts` and `tests/unit/auth.allowlist.test.ts`.
    - **Oracle**: We will manually verify that the tests which rely on `vi.mock` (the new `jest.unstable_mockModule`) pass correctly, confirming that Vitest's module loader is correctly intercepting imports for `queue.js` and `fs/promises`.

## In-depth engineering plan

### Step 1: Update Dependencies

1.  **Install Vitest and Uninstall Jest**: Run the following commands from the **project root**.

    ```bash
    npm install -D vitest @vitest/coverage-v8 jsdom -w backend
    npm uninstall jest ts-jest @types/jest -w backend
    ```

### Step 2: Create Vitest Configuration

1.  **Delete Old Jest Config**:

    ```bash
    rm backend/jest.config.cjs backend/jest.setup.js
    ```

2.  **Create `vitest.config.ts`**: Create the new configuration file in the `backend/` directory.

    ```typescript
    // file: backend/vitest.config.ts
    /// <reference types="vitest" />
    import { defineConfig } from "vitest/config";

    export default defineConfig({
      test: {
        environment: "node",
        setupFiles: ["./vitest.setup.ts"],
        globals: true,
        alias: {
          ioredis: "./tests/mocks/ioredis.mock.cjs",
        },
        coverage: {
          provider: "v8",
          reporter: ["text", "json", "html"],
        },
      },
      resolve: {
        alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" }],
      },
    });
    ```

3.  **Create `vitest.setup.ts`**: This file replaces the old `jest.setup.js`.

    ```typescript
    // file: backend/vitest.setup.ts
    import "dotenv/config";
    ```

### Step 3: Update `package.json` and `tsconfig.eslint.json`

1.  **Update `backend/package.json` scripts**: Replace the `test` script and remove the experimental flag.

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

2.  **Update `backend/tsconfig.eslint.json`**: Update the `include` path to reference the new Vitest config file.

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

### Step 4: Refactor Test and Mock Files

1.  **Update `ioredis` Mock**: **This is the critical fix.** Edit `backend/tests/mocks/ioredis.mock.cjs` to remove its dependency on the `jest` global.

    ```javascript
    // file: backend/tests/mocks/ioredis.mock.cjs
    // ...
    class IORedisMock extends EventEmitter {
      constructor(options = {}) {
        super();
        process.nextTick(() => this.emit("connect"));
      }
      disconnect = () => {};
    }
    // ...
    ```

2.  **Update Test File Imports**: In every `*.test.ts` file, change imports from `@jest/globals` to `vitest`.
    - **From**: `import { describe, it, expect, jest } from '@jest/globals';`
    - **To**: `import { describe, it, expect, vi } from 'vitest';`

3.  **Update Mocking Syntax in Tests**: Systematically replace `jest` object calls with `vi`.
    - `jest.fn()` → `vi.fn()`
    - `jest.mockClear()` → `vi.mockClear()`
    - `mockClear()` on a mocked function → `mockClear()` (no change)

4.  **Update Module Mocks in Tests**: Convert `jest.unstable_mockModule` to `vi.mock`.
    - **Example in `tests/integration/queue.test.ts`**:

      ```typescript
      // file: backend/tests/integration/queue.test.ts
      // ...
      import {
        describe,
        it,
        expect,
        beforeAll,
        afterAll,
        vi,
        beforeEach,
      } from "vitest";
      // ...

      const mockQueueInstance = {
        add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
      };

      vi.mock("../../src/lib/queue.js", () => ({
        getJournalQueue: () => mockQueueInstance,
        JOURNAL_QUEUE_NAME: "test-queue",
      }));

      const { createApp } = await import("../../src/index.js");
      // ...
      describe("API to Mock Job Queue Integration", () => {
        beforeEach(() => {
          mockQueueInstance.add.mockClear();
        });
        // ...
      });
      ```

### Step 5: Verify Migration

1.  **Run Tests**: From the **project root**, execute the test suite.

    ```bash
    npm test -w backend
    ```

    All tests should pass. The process is now complete.
