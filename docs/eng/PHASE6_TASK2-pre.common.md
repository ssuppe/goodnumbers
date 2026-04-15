# REFACTOR_SHARED_PACKAGES_CIRCULAR_DEPENDENCY

## TL;DR

Deconstruct the monolithic `@packages/common` into three strictly layered, **private** packages (`types` → `schemas` → `common`) using a Test-Driven Development (TDD) workflow to eliminate circular build failures and prevent supply chain vulnerabilities.

## Invariants (Do Not Change)

1.  **Strict Unidirectional Flow**:
    - `@goodnumbers/types`: Depends on **nothing**. Pure TS interfaces/enums only.
    - `@goodnumbers/schemas`: Depends on `types`. Zod definitions only.
    - `@goodnumbers/common`: Depends on `schemas` and `types`. Shared logic/utils.
2.  **Private by Default**: All shared packages must explicitly set `"private": true` in `package.json` to prevent accidental publication (Dependency Confusion attacks).
3.  **Single Source of Truth**: Enums (e.g., `GlucoseUnit`) must be defined **only** in `@goodnumbers/types`.
4.  **No Runtime Side-Effects in Types**: `@goodnumbers/types` must contain only TS interfaces/types and simple JS objects (Enums/Constants). No Zod, no external libs.
5.  **TDD Mandate**: You must write a failing test (or compilation check) before moving or creating any code.

## Assumptions & Scope

- **Assumption**: The project uses a workspace manager (npm/yarn/pnpm) configured in root `package.json`.
- **Assumption**: `zod` is the validation library. We will standardize on version `3.23.8` to resolve version conflicts.
- **Scope**: `packages/` directory structure, configuration, and import paths in `frontend`/`backend`.
- **Out of Scope**: Logic changes in `frontend` or `backend` (only import path updates).

## Objectives

1.  **Red-Green-Refactor**: Every step is verified by a specific test case.
2.  **Zero Cycles**: `madge --circular` returns empty.
3.  **Atomic Builds**: `tsc -b` succeeds for individual packages in isolation.
4.  **Security Hardening**: No sensitive server-side types leaked to client bundles; no public registry risks.

## Risks & Mitigations

- **Risk**: **Dependency Confusion**. An attacker registers `@goodnumbers/types` on npm.
  - **Mitigation**: Enforce `"private": true` in all workspace `package.json` files.
- **Risk**: **Data Leakage**. Internal DB types (e.g., password hashes) leaking to frontend bundles.
  - **Mitigation**: Use `"sideEffects": false` in `types/package.json` to enable aggressive tree-shaking. Manually audit `types` to ensure only API-contract data structures are included.
- **Risk**: **Schema Weakness**. Frontend requires loose validation, Backend requires strict.
  - **Mitigation**: Backend must treat shared schemas as a base contract and apply `.strict()` or `.pick()` refinements. Shared schemas define _shape_, not _business rules_.

## Method Outline

1.  **Red Phase (Global)**: Prove the circular dependency exists using an Oracle script.
2.  **Layer 1 (Types)**: TDD creation of `@goodnumbers/types` (Private, No Deps).
3.  **Layer 2 (Schemas)**: TDD creation of `@goodnumbers/schemas` (Private, Depends on Types).
4.  **Layer 3 (Common)**: Refactor `@goodnumbers/common` to consume the above.
5.  **Security Phase**: Audit for secrets and privacy flags.
6.  **Green Phase (Global)**: Verify build order and absence of cycles.

## Implementation Notes

- **Package Names**: `@goodnumbers/types`, `@goodnumbers/schemas`, `@goodnumbers/common`.
- **Tooling**: Use `vitest` for unit tests and `madge` for graph analysis.
- **Clean Slate**: Aggressively clean `node_modules` to prevent ghost dependencies.

## Acceptance Gates

- [ ] `scripts/check-cycles.sh` passes (exit code 0).
- [ ] `scripts/security-check.sh` passes (exit code 0).
- [ ] `npm run build -w @goodnumbers/types` passes.
- [ ] `npm run build -w @goodnumbers/schemas` passes.
- [ ] `npm run build -w @goodnumbers/common` passes.

## "Make-sure-you" Checklist

- [ ] **Delete** `packages/*/node_modules` and `packages/*/dist` before starting.
- [ ] **Verify Privacy**: Ensure `"private": true` is in ALL `package.json` files in `packages/`.
- [ ] **Pin Dependencies**: Ensure `zod` is pinned to `3.23.8` (no `^` or `~`) in root and all workspaces.
- [ ] **Audit Exports**: Ensure `@goodnumbers/types` does NOT export Prisma types or database connection interfaces.
- [ ] Run `npm install` immediately after modifying any `package.json`.

## Project Hygiene Prep

1.  **Clean**: `rm -rf node_modules packages/*/node_modules packages/*/dist`

## In-depth Test Plan

### 1. The Oracle (Cycle Detector)

Create this script immediately. It serves as the ultimate "Red/Green" signal.

**File**: `scripts/check-cycles.sh`

```bash
#!/bin/bash
# Pre-req: npm install -g madge
echo "🔍 Analyzing dependency graph for cycles..."
# We check the source directories to catch logic cycles before compilation
madge --circular --extensions ts packages/types/src packages/schemas/src packages/common/src
```

### 2. Security Auditor

Create this script to enforce security invariants.

**File**: `scripts/security-check.sh`

```bash
#!/bin/bash
# scripts/security-check.sh

EXIT_CODE=0

# 1. Check for accidental exposure of "Password" or "Secret" in shared types
echo "🔍 Scanning shared types for sensitive keywords..."
if grep -rEi "password|secret|token|key" packages/types/src; then
  echo "⚠️  WARNING: Sensitive keywords found in shared types. Verify these are not actual secrets or internal fields."
  # We warn but don't fail, as 'token' might be 'sessionToken' (public) vs 'apiSecret' (private)
fi

# 2. Verify private: true in all packages
echo "🔍 Verifying package privacy..."
for pkg in packages/*; do
  if [ -f "$pkg/package.json" ]; then
    if ! grep -q '"private": true' "$pkg/package.json"; then
      echo "❌ ERROR: $pkg is not marked private! This is a supply chain risk."
      EXIT_CODE=1
    fi
  fi
done

exit $EXIT_CODE
```

### 3. Package-Level Tests

- **Types**: `packages/types/src/types-package.test.ts` (Verifies Enums exist).
- **Schemas**: `packages/schemas/src/schemas-package.test.ts` (Verifies Zod schemas validate data and match Types).
- **Common**: `packages/common/src/common-package.test.ts` (Verifies integration).

## In-depth Engineering Plan

### Phase 0: Establish Baseline (RED)

1.  **Install Analysis Tool**:
    ```bash
    npm install -D madge typescript
    ```
2.  **Run The Oracle**:

    ```bash
    chmod +x scripts/check-cycles.sh
    ./scripts/check-cycles.sh
    ```

    - **Status**: **RED** (Cycles detected or build fails).

### Phase 1: Layer 1 - `@goodnumbers/types`

1.  **Scaffold**:
    ```bash
    mkdir -p packages/types/src
    ```
2.  **Write Test First (RED)**:
    Create `packages/types/src/types-package.test.ts`:

    ```typescript
    import { describe, it, expect } from "vitest";
    // This import will fail compilation initially
    import { GlucoseUnit } from "./index";

    describe("Types Package", () => {
      it("should export GlucoseUnit enum", () => {
        expect(GlucoseUnit.MGDL).toBe("MGDL");
      });
    });
    ```

3.  **Run Test**: `npx vitest run packages/types` -> **FAIL** (Module not found).
4.  **Implement**:
    - Create `packages/types/package.json` (**Note `private: true` and `sideEffects: false`**):
      ```json
      {
        "name": "@goodnumbers/types",
        "version": "1.0.0",
        "private": true,
        "sideEffects": false,
        "main": "./dist/index.js",
        "types": "./dist/index.d.ts",
        "exports": {
          ".": {
            "import": "./dist/index.js",
            "require": "./dist/index.js"
          }
        },
        "scripts": { "build": "tsc -b" },
        "devDependencies": { "typescript": "^5.0.0" }
      }
      ```
    - Create `packages/types/tsconfig.json`:
      ```json
      {
        "extends": "../../tsconfig.base.json",
        "compilerOptions": {
          "outDir": "./dist",
          "rootDir": "./src",
          "composite": true,
          "declaration": true,
          "declarationMap": true
        },
        "include": ["src"]
      }
      ```
    - **Action**: Move `packages/common/src/enums.ts` to `packages/types/src/enums.ts`.
    - **Action**: Create `packages/types/src/index.ts`: `export * from './enums';`
5.  **Run Test**: `npx vitest run packages/types` -> **GREEN**.
6.  **Build**: `npm run build -w @goodnumbers/types` -> **GREEN**.

### Phase 2: Layer 2 - `@goodnumbers/schemas`

1.  **Scaffold**:
    ```bash
    mkdir -p packages/schemas/src
    ```
2.  **Write Test First (RED)**:
    Create `packages/schemas/src/schemas-package.test.ts`:

    ```typescript
    import { describe, it, expect } from "vitest";
    import { GlucoseUnit } from "@goodnumbers/types";
    // This import will fail compilation initially
    import { userSettingsSchema } from "./index";

    describe("Schemas Package", () => {
      it("should validate using Types enum", () => {
        const valid = { preferredUnits: GlucoseUnit.MGDL };
        const result = userSettingsSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });
    });
    ```

3.  **Run Test**: `npx vitest run packages/schemas` -> **FAIL**.
4.  **Implement**:
    - Create `packages/schemas/package.json` (**Note `private: true` and pinned `zod`**):
      ```json
      {
        "name": "@goodnumbers/schemas",
        "version": "1.0.0",
        "private": true,
        "main": "./dist/index.js",
        "types": "./dist/index.d.ts",
        "exports": {
          ".": {
            "import": "./dist/index.js",
            "require": "./dist/index.js"
          }
        },
        "dependencies": {
          "zod": "3.23.8",
          "@goodnumbers/types": "workspace:*"
        },
        "scripts": { "build": "tsc -b" },
        "devDependencies": { "typescript": "^5.0.0" }
      }
      ```
    - Create `packages/schemas/tsconfig.json`:
      ```json
      {
        "extends": "../../tsconfig.base.json",
        "compilerOptions": {
          "outDir": "./dist",
          "rootDir": "./src",
          "composite": true,
          "declaration": true,
          "declarationMap": true
        },
        "references": [{ "path": "../types" }],
        "include": ["src"]
      }
      ```
    - **Action**: Run `npm install` to link workspaces.
    - **Migrate**: Move Zod schemas from `packages/common/src` to `packages/schemas/src/index.ts`.
    - **Refactor**: Update imports in `schemas/src/index.ts` to import Enums from `@goodnumbers/types`.
5.  **Run Test**: `npx vitest run packages/schemas` -> **GREEN**.
6.  **Build**: `npm run build -w @goodnumbers/schemas` -> **GREEN**.

### Phase 3: Layer 3 - `@goodnumbers/common`

1.  **Write Test First (RED)**:
    Create `packages/common/src/common-package.test.ts`:

    ```typescript
    import { describe, it, expect } from "vitest";
    // These imports verify the package can see its dependencies
    import { GlucoseUnit } from "@goodnumbers/types";
    import { userSettingsSchema } from "@goodnumbers/schemas";

    describe("Common Package Integration", () => {
      it("should integrate types and schemas", () => {
        expect(GlucoseUnit).toBeDefined();
        expect(userSettingsSchema).toBeDefined();
      });
    });
    ```

2.  **Run Test**: `npx vitest run packages/common` -> **FAIL** (Dependencies missing).
3.  **Implement**:
    - Update `packages/common/package.json` (**Note `private: true` and pinned `zod`**):
      ```json
      {
        "name": "@goodnumbers/common",
        "version": "1.0.0",
        "private": true,
        "main": "./dist/index.js",
        "types": "./dist/index.d.ts",
        "dependencies": {
          "@goodnumbers/types": "workspace:*",
          "@goodnumbers/schemas": "workspace:*",
          "zod": "3.23.8"
        },
        "scripts": { "build": "tsc -b" },
        "devDependencies": { "typescript": "^5.0.0" }
      }
      ```
    - Update `packages/common/tsconfig.json`:
      ```json
      {
        "extends": "../../tsconfig.base.json",
        "compilerOptions": {
          "outDir": "./dist",
          "rootDir": "./src",
          "composite": true,
          "declaration": true,
          "declarationMap": true
        },
        "references": [{ "path": "../types" }, { "path": "../schemas" }],
        "include": ["src"]
      }
      ```
    - **Action**: Run `npm install`.
    - **Cleanup**: Delete `enums.ts` and schema definitions from `packages/common/src`. Keep only shared utilities.
    - **Re-export**: In `packages/common/src/index.ts`, optionally re-export from types/schemas if you want a single import point (though direct imports are preferred for tree-shaking).
4.  **Run Test**: `npx vitest run packages/common` -> **GREEN**.
5.  **Build**: `npm run build -w @goodnumbers/common` -> **GREEN**.

### Phase 4: Security & Final Verification (GREEN)

1.  **Run Security Check**:

    ```bash
    chmod +x scripts/security-check.sh
    ./scripts/security-check.sh
    ```

    - **Expectation**: "Security checks passed." -> **GREEN**.

2.  **Run The Oracle**:

    ```bash
    ./scripts/check-cycles.sh
    ```

    - **Expectation**: "No circular dependencies found." -> **GREEN**.

3.  **Update Consumers**:
    - Update `frontend/package.json` and `backend/package.json` to depend on `@goodnumbers/types` and `@goodnumbers/schemas`.
    - Run `tsc --noEmit` in frontend and backend to identify broken imports.
    - Fix imports (e.g., `import { GlucoseUnit } from '@goodnumbers/common'` -> `import { GlucoseUnit } from '@goodnumbers/types'`).

4.  **Final Commit**:
    ```bash
    git add .
    git commit -m "refactor: split common into types/schemas/common to fix circular deps and harden security"
    ```
