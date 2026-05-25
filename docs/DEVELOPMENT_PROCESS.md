# Goodnumbers Development Process

**Version:** 2.0 (Monorepo Update)
**Date:** 2025-10-23

## 1. Overview

This document outlines the standardized Git workflow and development process for the Goodnumbers project. Adhering to this process ensures a stable codebase, a clean and understandable version history, and a predictable, quality-driven development cycle. The core of our strategy is a **Feature Branch Workflow** with **Conventional Commits**, targeting a central `develop` integration branch.

## 2. Branching Strategy

Our branching model is designed for clarity and stability, centered around a primary development branch and short-lived feature branches.

### 2.1. Core Branches

- **`main`:** This branch represents the official, production-ready release history. It should only be updated from the `develop` branch during a formal release process. Direct commits to `main` are strictly forbidden.

- **`develop`:** This is the primary integration branch for day-to-day development. It contains the latest delivered development changes for the next release. It must always compile and pass all tests, but it is not considered production-stable until formally promoted to `main`.

### 2.2. Feature Branches

All new work, including features, bug fixes, and chores, must be done on a dedicated feature branch.

- **Creation:** Always create a new feature branch from the latest version of `develop`.

  ```bash
  git checkout develop
  git pull origin develop
  git checkout -b <branch-name>
  ```

- **Naming Convention:** To maintain clarity, branches must be named using the format `type/short-description`. The `type` should align with our commit conventions (see below).
  - **Examples:**
    - `feat/database-schema`
    - `test/add-encryption-utils`
    - `fix/user-settings-endpoint`
    - `chore/update-dependencies`
    - `refactor/auth-middleware`

## 3. Commit Strategy: Conventional Commits

We will adhere to the **Conventional Commits** specification for all commit messages. This creates a readable history and allows for potential automation of versioning and changelogs.

### 3.1. Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

- **`<type>`:** Describes the kind of change.
  - `feat`: A new feature.
  - `fix`: A bug fix.
  - `test`: Adding or correcting tests.
  - `refactor`: A code change that neither fixes a bug nor adds a feature.
  - `docs`: Documentation only changes.
  - `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc).
  - `chore`: Changes to the build process, dependency updates, or other auxiliary tools.

- **`<scope>` (optional):** The section of the codebase affected (e.g., `api`, `db`, `ui`, `auth`).

- **`<subject>`:** A concise, imperative-mood description of the change, always starting with "Phase #, Task #:".

### 3.2. Example Commits

- `feat(db): P1_T2 implement initial prisma schema`
- `test(server): P1_T3 add integration test for /health endpoint`
- `fix(api): P2_T1 enforce ownership on journal deletion endpoint`

## 4. The Pull Request (PR) Process

The Pull Request is the central mechanism for quality control. All code must be reviewed and automatically verified via a PR before it is integrated into the `develop` branch.

### 4.1. Step-by-Step Workflow

1.  **Branch:** Create your feature branch from the latest `develop`.
2.  **Work & Commit:** Complete a single, discrete task from the implementation plan. Tests always come first. Make small, logical commits on your branch using the Conventional Commit format. If after 3 attempts, use Google Search or the context7 MCP tool to find more information.
3.  **Push:** Push your completed feature branch to the remote repository.
4.  **Open a Pull Request:** Open a PR to merge your feature branch into the **`develop`** branch.

### 4.2. PR Quality Standards

- **Title:** The PR title should be clear and follow the Conventional Commit format.
- **Description:** The description must include:
  - A brief summary of **what** was changed and **why**.
  - A link to the related task or issue.
  - A **"How to Test"** section explaining the steps a reviewer can take to verify the changes.
- **Scope:** A PR should be small and focused, representing a single unit of work.

### 4.3. Automated Quality Gates

The repository is configured with a CI/CD pipeline. You must run these checks locally before pushing.

> **Note to Agent:** When running tests, **ALWAYS** use the `:ai` suffix commands listed below. These scripts are optimized for LLM contexts: they use low verbosity (dot reporter), strip color codes, and terminate immediately on the first failure (`--bail 1`) to prevent token waste.

1.  **Linting:**
    - `npm run lint` (runs across all workspaces).

2.  **Type Checking:**
    - `npm run build:backend` and `npm run build:frontend` (verifies types).

3.  **Automated Tests (Token Optimized):**
    - **Run All:** `npm run test:ai` (Recommended: runs all suites, stops at first error).
    - **Backend Only:** `npm run test:backend:ai`
    - **Frontend Only:** `npm run test:frontend:ai`

\*\*A PR must be blocked from merging if any of these checks fail.

    **Environment Variables:**

    GoodNumbers uses a **Cascading Root Environment Strategy**. All configuration lives in the project root:

    1.  `.env` (Local secrets, ignored by git) - **Highest Precedence**
    2.  `.env.[NODE_ENV]` (Environment defaults, tracked in git)
    3.  System/Docker environment variables

    To set up a fresh environment, run `just setup`. This will create your local `.env` from the template. For tests, the system automatically uses `.env.test`.**

### 4.4. Review and Merge Process

1.  **Review:** A teammate must review and approve the PR.
2.  **Merge:** Once the PR is approved and all automated checks have passed, it can be merged into `develop`.
3.  **Merge Strategy:** Use **"Squash and Merge"**.
4.  **Clean Up:** After merging, the feature branch should be deleted from the remote repository.

### 4.5. Security Checks

Before a PR is merged, the author must perform the following security check:

1.  **Dependency Audit:** Run `npm audit` from the project root. Any **high** or **critical** severity vulnerabilities must be addressed.
