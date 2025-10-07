# Goodnumbers — Phase 5, Task 3

## TL;DR

This document outlines the plan to extract Prisma-generated TypeScript types into a dedicated, shared monorepo package (`@goodnumbers/types`) to enable type-safe data exchange between the frontend and backend without sharing the Prisma runtime client.

## Invariants (do not change)

- The runtime Prisma client instance (`prisma`) must remain a singleton instantiated exclusively within the backend application.
- The backend must never expose the full Prisma client runtime or its connection details to the frontend.
- All existing application functionality, API contracts, and tests must remain unchanged and pass post-refactor.
- The `packages/types` module must only export TypeScript types, not runtime code.

## Assumptions & Scope

- **Assumption:** The current `npm workspaces` monorepo configuration is stable and correct.
- **Assumption:** The primary consumer of this new package will be the future React frontend (Phase 5, Task 4), which needs to import model types like `User` and `Journal` for type safety.
- **Scope:** This task is strictly a backend and monorepo refactor. It includes:
  1.  Creating the `@goodnumbers/types` package.
  2.  Redirecting Prisma's type generation to this new package.
  3.  Refactoring the backend to consume types from the new package.
  4.  Verifying the change against the existing test suite.
- **Out of Scope:** Implementation of frontend components that consume these types is not part of this task.

## Objectives

1.  **Configure `schema.prisma`** to generate client types into the `packages/types/src/generated/client` directory.
2.  **Establish `@goodnumbers/types`** as a new shared package that properly exports all generated model types, using the established `tsconfig.base.json` pattern for consistency.
3.  **Refactor Backend** to import all model types (e.g., `import type { User }`) from `@goodnumbers/types` instead of `@prisma/client`. The runtime client import (`import { prisma }`) will remain unchanged.
4.  **Verify Integrity** by achieving a 100% pass rate on the existing backend test suite (`npm test -w backend`) after the refactor.

## Risks & Mitigations

- **Risk:** Incorrect relative path in `prisma.schema` generator output causes build failures.
  - **Mitigation:** The engineering plan specifies the exact path and includes a verification step to check for file existence immediately after running `prisma generate`.
- **Risk:** Circular dependencies are introduced if the new package accidentally imports from other workspaces.
  - **Mitigation:** The package's `tsconfig.json` will be minimal and contain no path aliases. CI lint steps should enforce module boundary rules.
- **Risk:** Developers mistakenly import the runtime `PrismaClient` from the new package.
  - **Mitigation:** The package's entry point will use `export * from '...'` syntax on a file containing only types. The refactoring plan explicitly differentiates between type imports and the single runtime import.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Decouple Prisma's generated TypeScript types from its runtime client to enable type sharing across the monorepo.
- **Mechanism:**
  1.  Create a dedicated internal npm package: `@goodnumbers/types`.
  2.  Use the `output` property in the `generator client` block of `schema.prisma` to redirect TypeScript declaration generation into this new package.
  3.  Refactor the backend: `import type { User } from '@goodnumbers/types'` for types, while preserving the single `import { prisma } from './lib/prisma.js'` for the runtime instance.
- **Trade-offs:**
  - **Cost:** Adds one more internal package and a slight configuration complexity.
  - **Benefit:** Enables full end-to-end type safety, allows frontend components to be strongly typed against the database schema, and reduces frontend bundle sizes by preventing the Prisma runtime from being included.
- **Go/No-Go Decision:** **Go**. The benefit of full-stack type safety is a non-negotiable architectural advantage.

## Implementation Notes

- **API:** No external API contracts will be changed. This is a purely internal refactor.
- **Attach Points:**
  - `backend/prisma/schema.prisma`
  - `packages/` (new directory `types/`)
  - `backend/package.json`
  - All backend source and test files that import types from `@prisma/client`.
- **Path Precision:** The relative path from `backend/prisma/schema.prisma` is `../../packages/types/src/generated/client`.
- **Security Note on API Boundaries:** Sharing the full Prisma types with the frontend is a powerful tool that enables compile-time type safety across our entire stack. However, it introduces a critical responsibility for the backend developer: **the API remains the true security boundary.**

  Just because the frontend has a `User` type that includes sensitive fields like `nightscoutToken` or `rssToken` does not mean it is safe to send the entire `User` object from the database over the network. Doing so would leak sensitive user data to the client.

  Therefore, the following rule must be strictly followed: **API endpoints must NEVER return a complete Prisma model object directly.** Instead, you must always create a "safe" version of the data for the client. This is typically done by using Prisma's `select` option to explicitly pick only the non-sensitive fields you need to send. For example:

  ```typescript
  // GOOD: Select only the safe fields to create a public-facing object.
  const safeUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      preferredUnits: true,
    },
  });
  res.json(safeUser);

  // BAD: This would leak the user's encrypted token and other sensitive data.
  const unsafeUser = await prisma.user.findUnique({ where: { id: userId } });
  res.json(unsafeUser); // <-- NEVER DO THIS
  ```

## Acceptance Gates

1.  **File Generation:** The directory `packages/types/src/generated/client` must exist and be populated after `npx prisma generate`.
2.  **Successful Build:** `npm run build -w backend` must complete without errors.
3.  **Test Suite Pass:** `npm test -w backend` must pass with 100% success.
4.  **Metamorphic Test Pass:** The new schema-to-type contract test must pass.

## “Make-sure-you” Checklist

- [ ] Have you created a backup of `backend/prisma/schema.prisma` before editing?
- [ ] Does the `output` path in `schema.prisma` use the exact relative path specified?
- [ ] Did you run `npm install` from the **project root** after modifying `backend/package.json`?
- [ ] Have you refactored only the **type imports** (`import type { User, ... }`)?
- [ ] Does the singleton runtime import (`import { prisma } from '@src/lib/prisma.js'`) remain unchanged?
- [ ] Does `packages/types/src/index.ts` correctly re-export from `./generated/client`?
- [ ] Have you run `npm audit` from the project root after all changes to check for new vulnerabilities?

## Project hygiene prep

1.  **GitHub Issue:** Create an issue to track this work.
    ```bash
    gh issue create --title "feat(types): P5_T3 Create shared types package for Prisma" --body "As per the design doc, this task involves creating the @goodnumbers/types package to share Prisma-generated types across the monorepo. This will enable full-stack type safety."
    ```
2.  **Branch:** Create a new feature branch from the `phase5develop` branch.
    ```bash
    git checkout phase5develop
    git pull origin phase5develop
    git checkout -b feat/P5_T3-shared-prisma-types
    ```
3.  **Commits:** Use **Conventional Commits**. The work should be broken down into logical, atomic commits.

## In-depth test plan

This refactor will be validated by a combination of regression testing, static analysis, and a new metamorphic contract test.

1.  **Regression Testing (Existing Suite):** The primary validation is ensuring that 100% of the existing tests in `backend/tests/` pass. This confirms that the refactoring has not introduced any functional regressions.

2.  **Static Analysis (Type Checking):** `npm run build -w backend` will serve as the formal static analysis gate. A successful build proves that the new type imports from `@goodnumbers/types` are being resolved and consumed correctly by the backend codebase.

3.  **Metamorphic Testing (Schema-to-Type Contract):** A new test will be added to ensure that the types package always stays in sync with the database schema. This is a crucial automated check to prevent future drift between the database and the shared types.
    - **Property:** The set of exported members from `@goodnumbers/types` must be a superset of the model names defined in `schema.prisma`.
    - **Test Implementation:** Create a new test file with the following content:

    ```typescript
    // file: backend/tests/meta/types.test.ts
    import { describe, it, expect } from "vitest";
    import * as fs from "fs";
    import * as path from "path";
    import * as exportedTypes from "@goodnumbers/types";

    describe("Schema-to-Type Contract", () => {
      it("should export a type for every model in the Prisma schema", () => {
        // 1. Read the schema file
        const schemaPath = path.resolve(
          __dirname,
          "../../../prisma/schema.prisma"
        );
        const schemaContent = fs.readFileSync(schemaPath, "utf-8");

        // 2. Parse all model names from the schema
        const modelRegex = /^\s*model\s+([A-Za-z0-9_]+)\s*\{/gm;
        const models = new Set<string>();
        let match;
        while ((match = modelRegex.exec(schemaContent)) !== null) {
          models.add(match[1]);
        }

        expect(models.size).toBeGreaterThan(0); // Sanity check

        // 3. Get all exported members from the types package
        const exportedNames = Object.keys(exportedTypes);

        // 4. Assert that every model has a corresponding exported type
        for (const modelName of models) {
          expect(exportedNames).toContain(modelName);
        }
      });
    });
    ```

## In-depth engineering plan

### Step 1: Establish Consistent TypeScript Configuration

1.  **Create Base `tsconfig.json`:** To ensure consistency across packages, create a new `tsconfig.base.json` in the project root. This file establishes the baseline compiler settings for all TypeScript projects in the monorepo.

    ```json
    // file: tsconfig.base.json
    {
      "compilerOptions": {
        "target": "ESNext",
        "module": "ESNext",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "moduleResolution": "bundler"
      }
    }
    ```

### Step 2: Create the `@goodnumbers/types` Package

1.  **Create Directories & Files:**
    ```bash
    mkdir -p packages/types/src
    touch packages/types/package.json
    touch packages/types/tsconfig.json
    touch packages/types/src/index.ts
    ```
2.  **Populate `packages/types/package.json`:** This file defines the package, its build script, and crucially marks it as `"private": true` to prevent accidental publishing to a public registry.
    ```diff
    --- a/packages/types/package.json
    +++ b/packages/types/package.json
    @@ -1,16 +1,15 @@
     {
       "name": "@goodnumbers/types",
       "version": "1.0.0",
    +  "private": true,
       "main": "dist/index.js",
       "types": "dist/index.d.ts",
       "scripts": {
         "build": "tsc"
       },
       "devDependencies": {
         "typescript": "^5.9.2"
       }
     }
    ```
3.  **Populate `packages/types/tsconfig.json`:** This configuration inherits from our new base config and specifies the output directory for the compiled TypeScript declarations.
    ```diff
    --- a/packages/types/tsconfig.json
    +++ b/packages/types/tsconfig.json
    @@ -1,13 +1,11 @@
     {
    ```

-      "extends": "../../tsconfig.base.json",
       "compilerOptions": {

*        "target": "es2016",
*        "module": "commonjs",
*        "declaration": true,
*        "outDir": "./dist",
*        "esModuleInterop": true,
*        "forceConsistentCasingInFileNames": true,
*        "strict": true,
*        "skipLibCheck": true

-        "outDir": "dist",
-        "declaration": true
       },

*      "include": ["src/**/*.ts"],
*      "exclude": ["node_modules", "dist"]

-      "include": ["src"]

  }

  ```

  ```

### Step 3: Configure Prisma, Generate, and Link

1.  **Modify `backend/prisma/schema.prisma`:** Update the `generator client` block to redirect the type output to our new shared package. The relative path is critical.

    ````diff
    --- a/backend/prisma/schema.prisma
    +++ b/backend/prisma/schema.prisma
    @@ -5,6 +5,7 @@

     generator client {
       provider = "prisma-client-js"
    +  output   = "../../packages/types/src/generated/client"
     }

     // Enum for type safety on user's preferred glucose units
    ```2.  **Populate `packages/types/src/index.ts`:** This file acts as the public API for the new package, re-exporting all generated types from the location Prisma places them.
    ```diff
    --- a/packages/types/src/index.ts
    +++ b/packages/types/src/index.ts
    @@ -1 +1,3 @@
    -export {}
    +// This file serves as the public API for the @goodnumbers/types package.
    +// It re-exports all the types generated by Prisma into a single, consumable module.
    +export * from './generated/client';
    ```3.  **Run Prisma Generate:** From within the `backend` directory, run the generate command to populate the new types package.
    ```bash
    (cd backend && npx prisma generate)
    ````

2.  **Add Workspace Dependency to `backend/package.json`:** Explicitly add `@goodnumbers/types` as a workspace dependency for the backend application.
    ```json
     "dependencies": {
        // ...
        "@goodnumbers/schemas": "workspace:*",
        "@goodnumbers/types": "workspace:*",
        "@prisma/client": "^6.14.0",
        // ...
      },
    ```
3.  **Install:** From the **project root**, run `npm install` to allow npm to correctly symlink the new workspace package.

### Step 4: Refactor Backend Imports

Systematically go through the listed files and change only the **type imports** from `@prisma/client` to `@goodnumbers/types`. **Do not** change the runtime import (`import { prisma } ...`). Using `import type` is a best practice as it ensures the import is erased at compile time and has zero runtime cost.

- `backend/src/lib/auth.ts`
- `backend/tests/integration/journals.test.ts`
- `backend/tests/integration/privacy.test.ts`
- `backend/tests/integration/queue.test.ts`
- `backend/tests/integration/user.test.ts`
- `backend/tests/unit/worker.test.ts`

**Example diff for `backend/tests/integration/journals.test.ts`:**

```diff
--- a/backend/tests/integration/journals.test.ts
+++ b/backend/tests/integration/journals.test.ts
@@ -3,7 +3,7 @@
 import * as http from "http";
 import type { Express } from "express";
 import session from "supertest-session";
-import type { User, Journal } from "@prisma/client";
+import type { User, Journal } from "@goodnumbers/types";
 import { PrismockClient } from "prismock";
 import { prisma as originalPrisma } from "@src/lib/prisma.js";
 import { getJournalQueue } from "@src/lib/queue.js";

```

### Step 5: Final Verification and Commit

1.  **Build and Test:** From the project root, run the build and test scripts in sequence to confirm that the new packages build correctly and the backend's functionality remains intact.
    ```bash
    npm run build -w @goodnumbers/types
    npm run build -w backend
    npm test -w backend
    ```
2.  **Commit:** Commit your work in logical, atomic steps using the Conventional Commits standard.
    ```bash
    git add .
    git commit -m "feat(types): P5_T3 create shared types package for Prisma"
    git commit -m "refactor(backend): consume prisma types from shared package"
    ```
