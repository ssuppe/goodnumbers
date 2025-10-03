# Goodnumbers — Phase 5, Task 2

## TL;DR

Extract Zod validation schemas into a new, shared `@goodnumbers/schemas` package to enable type-safe code sharing between the backend and future frontend application.

## Invariants (do not change)

- **Data Segregation**: A user can **only** access data they own. All database queries for specific resources must include a `WHERE userId = '...'` clause.
- **Consistent Validation**: All client-provided inputs, including URL parameters and request bodies, must be validated using the shared Zod schemas before use.
- **Server-Side Authorization**: The server must not trust the client. All access-control decisions must be made and enforced on the server.

## Assumptions & Scope

- **Assumption**: Phase 5, Task 1 (establishing the npm workspaces monorepo structure) has been successfully completed and merged into the `develop` branch.
- **Assumption**: All relevant Zod validation schemas currently reside in a single file: `backend/src/lib/validation.ts`.
- **Scope**: This task is strictly limited to creating the `@goodnumbers/schemas` package and refactoring the `backend` workspace to use it.
- **Out of Scope**: The creation of the `@goodnumbers/types` package is not part of this task. The frontend application does not yet exist, so no frontend refactoring will be performed.

## Objectives

1.  Create a new, buildable npm package named `@goodnumbers/schemas` within the `packages/` directory.
2.  Migrate all Zod schemas from `backend/src/lib/validation.ts` into the new package's entry point.
3.  Refactor the `backend` application to consume all validation schemas from the new `@goodnumbers/schemas` package.
4.  Ensure all existing backend integration tests continue to pass after the refactor, confirming no regressions were introduced.
5.  Update the root `package.json` to include the build command for the new schemas package in the `postinstall` script.

## Risks & Mitigations

- **Risk**: Incorrect package configuration or tsconfig settings could lead to module resolution failures when the backend tries to import the new package.
  - **Mitigation**: This plan provides exact, tested file contents for `package.json` and `tsconfig.json`. The acceptance gates include a successful build of the new package.
- **Risk**: The backend refactoring could miss an import statement, leading to runtime errors or validation bypass.
  - **Mitigation**: The acceptance gates require the entire backend test suite (`npm test -w backend`) to pass, which will fail if any validation logic is broken or missing.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea**: Decouple environment-agnostic validation logic (Zod schemas) from the backend-specific application code.
- **Mechanism**:
  1.  Create a new, self-contained npm workspace (`@goodnumbers/schemas`) inside the `packages/` directory.
  2.  Physically move the validation code from the `backend` package into this new `schemas` package.
  3.  Update the `backend`'s `package.json` to declare a formal workspace dependency on the new `schemas` package.
  4.  Refactor all import paths within the `backend` code to point to the new package name instead of the old relative file path.
  5.  Update the monorepo's root `postinstall` script to build the new package automatically after `npm install`.
- **Trade-offs**: This introduces a small amount of initial complexity by creating another package to manage. However, this is vastly outweighed by the long-term benefits of code reuse, type safety, and a clear separation of concerns, which are critical for maintaining a full-stack application.
- **Go/No-Go**: **Go**. This is a foundational step for full-stack development.

## Implementation Notes

- **New Package Name**: `@goodnumbers/schemas`
- **Package Entry Point**: The main export file will be `packages/schemas/src/index.ts`.
- **Build Output**: The package will be compiled to `./dist/` within its own directory.
- **Backend Dependency**: The `backend/package.json` must be updated to include `"@goodnumbers/schemas": "workspace:*"`.
- **Root `postinstall` Script**: The `postinstall` script in the root `package.json` will be updated to `"npm run build -w @goodnumbers/schemas"`.

## Acceptance Gates

1.  The command `npm run build -w @goodnumbers/schemas` executed from the project root must complete successfully with zero errors.
2.  The file `backend/src/lib/validation.ts` must be deleted.
3.  The command `npm test -w backend` executed from the project root must pass all tests.
4.  The `dependencies` section of `backend/package.json` must contain a dependency on `"@goodnumbers/schemas": "workspace:*"`.
5.  The `postinstall` script in the root `package.json` must be present and correctly configured to build the `@goodnumbers/schemas` package.

## “Make-sure-you” Checklist

- [ ] Run `npm install` from the project root _after_ modifying any `package.json` file to ensure workspace symlinks are updated.
- [ ] Verify that all import statements for schemas in `backend/src/routes/user.ts` and `backend/src/routes/journal.ts` have been changed from `../lib/validation.js` to `@goodnumbers/schemas`.
- [ ] Confirm that the old `backend/src/lib/validation.ts` file has been physically deleted from the filesystem.
- [ ] Check that the root `package.json` `postinstall` script builds `@goodnumbers/schemas` but does _not_ yet include `@goodnumbers/types`.

## Project hygiene prep

1.  **Create a Branch**: Following `DEVELOPMENT_PROCESS.md`, create a new feature branch from the latest `develop` branch.
    ````bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/phase5-task2-shared-schemas
    ```2.  **Create an Issue**: Create a GitHub Issue to track this work.
    ```bash
    gh issue create --title "feat(schemas): P5_T2 create shared schemas package" --body "This work extracts Zod schemas into a shared @goodnumbers/schemas package to enable code sharing between backend and frontend, as per the Phase 5, Task 2 engineering plan."
    ````
2.  **Adopt Test-Driven Development**: This is a refactoring task. The TDD approach is to first establish a baseline, then verify that the baseline is maintained after the refactor.
    - Run `npm test -w backend` before making any changes to ensure the current test suite is passing.
    - After implementing all changes, run `npm test -w backend` again to prove that no functionality has been broken.

## In-depth test plan

This task is a pure refactor. The test plan is to ensure that all existing tests that rely on validation schemas continue to pass after the code has been moved to its new location. No new tests are required.

1.  **Establish Baseline**: Before starting, run the backend test suite to confirm it is in a passing state.
    ```bash
    npm test -w backend
    ```
2.  **Verify Post-Refactor**: After completing the engineering plan, the primary test is to run the exact same command and confirm that all tests still pass. This will validate that the `journal.ts` and `user.ts` routes are correctly importing and using the schemas from the new `@goodnumbers/schemas` package.
    ```bash
    npm test -w backend
    ```

## In-depth engineering plan

### Step 1: Create the Schemas Package Structure

1.  **Create Directories**: In the `packages/` directory at the project root, create the necessary folder structure.
    ```bash
    mkdir -p packages/schemas/src
    ```
2.  **Create `package.json`**: Create the `package.json` file for the new schemas package. This defines the package's name, build script, and dependencies.

    ```json
    // file: packages/schemas/package.json
    {
      "name": "@goodnumbers/schemas",
      "version": "1.0.0",
      "private": true,
      "main": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc"
      },
      "dependencies": {
        "zod": "^4.1.8"
      },
      "devDependencies": {
        "typescript": "^5.9.2"
      }
    }
    ```

3.  **Create `tsconfig.json`**: Create the TypeScript configuration for building this specific package.

    ```json
    // file: packages/schemas/tsconfig.json
    {
      "compilerOptions": {
        "target": "ESNext",
        "module": "ESNext",
        "declaration": true,
        "outDir": "./dist",
        "strict": true,
        "esModuleInterop": true,
        "moduleResolution": "node"
      },
      "include": ["src"],
      "exclude": ["node_modules", "dist"]
    }
    ```

### Step 2: Migrate Schema Code

1.  **Move Code**: Move the entire contents of `backend/src/lib/validation.ts` into a new file: `packages/schemas/src/index.ts`.
2.  **Delete Old File**: Delete the now-empty source file from the backend.
    ```bash
    rm backend/src/lib/validation.ts
    ```

### Step 3: Integrate Package into Backend

1.  **Update Backend Dependencies**: Add the new workspace package to the `backend/package.json` file.

    ```json
    // file: backend/package.json
    {
      // ...
      "dependencies": {
        "@auth/express": "^0.11.0",
        "@auth/prisma-adapter": "^2.10.0",
        "@prisma/client": "^6.14.0",
        "@goodnumbers/schemas": "workspace:*",
        "body-parser": "^1.20.2"
        // ...
      }
      // ...
    }
    ```

2.  **Install**: From the **project root**, run `npm install`. This will create a symlink from `backend/node_modules/@goodnumbers` to your new `packages/schemas` directory.

### Step 4: Refactor Backend Imports

1.  **Update `user.ts`**: Open `backend/src/routes/user.ts` and change the import statement.
    - **From**: `import { userSettingsSchema } from '../lib/validation.js';`
    - **To**: `import { userSettingsSchema } from '@goodnumbers/schemas';`
2.  **Update `journal.ts`**: Open `backend/src/routes/journal.ts` and change the import statement.
    - **From**: `import { journalIdParamSchema } from '../lib/validation.js';`
    - **To**: `import { journalIdParamSchema } from '@goodnumbers/schemas';`

### Step 5: Verify the Refactor

1.  **Build New Package**: From the **project root**, run the build script for the new package to ensure it compiles correctly.
    ```bash
    npm run build -w @goodnumbers/schemas
    ```
2.  **Run Backend Tests**: From the **project root**, run the backend's test suite. All tests should pass.
    ```bash
    npm test -w backend
    ```

### Step 6: Reinstate Postinstall Script

1.  **Update Root `package.json`**: Modify the root `package.json` to add the `postinstall` script, which will now build the schemas package automatically after every `npm install`.

    ```json
    // file: package.json
    {
      "name": "goodnumbers-monorepo",
      "version": "1.0.0",
      "private": true,
      "workspaces": ["backend", "frontend", "packages/*"],
      "scripts": {
        "dev:backend": "npm run dev -w backend",
        "dev:frontend": "npm run dev -w frontend",
        "build:backend": "npm run build -w backend",
        "build:frontend": "npm run build -w frontend",
        "test:backend": "npm test -w backend",
        "test:frontend": "npm test -w frontend",
        "lint": "npm run lint -ws --if-present",
        "postinstall": "npm run build -w @goodnumbers/schemas"
      },
      "devDependencies": {
        "typescript": "^5.9.2"
      }
    }
    ```

### Step 7: Commit Changes

1.  **Commit**: Add all the changed and new files and commit them with a descriptive message.
    ```bash
    git add .
    git commit -m "feat(schemas): P5_T2 create shared schemas package"
    ```
