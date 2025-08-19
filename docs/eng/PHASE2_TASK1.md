# Implementation Plan: Phase 2, Task 1 - User Authentication with Email Allowlist

**Author:** Tech Lead
**Date:** 2025-08-15
**Task:** [Phase 2, Task 1: Implement User Authentication with Email Allowlist](../IMPLEMENTATION_PLAN.md)
**Related Docs:** [SSO Allowlist Proposal](./SSO_ALLOWLIST_PROPOSAL.md), [Development Process](../DEVELOPMENT_PROCESS.md)

## 1. Overview & Goal

Welcome to your next task! The primary goal of this task is to replace our temporary, site-wide password barrier with a robust, secure, and more maintainable user authentication system. We will integrate **Auth.js** (using the `@auth/express` package) with the Google OAuth provider.

Instead of a shared password, we will restrict access to a specific list of pre-approved beta testers using an **email allowlist**. This is a critical step in moving our application towards a production-ready state. This task involves removing old code, adding new configuration, implementing the core authentication logic, and thoroughly testing the new flow.

This plan will guide you through the entire process, from setting up your local environment to creating the final Pull Request. Please follow each step carefully.

## 2. Step-by-Step Implementation Guide

### Step 0: Prepare Your Local Environment

First, let's ensure your local environment is up-to-date. It is crucial to start any new work from the latest version of the `develop` branch to avoid merge conflicts.

```bash
# Navigate to the project root
cd goodnumbers-workspace

# Switch to the main development branch
git checkout develop

# Pull the latest changes from the remote repository
git pull origin develop
```

### Step 1: Create a GitHub Issue

As per our `DEVELOPMENT_PROCESS.md`, every task must be tracked with a GitHub issue. This provides visibility and a place for discussion.

Execute the following command from your terminal (ensure you have the `gh` CLI tool installed and configured). This will create the issue and link it to our plan.

```bash
# Remember to run this from the goodnumbers-workspace directory
gh issue create \
  --title "feat(auth): P2_T1 implement Auth.js with email allowlist" \
  --body "### Task Description
This task implements Phase 2, Task 1 from the implementation plan.
It involves:
- Removing the `cookie-session` based barrier middleware and associated routes/files.
- Implementing an email-based allowlist check within the Auth.js `signIn` callback.
- Reading allowed emails from a new `config/allowed_emails.txt` file.

This change replaces the temporary site-wide password with a secure, user-specific authentication system for our beta testers.

**Reference:** `docs/eng/PHASE2_TASK1.md`"
```

After running this, the `gh` tool will output the number of the newly created issue. Make a note of this number. For the remainder of this guide, we will use `#XX` as a placeholder for your actual issue number.

### Step 2: Create a New Feature Branch

Now, create a dedicated branch for this work from the `develop` branch. Follow the naming convention `type/issue-number-short-description`.

```bash
# Make sure you are still on the `develop` branch before running this
# Use the real issue number from the previous step.
git checkout -b feat/XX-authjs-email-allowlist
```

You are now on a clean branch, ready to start making changes.

### Step 3: Implementation (Verification-Driven)

We will follow the spirit of Test-Driven Development (TDD). Since setting up automated tests for the full authentication flow is complex for this specific change, our "test" will be a manual, behavior-driven verification process outlined in Step 4. Our goal is to first observe the failure (the old barrier is gone), then write the code to make the new system pass.

#### Sub-step 3.1: Cleanup - Remove the Old Barrier Code

This is the "Red" step. We are intentionally removing the old barrier system. This is a destructive change that will temporarily remove all access control from the application until we add the new Auth.js logic.

First, delete the obsolete files. Run these commands from the `goodnumbers-workspace` directory:

```bash
rm goodnumbers/src/middleware/barrier.ts
rm goodnumbers/src/routes/barrier.ts
rm goodnumbers/public/barrier-login.html
```

Next, remove the barrier middleware from the main server file. This is crucial as the old `cookie-session` middleware conflicts with the session management of `@auth/express`.

Replace the entire content of `goodnumbers/src/index.ts` with the following code. The key change is removing the imports and `app.use()` calls for `cookieSession`, `barrierMiddleware`, and `barrierRouter`.

```typescript
// goodnumbers/src/index.ts
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ExpressAuth } from "@auth/express";
import { authConfig } from "./lib/auth"; // We will modify authConfig later

const app = express();
const port = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --- Static Files ---
app.use(express.static("public"));

// --- Auth.js Middleware ---
// All requests to /api/auth/* will be handled by Auth.js
app.use("/api/auth/*", ExpressAuth(authConfig));

// --- API Routes ---
// Example placeholder for future API routes
app.get("/api/protected-data", (req, res) => {
  // In a real scenario, you'd check req.auth here to ensure user is logged in
  res.json({ message: "This is protected data." });
});

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
    console.error("--- Global Error Handler Caught an Error ---");
    console.error(err.stack);
    res.status(500).send("Something broke!");
  }
);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
```

#### Sub-step 3.2: Configuration - Create the Allowlist File

We need a place to store the email addresses of our approved beta testers.

First, create a new directory named `config` inside the `goodnumbers/` directory. Then, create the `allowed_emails.txt` file inside it.

```bash
# Create the directory from the workspace root
mkdir goodnumbers/config
```

Now, create the file `goodnumbers/config/allowed_emails.txt` and add your Google email address and one or two other test emails. This is crucial for testing later.

```markdown
<!-- goodnumbers/config/allowed_emails.txt -->

# This file contains the list of email addresses allowed to sign in.

# Lines starting with # are comments and will be ignored.

# Add one email per line.

your-google-email@gmail.com
another-allowed-user@example.com
```

#### Sub-step 3.3: Implementation - Add the Allowlist Logic

This is the "Green" step, where we implement the new access control. We will modify `goodnumbers/src/lib/auth.ts` to read our new config file and use the `signIn` callback to check if a user's email is on the list.

Replace the entire contents of `goodnumbers/src/lib/auth.ts` with the code below. The code includes detailed comments to explain each new section.

```typescript
// goodnumbers/src/lib/auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import type { JWT } from "@auth/core/jwt";
import type { Session, DefaultUser } from "@auth/core/types";
import GoogleProvider from "@auth/express/providers/google";

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// --- File path and cache configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWLIST_FILE_PATH = path.join(
  __dirname,
  "../../config/allowed_emails.txt"
);

// Cache variables to store the allowlist in memory.
let cachedAllowedEmails: Set<string> | null = null;
let lastReadTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * --- NEW: Utility function to read and cache the email allowlist ---
 * This function reads the allowed emails from the configuration file.
 * It uses a simple in-memory cache to avoid excessive file I/O.
 * @returns A Promise that resolves to a Set of allowed email strings, normalized to lowercase.
 */
async function getAllowedEmails(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedAllowedEmails && now - lastReadTime < CACHE_DURATION_MS) {
    console.log("[Auth.js] Using cached email allowlist.");
    return cachedAllowedEmails;
  }

  try {
    console.log(`[Auth.js] Reading allowlist from: ${ALLOWLIST_FILE_PATH}`);
    const data = await fs.readFile(ALLOWLIST_FILE_PATH, "utf8");
    const emails = data
      .split("\n")
      .map((line) => line.trim().toLowerCase()) // SECURITY: Normalize to lowercase for case-insensitive matching.
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    // Using a Set provides a minor performance boost for the `.has()` check.
    cachedAllowedEmails = new Set(emails);
    lastReadTime = now;
    console.log(`[Auth.js] SUCCESS: Loaded ${emails.length} allowed emails.`);
    return cachedAllowedEmails;
  } catch (error) {
    console.error(
      `[Auth.js] CRITICAL ERROR: Could not read allowlist file at ${ALLOWLIST_FILE_PATH}. Defaulting to deny all access.`,
      error
    );
    // SECURITY: If the file cannot be read, we must default to a secure state: deny all access.
    cachedAllowedEmails = new Set(); // Cache an empty set to prevent further read attempts
    lastReadTime = now;
    return cachedAllowedEmails;
  }
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    /**
     * --- signIn callback for email allowlist validation ---
     * This callback is executed every time a user attempts to sign in via any provider.
     */
    async signIn({ user, account, profile }) {
      const userEmail = profile?.email;

      if (!userEmail) {
        console.log(
          "[Auth.js] DENIED: Sign-in attempt failed because no email was returned from provider."
        );
        return false;
      }

      // TODO: Before production, remove the logging of PII (userEmail) to protect user privacy.
      // Replace with anonymous logging, e.g., "Sign-in attempt for an allowlisted user succeeded."
      console.log(`[Auth.js] INFO: Attempting sign-in for user: ${userEmail}`);
      const allowedEmails = await getAllowedEmails();

      // SECURITY: Normalize the user's email to lowercase for a case-insensitive check.
      const isAllowed = allowedEmails.has(userEmail.toLowerCase());

      if (isAllowed) {
        console.log(`[Auth.js] ALLOWED: User is in the allowlist.`);
        return true;
      } else {
        console.log(`[Auth.js] DENIED: User is NOT in the allowlist.`);
        return false;
      }
    },
    async jwt({ token, user }: { token: JWT; user?: DefaultUser }) {
      if (user && user.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
```

### Step 4: Verification and Manual Testing

Now, rigorously test the changes to ensure everything works as expected. Restart your development server (`cd goodnumbers && npm run dev`).

**Test Case 1: Positive Test (Allowed User)**

1.  **Action:** Make sure your primary Google email address is listed in `goodnumbers/config/allowed_emails.txt`. Try using mixed-case letters (e.g., Your-Email@gmail.com) in the file to test the case-insensitive logic.
2.  **Action:** Open your browser in an incognito window and navigate to `http://localhost:3000`. You should see the Auth.js login page.
3.  **Action:** Attempt to sign in with the Google account corresponding to your allowed email.
4.  **Expected Result:** You should be successfully authenticated and redirected into the application (e.g., to the dashboard).
5.  **Verification:** Check your server console logs. You should see a message similar to: `[Auth.js] ALLOWED: User is in the allowlist.`

**Test Case 2: Negative Test (Denied User)**

1.  **Action:** Use a different Google account whose email is **NOT** in `goodnumbers/config/allowed_emails.txt`.
2.  **Action:** Open a new incognito window and navigate to `http://localhost:3000`.
3.  **Action:** Attempt to sign in with the disallowed Google account.
4.  **Expected Result:** After the Google login screen, you should be redirected back to an Auth.js error page stating that access is denied. You should **not** be able to access the application.
5.  **Verification:** Check your server console logs. You should see a message similar to: `[Auth.js] DENIED: User is NOT in the allowlist.`

**Test Case 3: Security Test (Missing Allowlist File)**

This test ensures our "deny by default" security posture is working.

1.  **Action:** Stop your server.
2.  **Action:** Temporarily rename the `allowed_emails.txt` file to `allowed_emails.txt.bak`.
3.  **Action:** Start your server again.
4.  **Action:** Attempt to log in with ANY account (even one that was previously allowed).
5.  **Expected Result:** You should be denied access and see the Auth.js error page.
6.  **Verification:** Check the server console logs. You should see the critical error message: `[Auth.js] CRITICAL ERROR: Could not read allowlist file...` followed by the `DENIED` message. This confirms the secure-by-default logic is correct.
7.  **Cleanup:** Don't forget to stop the server and rename the file back to `allowed_emails.txt`.

### Step 5: Commit Your Changes

Once you have verified that all test cases pass, it's time to commit your work. Create a single, clean commit as per our process.

```bash
# Add all the changed, new, and deleted files to the staging area
git add .

# Commit the changes with a message that follows the Conventional Commit standard
git commit -m "feat(auth): P2_T1 implement Auth.js with email allowlist" -m "This commit replaces the legacy site-wide password barrier with a secure email allowlist integrated into the Auth.js signIn callback. It removes old barrier files and middleware, adds a new configuration file for allowed emails, and implements caching and secure-by-default error handling. The allowlist check is now case-insensitive, and the config file is ignored by Git to protect PII."
```

### Step 6: Final Quality & Security Checks

Before pushing, run the required checks from the `goodnumbers` directory as specified in `DEVELOPMENT_PROCESS.md`.

```bash
# Navigate into the project folder
cd goodnumbers

# Run the dependency audit
npm audit
```

Address any high or critical vulnerabilities if found. If none are found, you are clear to proceed. Then, run the test suite to ensure no regressions were introduced.

```bash
# Run all automated tests
npm test
```

If all checks pass, return to the workspace root.

```bash
cd ..
```

### Step 7: Create the Pull Request

Push your branch to the remote repository and open a Pull Request (PR) to merge it into `develop`.

```bash
# Push your branch to the remote repository (e.g., GitHub)
git push origin feat/XX-authjs-email-allowlist

# Create the Pull Request using the gh CLI
# Note the --base flag to ensure it targets the `develop` branch
gh pr create \
 --base develop \
 --title "feat(auth): P2_T1 implement Auth.js with email allowlist" \
 --body "### Description
This PR replaces the temporary `cookie-session` based site barrier with a more robust email allowlist integrated directly into the Auth.js `signIn` callback. This resolves the technical conflict between the two session middlewares and improves the security of access control for beta testers.

The implementation reads approved emails from `goodnumbers/config/allowed_emails.txt` (which is properly `.gitignore`d) and uses a 5-minute cache. The email check is now **case-insensitive**. For security, if the configuration file cannot be read, all sign-in attempts are denied by default.

**Closes #XX** (Replace with the actual issue number you created)

### How to Test

1.  Create `goodnumbers/config/allowed_emails.txt` and add your Google email to it (try using mixed case).
2.  Run the application (`cd goodnumbers && npm run dev`).
3.  Log in with your allowed Google account. **Verify you are granted access.**
4.  Use a different Google account whose email is _not_ on the list.
5.  Log in with that account. **Verify you are denied access and see an error page.**
6.  Stop the server, rename `allowed_emails.txt`, and restart. Attempt to log in with an allowed account. **Verify you are still denied access** and a critical error appears in the server logs."
```

Once the PR is created, please post the link in the team's communication channel for review.
