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

We will follow the spirit of Test-Driven Development (TDD). Since setting up automated tests for the full authentication flow is complex for this
specific change, our "test" will be a manual, behavior-driven verification process outlined in Step 4. Our goal is to first observe the failure (the
old barrier is gone), then write the code to make the new system pass.

#### Sub-step 3.1: Cleanup, Dependency Installation, and Initial Server Setup

This is the "Red" step. We are intentionally removing the old barrier system. This is a destructive change that will temporarily remove all access
control from the application until we add the new Auth.js logic.

First, delete the obsolete files. Run these commands from the
goodnumbers-workspace
directory:
rm goodnumbers/src/middleware/barrier.ts
rm goodnumbers/src/routes/barrier.ts
Note: goodnumbers/public/barrier-login.html will be recreated later.
rm goodnumbers/public/barrier-login.html

Next, install the necessary Auth.js dependencies. Navigate into the
goodnumbers
directory and run
npm install
.
cd goodnumbers
npm install @auth/express @auth/prisma-adapter next-auth
cd ..

Now, remove the barrier middleware from the main server file and set up the initial server structure. This is crucial as the old
cookie-session

     middleware conflicts with the session management of

@auth/express
.

Replace the entire content of
goodnumbers/src/index.ts
with the following code. This includes the correct imports, the
ExpressAuth
route, and a
comprehensive
helmet
CSP configuration.
// goodnumbers/src/index.ts
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ExpressAuth } from "@auth/express";
import { authConfig } from "./lib/auth.ts"; // Note: .ts extension for ESM

const app = express();
const port = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(
helmet({
contentSecurityPolicy: {
directives: {
defaultSrc: ["'self'"],
scriptSrc: ["'self'"], // Add CDN domains if you use them
styleSrc: ["'self'", "'unsafe-inline'"], // Add CDNs if needed. 'unsafe-inline' is often needed for some libraries.
imgSrc: ["'self'", "https://authjs.dev", "https://lh3.googleusercontent.com"], // Auth.js provider images
connectSrc: [
"'self'",
"https://accounts.google.com",
"https://oauth2.googleapis.com",
"https://www.googleapis.com"
], // For Google OAuth communication
formAction: ["'self'", "https://accounts.google.com"], // For Auth.js form submissions and Google OAuth
frameSrc: ["'self'", "https://accounts.google.com"], // For Google OAuth iframes
},
},
})
);

const limiter = rateLimit({
windowMs: 15 60 1000, // 15 minutes
max: 100, // Limit each IP to 100 requests per windowMs
standardHeaders: true,
legacyHeaders: false,
});
app.use(limiter);

// --- Static Files ---
// Ensure the 'public' directory exists and contains an index.html
app.use(express.static("public"));

// --- Auth.js Middleware ---
// All requests to /api/auth/\* will be handled by Auth.js
app.use("/api/auth", ExpressAuth(authConfig)); // Note: No wildcard needed here

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
console.log(Server is running at http://localhost:${port});
});

Finally, create the
public
directory and a basic
index.html
file.
Create the public directory
mkdir goodnumbers/public

Create a basic index.html
echo '<!DOCTYPE html>

  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Goodnumbers</title>
  </head>
  <body>
      <h1>Welcome to Goodnumbers!</h1>
      <p>This is a placeholder page.</p>
      <p>Please navigate to <a href="/api/auth/signin">/api/auth/signin</a> to log in.</p>
  </body>
  </html>' > goodnumbers/public/index.html
 
 #### Sub-step 3.2: Configuration - Create the Allowlist File
 
 We need a place to store the email addresses of our approved beta testers.
 
 First, create a new directory named 
config
 inside the 
goodnumbers/
 directory. Then, create the 
allowed_emails.txt
 file inside it.
  Create the directory from the workspace root
  mkdir goodnumbers/config
 
 Now, create the file 
goodnumbers/config/allowed_emails.txt
 and add your Google email address and one or two other test emails. This is crucial for
     testing later.
  <!-- goodnumbers/config/allowed_emails.txt -->

This file contains the list of email addresses allowed to sign in.

Lines starting with # are comments and will be ignored.

Add one email per line.

your-google-email@gmail.com
another-allowed-user@example.com

#### Sub-step 3.3: Implementation - Add the Allowlist Logic

This is the "Green" step, where we implement the new access control. We will modify
goodnumbers/src/lib/auth.ts
to read our new config file and use
the
signIn
callback to check if a user's email is on the list.

Replace the entire contents of
goodnumbers/src/lib/auth.ts
with the code below. The code includes detailed comments to explain each new section.
// goodnumbers/src/lib/auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import type { JWT } from "@auth/core/jwt";
import type { Session, DefaultUser } from "@auth/core/types";
import GoogleProvider from "@auth/express/providers/google";

import fs from "fs/promises";
import \* as path from "path"; // Corrected: import as namespace for ESM compatibility
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// --- File path and cache configuration ---
const **filename = fileURLToPath(import.meta.url);
const **dirname = path.dirname(\_\_filename);

const ALLOWLIST_FILE_PATH = path.join(
\_\_dirname,
"../../config/allowed_emails.txt"
);

// Cache variables to store the allowlist in memory.
let cachedAllowedEmails: Set<string> | null = null;
let lastReadTime: number = 0;
const CACHE_DURATION_MS = 5 60 1000; // Cache for 5 minutes

/\*\*
_ --- NEW: Utility function to read and cache the email allowlist ---
_ This function reads the allowed emails from the configuration file.
_ It uses a simple in-memory cache to avoid excessive file I/O.
_ @returns A Promise that resolves to a Set of allowed email strings, normalized to lowercase.
\*/
async function getAllowedEmails(): Promise<Set<string>> {
const now = Date.now();
if (cachedAllowedEmails && now - lastReadTime < CACHE_DURATION_MS) {
console.log("[Auth.js] Using cached email allowlist.");
return cachedAllowedEmails;
}

    try {
      console.log([Auth.js] Reading allowlist from: ${ALLOWLIST_FILE_PATH});
      const data = await fs.readFile(ALLOWLIST_FILE_PATH, "utf8");
      const emails = data
        .split("

")
.map((line) => line.trim().toLowerCase()) // SECURITY: Normalize to lowercase for case-insensitive matching.
.filter((line) => line.length > 0 && !line.startsWith("#"));

      // Using a Set provides a minor performance boost for the .has() check.
      cachedAllowedEmails = new Set(emails);
      lastReadTime = now;
      console.log([Auth.js] SUCCESS: Loaded ${emails.length} allowed emails.);
      return cachedAllowedEmails;
    } catch (error) {
      console.error(
        [Auth.js] CRITICAL ERROR: Could not read allowlist file at ${ALLOWLIST_FILE_PATH}. Defaulting to deny all access.,
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
authorization: { params: { prompt: "select_account" } }, // Added: Forces Google account selection
}),
],
session: {
strategy: "jwt",
},
callbacks: {
/\*\*
_ --- signIn callback for email allowlist validation ---
_ This callback is executed every time a user attempts to sign in via any provider.
\*/
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
        console.log([Auth.js] INFO: Attempting sign-in for user: ${userEmail});
        const allowedEmails = await getAllowedEmails();

        // SECURITY: Normalize the user\'s email to lowercase for a case-insensitive check.
        const isAllowed = allowedEmails.has(userEmail.toLowerCase());

        if (isAllowed) {
          console.log([Auth.js] ALLOWED: User is in the allowlist.);
          return true;
        } else {
          console.log([Auth.js] DENIED: User is NOT in the allowlist.);
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

### Step 4: Verification and Manual Testing

Now, rigorously test the changes to ensure everything works as expected. Restart your development server (`cd goodnumbers && npm run dev`).

**Important Testing Notes:**

*   **Clean Testing Environment:** Always use an incognito/private browsing window for testing. If you need to switch accounts or re-test a scenario, close and reopen the incognito window to ensure a clean session.
*   **Environment Variables:** Ensure your `.env` file in the `goodnumbers` directory is correctly configured with `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. For debugging, you can add `AUTH_DEBUG=true` to your `.env` file to get more verbose logs from Auth.js.
*   **Google Cloud Console Configuration:** Double-check your OAuth 2.0 Client ID settings in the Google Cloud Console:
    *   "Web application" type.
    *   "Authorized JavaScript origins": `http://localhost:3000`
    *   "Authorized redirect URIs": `http://localhost:3000/api/auth/callback/google`
*   **Troubleshooting `TypeError: fetch failed`:** If you encounter a `TypeError: fetch failed` on the server side, this indicates a network connectivity issue between your Node.js server and Google's APIs.
    *   **Diagnostic:** Run `curl -v https://oauth2.googleapis.com/token` from the *exact same terminal and environment* where your Node.js server is running. Look for `Could not resolve host`, `Connection timed out`, or `SSL certificate problem`.
    *   **Common Causes:** Firewall, proxy, Docker networking issues, or incorrect Google OAuth credentials/API enablement.
    *   **Resolution:** Address the underlying network issue or Google Cloud Console configuration.

**Test Case 1: Positive Test (Allowed User)**

1.  **Action:** Make sure your primary Google email address is listed in `goodnumbers/config/allowed_emails.txt`. Try using mixed-case letters (e.g., Your-Email@gmail.com) in the file to test the case-insensitive logic.
2.  **Action:** Open your browser in an incognito window and navigate to `http://localhost:3000/api/auth/signin`. You should see the Auth.js login page.
3.  **Action:** Attempt to sign in with the Google account corresponding to your allowed email.
4.  **Expected Result:** You should be successfully authenticated and redirected into the application (e.g., to the dashboard).
5.  **Verification:** Check your server console logs. You should see a message similar to: `[Auth.js] ALLOWED: User is in the allowlist.`

**Test Case 2: Negative Test (Denied User)**

1.  **Action:** Use a different Google account whose email is **NOT** in `goodnumbers/config/allowed_emails.txt`.
2.  **Action:** Open a new incognito window and navigate to `http://localhost:3000/api/auth/signin`.
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

## 3.4 Troubleshooting Common Issues

During the implementation of this task, several common issues were encountered. This section provides guidance on diagnosing and resolving them.

### Module Not Found Errors (`ERR_MODULE_NOT_FOUND`)

*   **Symptom:** Server crashes with `Error: Cannot find package '@auth/express'` or `Error: Cannot find module './lib/auth'` (or similar).
*   **Diagnosis:**
    *   **Missing Dependencies:** Ensure all required `npm` packages (e.g., `@auth/express`, `@auth/prisma-adapter`, `next-auth`) are installed by running `npm install` in the `goodnumbers` directory.
    *   **ESM Module Resolution:** If using ES Modules (`"type": "module"` in `package.json`), ensure local imports include the `.ts` file extension (e.g., `import { authConfig } from "./lib/auth.ts";`).
    *   **Incorrect `path` Import:** Verify that the `path` module is correctly imported as a namespace for ESM compatibility (`import * as path from "path";`).

### `path-to-regexp` Errors (`TypeError: Missing parameter name`)

*   **Symptom:** Server crashes with errors originating from `path-to-regexp` when defining Express routes.
*   **Diagnosis:** This typically occurs when wildcards (`*`) in route paths are not named.
*   **Resolution:** Ensure that any wildcards in `app.use()` or `app.get()` routes are named (e.g., `"/api/auth/*all"`). However, note that `ExpressAuth` expects its base path to be exactly `"/api/auth"` without wildcards.

### 404 Not Found at Root (`Cannot GET /`)

*   **Symptom:** Accessing `http://localhost:3000` results in a 404 error.
*   **Diagnosis:** The `public` directory, which serves static files, is likely missing or empty.
*   **Resolution:** Ensure the `goodnumbers/public` directory exists and contains a basic `index.html` file.

### Content Security Policy (CSP) Violations

*   **Symptom:** Browser console shows `Refused to load the image...` (`img-src`) or `Refused to send form data...` (`form-action`).
*   **Diagnosis:** `helmet`'s default CSP is too restrictive for Auth.js.
*   **Resolution:** Configure `helmet`'s `contentSecurityPolicy` directives to explicitly allow necessary sources. Refer to the `index.ts` code for the comprehensive configuration. Common directives to check: `imgSrc` (for `https://authjs.dev`, `https://lh3.googleusercontent.com`), `connectSrc` (for Google OAuth domains), `formAction` (for `'self'` and `https://accounts.google.com`), and `frameSrc` (for Google OAuth iframes).

### Server-Side `TypeError: fetch failed`

*   **Symptom:** Server crashes with `TypeError: fetch failed` when attempting to sign in, often accompanied by a 500 status code.
*   **Diagnosis:** This indicates a failure in the Node.js server to make an outgoing HTTPS request to Google's OAuth endpoints. This is often due to incorrect parameters being sent to Google, or a misconfiguration in the Google Cloud Console.
*   **Diagnostic Steps:**
    *   Run `curl -v https://oauth2.googleapis.com/token` from the *exact same terminal and environment* where your Node.js server is running. Look for network errors (`Could not resolve host`, `Connection timed out`, `SSL certificate problem`) or HTTP error codes (e.g., 400, 404 from Google).
    *   **Verify Google OAuth Credentials:** Double-check `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, "Authorized JavaScript origins" (`http://localhost:3000`), and "Authorized redirect URIs" (`http://localhost:3000/api/auth/callback/google`) in your Google Cloud Console.
    *   **Enable Google APIs:** Ensure necessary Google APIs (e.g., Google People API) are enabled in your Google Cloud Project.
*   **Resolution:** Address the underlying network issue or Google Cloud Console configuration.

### Persistent Google Session / Account Switching Issues

*   **Symptom:** After logging out from Auth.js, the browser automatically re-authenticates with the last used Google account, preventing full logout or switching to a different Google account.
*   **Diagnosis:** Google maintains its own session in the browser.
*   **Resolution:** Configure the `GoogleProvider` in `auth.ts` to include `authorization: { params: { prompt: "select_account" } }`. This forces Google to present the account selection screen on every sign-in attempt.


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
