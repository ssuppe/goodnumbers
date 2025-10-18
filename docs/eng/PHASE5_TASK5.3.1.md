Of course. Here is the complete engineering plan.

# Goodnumbers — `docs/eng/PHASE5_TASK_FIX.md` (Final TDD Revision)

## TL;DR

Refactor the monorepo's shared packages to strictly separate server-only types from universal runtime values, fixing a critical frontend bundling error.

## Invariants (do not change)

- The final frontend JavaScript bundle **must not** contain any server-side runtime code from the Prisma client or other Node.js-specific libraries.
- Shared runtime values, specifically the `GlucoseUnit` enum, must have a single, definitive source of truth for the _application runtime_ located in `@goodnumbers/common`.
- All changes must be type-safe and validated by the TypeScript compiler across all workspaces.
- The application must continue to function as before, with no changes to user-facing business logic.

## Assumptions & Scope

- **Assumption:** The current monorepo setup using npm workspaces is correctly configured.
- **Assumption:** The existing test suites for both the `frontend` and `backend` workspaces are sufficient to catch any regressions introduced by this refactoring.
- **Scope:**
  - Refactoring the `@goodnumbers/types` package to be a type-only export module.
  - Creating a new, environment-agnostic shared package, `@goodnumbers/common`, for universal runtime values.
  - Creating a runtime definition of the `GlucoseUnit` enum in the new common package, which will be identical to the one in the Prisma schema.
  - Updating all import paths for types and enums across the `frontend`, `backend`, and `prisma` schema.
- **Out of Scope:** This task does not include the implementation of any new features, UI changes, or modifications to business logic.

## Objectives

1.  **Resolve Bundling Error:** Eliminate the `Uncaught ReferenceError: exports is not defined` error in the browser.
2.  **Isolate Server Types:** Architecturally enforce that the `@goodnumbers/types` package can only be used for compile-time type imports by the frontend.
3.  **Centralize Universal Code:** Establish the `@goodnumbers/common` package as the single source of truth for runtime values (like enums) that are safe to be shared across all environments.
4.  **Ensure Correctness:** Verify that the entire application builds, passes all existing tests, and functions correctly after the refactoring.
5.  **Prevent Future Drift:** Implement a new, automated test that guarantees the `GlucoseUnit` enum definitions in the Prisma schema and the common package remain synchronized.

## Risks & Mitigations

- **Risk:** The `GlucoseUnit` enum definitions in `schema.prisma` and `@goodnumbers/common` could drift out of sync over time.
  - **Mitigation:** A new, dedicated integration test will be added to the backend test suite that programmatically reads both files and asserts their enum definitions are identical, failing the build if they diverge.
- **Risk:** Missing an import path during the refactor could lead to compile-time or runtime errors.
  - **Mitigation:** The TypeScript compiler (`tsc --noEmit`) and the full, existing test suites will be used as the primary oracles to verify that all import paths have been updated correctly before the task is considered complete.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Enforce a strict architectural separation between compile-time types (blueprints) and runtime values (live code) within the monorepo's shared packages.
- **Mechanism:**
  1.  **Red:** Create a new test that proves a runtime value can be imported from `@goodnumbers/types`. This test will initially pass.
  2.  **Green (by breaking the test):** Modify `@goodnumbers/types` to use `export type`. This will break the new test (making it "Red") and fix the architectural flaw.
  3.  **Green (by fixing the app):** Create the `@goodnumbers/common` package with the enum. Refactor the frontend and backend to use the new packages. All application tests will now pass again.
  4.  **Refactor:** Delete the temporary test from step 1. Add the new, permanent enum synchronization test.
- **Trade-offs:** This approach requires maintaining two identical copies of the `GlucoseUnit` enum definition (one in Prisma, one in the common package). This is a necessary trade-off to satisfy the constraints of the tooling, but it creates a robust, scalable, and safe architecture.
- **Go-No-Go Decision:** **Go**. This is a critical fix for a blocking architectural flaw.

## Implementation Notes

- **`@goodnumbers/common`:** This new package will contain the `GlucoseUnit` enum definition. It is safe for runtime `import` statements from both the `frontend` and `backend`.
- **`@goodnumbers/types`:** This package will now only use `export type`. Frontend consumers **must** use `import type` when importing from this package.
- **`schema.prisma`:** The `enum GlucoseUnit` definition **must remain** in this file. It is the source of truth for the database. It must be kept manually in sync with the definition in `@goodnumbers/common`.
- **Verification:** The primary runtime guard is the TypeScript compiler. Running `npm run build` in each workspace after the changes is a required verification step.

## Acceptance Gates

1.  The frontend application loads and runs in a development environment (`npm run dev -w frontend`) without the `Uncaught ReferenceError: exports is not defined` error.
2.  The build command for the frontend (`npm run build -w frontend`) completes successfully.
3.  The build command for the backend (`npm run build -w backend`) completes successfully.
4.  All existing tests for the frontend (`npm test -w frontend`) pass.
5.  All existing tests for the backend (`npm test -w backend`) pass.
6.  The new schema synchronization test (`schema-sync.test.ts`) passes, confirming the enums are identical.
7.  The Account Setup page (`/setup`) correctly renders the "Preferred Units" dropdown with "mg/dL" and "mmol/L" options sourced from the new common enum.

## “Make-sure-you” Checklist

- [ ] Have you created the new `packages/common` directory and its configuration files?
- [ ] Have you created the `GlucoseUnit` enum definition in `packages/common/src/enums.ts`?
- [ ] Have you verified that the enum definition in `schema.prisma` is identical to the one in `packages/common`?
- [ ] Have you changed the export in `packages/types/src/index.ts` to use `export type`?
- [ ] Have you added `@goodnumbers/common` as a dependency to `frontend/package.json` and `backend/package.json`?
- [ ] Have you run `npm install` from the project root after updating dependencies?
- [ ] Have you updated all `import` statements for `GlucoseUnit` across the entire codebase to point to `@goodnumbers/common`?
- [ ] Have you added the new `schema-sync.test.ts` file to the backend test suite?

## Project hygiene prep

1.  **Create Issue:**
    ````bash
    gh issue create --title "fix(repo): P5_FIX Refactor shared packages to fix bundling error" --body "Architecturally separate server-only types from universal runtime values to resolve critical 'exports is not defined' frontend error. Closes #XX"
    ```2.  **Create Branch:**
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b fix/phase5-bundling-error
    ````
2.  **TDD Workflow:** Follow the modified **Red → Green → Refactor** cycle as detailed in the engineering plan below. The existing tests serve as a regression suite, while the new tests will guide the refactoring process.

## In-depth test plan

The existing test suites serve as the primary regression oracle for this refactoring task. We will add one temporary test to guide the TDD process and one permanent test to act as an architectural guardrail.

1.  **Temporary TDD Guiding Test:** A new test will be created to prove that `@goodnumbers/types` is exporting a runtime value. This test is expected to pass initially, then fail after our refactoring, providing the "Red" signal in our TDD workflow. It will be deleted at the end of the process.

2.  **New Architectural Guardrail Test: Schema Synchronization:**
    - **Objective:** To prevent the `GlucoseUnit` enum definitions in `schema.prisma` and `@goodnumbers/common` from ever becoming inconsistent.
    - **Mechanism:** A new integration test will be added to the backend. It will:
      1.  Read the `schema.prisma` file as a raw string.
      2.  Use a regular expression to parse the members of the `enum GlucoseUnit` block.
      3.  Import the `GlucoseUnit` enum from `@goodnumbers/common` as a runtime object.
      4.  Get the keys of the imported enum object.
      5.  Assert that the two lists of members are identical.
    - **File:** `backend/tests/integration/schema-sync.test.ts`
    - **Code:**

      ```typescript
      // file: backend/tests/integration/schema-sync.test.ts
      import { describe, it, expect } from "vitest";
      import * as fs from "fs/promises";
      import * as path from "path";
      import { GlucoseUnit } from "@goodnumbers/common";

      describe("Architectural Guardrails", () => {
        it("should ensure the Prisma schema enum and the common enum are synchronized", async () => {
          // 1. Read the Prisma schema file
          const schemaPath = path.resolve(
            __dirname,
            "../../prisma/schema.prisma",
          );
          const schemaContent = await fs.readFile(schemaPath, "utf-8");

          // 2. Parse the enum members from the schema using a regex
          const prismaEnumRegex = /enum\\s*GlucoseUnit\\s*\\{([\\s\\S]+?)\\}/;
          const match = schemaContent.match(prismaEnumRegex);
          expect(
            match,
            "GlucoseUnit enum not found in schema.prisma",
          ).not.toBeNull();

          const prismaMembers = match![1]
            .replace(/\\r\\n/g, "\\n") // Normalize newlines
            .split("\\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("//"));

          // 3. Get the members from the common package's enum
          const commonMembers = Object.keys(GlucoseUnit);

          // 4. Assert they are identical
          expect(prismaMembers).toEqual(commonMembers);
        });
      });
      ```

3.  **Existing Test Suites:**
    - **Backend Integration Tests:** After completing the refactoring of backend imports, run `npm test -w backend`. All tests must pass.
    - **Frontend Unit & Integration Tests:** After completing the refactoring of frontend imports, run `npm test -w frontend`. All tests must pass.

## In-depth engineering plan

### Part 0: Create a Failing Test (The "Red" Step)

**Objective:** Create a test that codifies the architectural problem. It will pass now and fail later, guiding our TDD process.

#### Step 1: Create the Temporary Test

```typescript
// file: packages/types/src/types-package.test.ts
import { describe, it, expect } from "vitest";
// This is a runtime import, which is the problem we need to fix.
import { GlucoseUnit } from "./index";

describe("@goodnumbers/types package integrity", () => {
  it("should not export runtime values like enums", () => {
    // This test proves that GlucoseUnit is a real JavaScript object.
    // It will pass now, but our goal is to make it fail.
    expect(typeof GlucoseUnit).toBe("object");
  });
});
```

Add a test script to `packages/types/package.json` and verify the test passes.

```json
// file: packages/types/package.json
"scripts": {
  "build": "tsc",
  "test": "vitest run"
},
```

```bash
npm install -w @goodnumbers/types vitest
npm test -w @goodnumbers/types
# EXPECTED: Test passes
```

### Part 1: Create the New `@goodnumbers/common` Package

**Objective:** Establish the new, environment-agnostic shared package for the application runtime's source of truth.

#### Step 2: Create Package Structure and Configuration

```bash
mkdir -p packages/common/src
```

```json
// file: packages/common/package.json
{
  "name": "@goodnumbers/common",
  "version": "1.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.9.2"
  }
}
```

```json
// file: packages/common/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src"]
}
```

#### Step 3: Define and Export the `GlucoseUnit` Enum

```typescript
// file: packages/common/src/enums.ts
export enum GlucoseUnit {
  MGDL = "MGDL",
  MMOL = "MMOL",
}
```

```typescript
// file: packages/common/src/index.ts
export * from "./enums.js";
```

### Part 2: Isolate the `@goodnumbers/types` Package

**Objective:** Prevent server-side runtime code from being exported from the types package. This will make our temporary test fail.

#### Step 4: Convert to a Type-Only Package - COMPLETE

Modify the `index.ts` file to use the `export type` syntax.

```diff
--- a/packages/types/src/index.ts
+++ b/packages/types/src/index.ts
-export * from "./generated/client";
+export type {
+  User,
+  Journal,
+  GlycemicEventCluster,
+  Account,
+  Session,
+  VerificationToken,
+} from "./generated/client";
```

Now, run the temporary test again. It will now fail, giving us our "Red" signal.

```bash
npm test -w @goodnumbers/types
# EXPECTED: Test fails with an import error.
```

### Part 3: Update All Consumers (The "Green" Step)

**Objective:** Refactor the rest of the monorepo to use the new package structure, making all application tests pass again.

#### Step 5: Update Dependencies - COMPLETE

```diff
--- a/backend/package.json
+++ b/backend/package.json
   "dependencies": {
     "@auth/express": "^0.5.0",
     "@auth/prisma-adapter": "^2.1.0",
     "@goodnumbers/schemas": "workspace:*",
+    "@goodnumbers/common": "workspace:*",
     "@goodnumbers/types": "workspace:*",
     "bullmq": "^5.8.2",
     "cookie-parser": "^1.4.6",

--- a/frontend/package.json
+++ b/frontend/package.json
   "dependencies": {
     "@goodnumbers/schemas": "file:../packages/schemas",
     "@goodnumbers/types": "file:../packages/types",
+    "@goodnumbers/common": "workspace:*",
     "axios": "^1.7.2",
     "react": "^18.2.0",
     "react-dom": "^18.2.0",
```

Now, install the new dependencies from the project root.

```bash
npm install
```

#### Step 6: Refactor Frontend Imports - COMPLETE

```diff
--- a/frontend/src/contexts/AuthTypes.ts
+++ b/frontend/src/contexts/AuthTypes.ts
 // file: frontend/src/contexts/AuthTypes.ts
-import { type GlucoseUnit } from "@goodnumbers/types";
+import { type GlucoseUnit } from "@goodnumbers/common";

 export interface SessionUser {
   id: string;

--- a/frontend/src/pages/SetupPage.tsx
+++ b/frontend/src/pages/SetupPage.tsx
 import { api } from "../lib/api";
 import { useAuth } from "../hooks/useAuth";
 import { useApiForm } from "../hooks/useApiForm";
-import { type GlucoseUnit } from "@goodnumbers/types";
+import { GlucoseUnit } from "@goodnumbers/common";

 export default function SetupPage() {
   const { user } = useAuth();
```

#### Step 7: Refactor Backend Imports - COMPLETE

```diff
--- a/backend/src/lib/auth.ts
+++ b/backend/src/lib/auth.ts
 import { prisma } from './prisma.js';
 import type { ExpressAuthConfig } from '@auth/express';
 import * as fs from 'fs/promises';
-import type { User } from '@auth/core/types';
+import type { User as AuthUser } from '@auth/core/types';
+import type { User } from '@goodnumbers/types';
+import { GlucoseUnit } from '@goodnumbers/common';

 // --- Email Allowlist Logic ---

@@ -15,7 +18,7 @@
  * @param user The user object from the Auth.js callback.
  * @returns {Promise<boolean>} True if the email is allowed, false otherwise.
  */
-async function isEmailAllowed(user: Partial<User>): Promise<boolean> {
+async function isEmailAllowed(user: Partial<AuthUser>): Promise<boolean> {
   const { email, id } = user;
   if (!email) {
     return false; // Cannot allow a user without an email.
@@ -93,7 +96,7 @@
   interface User {
     agreementsSigned?: boolean;
     nightscoutUrl?: string | null;
     nightscoutTokenLast3?: string | null;
-    preferredUnits?: string;
+    preferredUnits?: GlucoseUnit;
   }
 }

--- a/backend/src/middleware/auth.ts
+++ b/backend/src/middleware/auth.ts
 // Frontend/src/middleware/auth.ts
 import { Request, Response, NextFunction } from 'express';

 import { getSession } from '@auth/express';
 import { authConfig } from '../lib/auth.js';
 import { prisma } from '../lib/prisma.js';
+import { GlucoseUnit } from '@goodnumbers/common';

 // Extend the Request type to include the user property using module augmentation
 declare module 'express-serve-static-core' {
@@ -104,7 +107,7 @@
       agreementsSigned: boolean;
       nightscoutUrl?: string | null;
       nightscoutToken?: string | null;
-      preferredUnits?: 'MGDL' | 'MMOL' | null;
+      preferredUnits?: GlucoseUnit | null;
     };
   }
 }
```

### Part 4: Refactor and Add Permanent Guardrails

**Objective:** Clean up the temporary test and add the new, permanent architectural test.

#### Step 8: Delete the Temporary Test

The test has served its purpose. Delete the file `packages/types/src/types-package.test.ts` and remove the test dependencies from `packages/types/package.json`.

#### Step 9: Add the Permanent Schema Sync Test

Create the file `backend/tests/integration/schema-sync.test.ts` with the code provided in the "In-depth test plan" section above.

#### Step 10: Final Verification

Run all build and test commands from the project root.

```bash
npm run build -w @goodnumbers/common
npm run build -w @goodnumbers/types
npm run build -w backend
npm run build -w frontend
npm test -w backend
npm test -w frontend
```

All commands should pass, including the new `schema-sync.test.ts`. The task is complete.
