### A Detailed Step-by-Step Implementation Plan

This plan will guide you through the entire process, from setting up your local environment to creating the final Pull Request. We will follow the `DEVELOPMENT_PROCESS.md` meticulously.

#### Step 0: Prepare Your Local Environment

First, let's ensure your local environment is up-to-date. It's crucial to start any new work from the latest version of the `develop` branch.

```bash
# Navigate to the project root
cd goodnumbers-workspace

# Switch to the main development branch
git checkout develop

# Pull the latest changes from the remote repository
git pull origin develop
```

#### Step 1: Create a GitHub Issue

Every task should be tracked with a GitHub issue. This provides visibility and a place for discussion. We will create an issue for this refactoring task.

Execute the following command from your terminal (ensure you have the `gh` CLI tool installed and configured):

```bash
# Remember to run this from the goodnumbers-workspace directory
gh issue create \
  --title "refactor(auth): P2_T2 replace barrier with Auth.js email allowlist" \
  --body "### Task Description
This task implements the SSO Allowlist proposal (docs/eng/SSO_ALLOWLIST_PROPOSAL.md).
It involves:
- Removing the `cookie-session` based barrier middleware and associated routes/files.
- Implementing an email-based allowlist check within the Auth.js `signIn` callback.
- Reading allowed emails from a new `config/allowed_emails.txt` file.

This change resolves the technical conflict between `cookie-session` and `@auth/express` session management.

**Closes:** [This will be linked by the PR later]"
```

After running this, the `gh` tool will output the number of the issue it created. Make a note of it. For this guide, let's assume it created **issue #15**.

#### Step 2: Create a New Feature Branch

Now, create a dedicated branch for this work, following the naming convention `type/issue-number-short-description`.

```bash
# Make sure you are still on the `develop` branch before running this
# The issue number is an example; use the real one you just created.
git checkout -b refactor/15-authjs-allowlist
```

You are now on a clean branch, ready to start making changes.

#### Step 3: Implementation (Following a Test-Driven Approach)

We will follow the spirit of Test-Driven Development (TDD). Since setting up automated tests for the full authentication flow is complex for this specific change, we will use a manual, behavior-driven verification process which is outlined in detail in Step 4. Our goal is to first observe the failure (a user being denied access), then write the code to make it pass.

**Sub-step 3.1: Create the Allowlist Configuration File**

First, create the new configuration file that will store the emails.

Create a new directory named `config` inside the `goodnumbers/` directory. Then, create the `allowed_emails.txt` file inside it.

```bash
# Create the directory from the workspace root
mkdir goodnumbers-workspace/goodnumbers/config

# Create and open the file in your editor, or use this command:
touch goodnumbers-workspace/goodnumbers/config/allowed_emails.txt
```

Now, add your Google email address and one or two other test emails to this file. This will be crucial for testing later.

```markdown
# goodnumbers-workspace/goodnumbers/config/allowed_emails.txt

# This is a comment and will be ignored.

# Add the primary developer's email for testing.

your-email@gmail.com

# Add another allowed user for testing.

another-user@example.com
```

**Sub-step 3.2: Remove the Old Barrier Code from `index.ts`**

Let's start by removing all the code related to the old `cookie-session` barrier. This is a destructive change that will break the old barrier login, which is what we want.

Replace the entire content of `goodnumbers-workspace/goodnumbers/src/index.ts` with the following code. The key is that we are removing the imports for `cookieSession`, `barrierMiddleware`, and `barrierRouter`, as well as the `app.use()` calls for them.

```typescript
// goodnumbers-workspace/goodnumbers/src/index.ts
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ExpressAuth } from "@auth/express";
import { authConfig } from "./lib/auth"; // Ensure this path is correct

const app = express();
const port = process.env.PORT || 3000;

console.log("--- index.ts: Initializing server ---");

// --- Security Middleware ---
console.log(
  "--- index.ts: Setting up security middleware (Helmet, Rate Limiter) ---"
);
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --- Static Files ---
console.log(
  '--- index.ts: Setting up static file serving from "public" directory ---'
);
app.use(express.static("public"));

// --- Auth.js Middleware ---
// All requests to /api/auth/* will be handled by Auth.js
console.log("--- index.ts: Setting up Auth.js middleware ---");
app.use("/api/auth/*", ExpressAuth(authConfig));

// --- API Routes ---
// Example placeholder for future API routes
app.get("/api/protected-data", (req, res) => {
  // In a real scenario, you'd check req.auth here
  res.json({ message: "This is protected data." });
});

// --- Health Check Endpoint ---
app.get("/health", (req, res) => {
  console.log("--- index.ts: /health endpoint hit ---");
  res.status(200).json({ status: "ok" });
});

// --- Global Error Handler ---
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("--- Global Error Handler Caught an Error ---");
    console.error(err.stack);
    res.status(500).send("Something broke!");
  }
);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log("--- index.ts: Server initialization complete ---");
});
```

**Sub-step 3.3: Implement the Allowlist Logic in `auth.ts`**

This is the core of our task. We will modify `goodnumbers-workspace/goodnumbers/src/lib/auth.ts` to read the new config file and use the `signIn` callback to check the user's email.

Replace the entire contents of the file with the code below. I've added comments to clearly mark the new sections as outlined in the proposal.

```typescript
// goodnumbers-workspace/goodnumbers/src/lib/auth.ts

// --- Core Auth.js and Prisma Imports ---
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import type { JWT } from "@auth/core/jwt";
import type { Session, DefaultUser, User } from "@auth/core/types";
import GoogleProvider from "@auth/express/providers/google";

// --- NEW IMPORTS: Node.js modules for file system and path handling ---
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// --- NEW: File path and cache configuration ---
// ESM-compatible way to get the directory name of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the absolute path to the allowlist file.
// It goes up two directories from 'src/lib/' to 'goodnumbers/', then into 'config/'.
const ALLOWLIST_FILE_PATH = path.join(
  __dirname,
  "../../config/allowed_emails.txt"
);

// Cache variables to store the allowlist in memory and avoid constant file reads
let cachedAllowedEmails: string[] | null = null;
let lastReadTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * --- NEW: Utility function to read and cache the email allowlist ---
 * Reads the allowed email addresses from the allowlist file with caching.
 * @returns A Promise that resolves to an array of allowed email strings.
 */
async function readAllowedEmails(): Promise<string[]> {
  const now = Date.now();
  // If the cache exists and is still fresh, return the cached data immediately.
  if (cachedAllowedEmails && now - lastReadTime < CACHE_DURATION_MS) {
    console.log("[Auth.js] Using cached allowlist.");
    return cachedAllowedEmails;
  }

  try {
    // If cache is stale or doesn't exist, read the file from disk.
    const data = await fs.readFile(ALLOWLIST_FILE_PATH, "utf8");
    const emails = data
      .split("\n")
      .map((line) => line.trim()) // Remove whitespace
      .filter((line) => line.length > 0 && !line.startsWith("#")); // Filter out empty lines and comments

    // Update cache and timestamp
    cachedAllowedEmails = emails;
    lastReadTime = now;
    console.log(
      `[Auth.js] SUCCESS: Loaded ${emails.length} allowed emails from ${ALLOWLIST_FILE_PATH}`
    );
    return emails;
  } catch (error) {
    console.error(
      `[Auth.js] CRITICAL ERROR: Could not read allowlist file at ${ALLOWLIST_FILE_PATH}.`,
      error
    );
    // In case of an error (e.g., file not found), default to a secure state: deny all access.
    cachedAllowedEmails = []; // Cache an empty array
    lastReadTime = now;
    return [];
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
  cookies: {
    sessionToken: {
      name: `__Secure-authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    /**
     * --- NEW: signIn callback for email allowlist validation ---
     * This callback is executed every time a user attempts to sign in.
     * We use it to check if the user's email is on our allowlist.
     */
    async signIn({ user, account, profile }) {
      // The profile object from the OAuth provider contains the email.
      const userEmail = profile?.email;

      if (!userEmail) {
        console.log(
          "[Auth.js] DENIED: Sign-in attempt failed because no email was returned from provider."
        );
        return false; // No email, no access.
      }

      console.log(`[Auth.js] INFO: Attempting sign-in for user: ${userEmail}`);
      const allowedEmails = await readAllowedEmails();
      const isAllowed = allowedEmails.includes(userEmail);

      if (isAllowed) {
        console.log(
          `[Auth.js] ALLOWED: User ${userEmail} is in the allowlist.`
        );
        return true; // Allow the sign-in to proceed.
      } else {
        console.log(
          `[Auth.js] DENIED: User ${userEmail} is not in the allowlist.`
        );
        // Returning false denies the sign-in. Auth.js will handle redirecting the user.
        return false;
      }
    },
    async jwt({ token, user }: { token: JWT; user?: DefaultUser }) {
      if (user && user.id) {
        // User is available during the initial sign-in
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        token.id = user.id;
        token.email = user.email;
        token.agreementsSigned = dbUser?.agreementsSigned ?? false;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        (session.user as any).agreementsSigned =
          token.agreementsSigned as boolean;

        // Clean up default fields we don't need
        delete session.user.name;
        delete session.user.image;
      }
      return session;
    },
  },
};
```

**Sub-step 3.4: Delete Obsolete Barrier Files**

The final cleanup step is to delete the files that are no longer needed.

Run these commands from the `goodnumbers-workspace` directory:

```bash
rm goodnumbers-workspace/goodnumbers/src/middleware/barrier.ts
rm goodnumbers-workspace/goodnumbers/src/routes/barrier.ts
rm goodnumbers-workspace/goodnumbers/public/barrier-login.html
```

Your implementation work is now complete!

#### Step 4: Verification and Manual Testing

Now, we will rigorously test the changes to ensure everything works as expected. Restart your development server (`npm run dev` or similar).

**Test Case 1: Positive Test (Allowed User)**

1.  **Action:** Make sure your email address is listed in `goodnumbers/config/allowed_emails.txt`.
2.  **Action:** Open your browser in an incognito window and navigate to `http://localhost:3000`.
3.  **Action:** Attempt to sign in with the Google account corresponding to your allowed email.
4.  **Expected Result:** You should be successfully authenticated and redirected into the application (e.g., to the agreements page or dashboard).
5.  **Verification:** Check your server console logs. You should see the message: `[Auth.js] ALLOWED: User your-email@gmail.com is in the allowlist.`

**Test Case 2: Negative Test (Denied User)**

1.  **Action:** Use a different Google account whose email is **NOT** in `allowed_emails.txt`.
2.  **Action:** Open a new incognito window and navigate to `http://localhost:3000`.
3.  **Action:** Attempt to sign in with the disallowed Google account.
4.  **Expected Result:** After the Google login screen, you should be redirected back to the login page with an access denied error. You should **not** be able to access the application.
5.  **Verification:** Check your server console logs. You should see the message: `[Auth.js] DENIED: User some-other-user@gmail.com is not in the allowlist.`

**Test Case 3: Error Test (Missing Allowlist File)**

1.  **Action:** Stop your server.
2.  **Action:** Temporarily rename the `allowed_emails.txt` file to `allowed_emails.txt.bak`.
3.  **Action:** Start your server again.
4.  **Verification:** Look at the console logs immediately on startup. You might not see an error yet, but it will appear on the first login attempt.
5.  **Action:** Attempt to log in with ANY account (even one that was previously allowed).
6.  **Expected Result:** You should be denied access.
7.  **Verification:** Check the server console logs. You should see the critical error message: `[Auth.js] CRITICAL ERROR: Could not read allowlist file...` followed by the `DENIED` message. This confirms our "deny by default" security posture is working.
8.  **Cleanup:** Don't forget to stop the server and rename the file back to `allowed_emails.txt`.

#### Step 5: Commit Your Changes

Once you have verified that all test cases pass, it's time to commit your work. We will create a single, clean commit as per our process.

```bash
# Add all the changed and new files to the staging area
git add .

# Commit the changes with a message that follows the Conventional Commit standard
git commit -m "refactor(auth): P2_T2 replace barrier with Auth.js email allowlist"
```

#### Step 6: Final Security Check

Before pushing, run the dependency audit as required by `DEVELOPMENT_PROCESS.md`.

```bash
# Run this from the workspace root, making sure to cd into the project folder
cd goodnumbers && npm audit
```

Address any high or critical vulnerabilities if found. If none are found, you are clear to proceed. Then, return to the workspace root:

```bash
cd ..
```

#### Step 7: Create the Pull Request

Your code is complete, tested, and committed. Now, push your branch to the remote repository and open a Pull Request (PR) to merge it into `develop`.

```bash
# Push your branch to the remote repository (e.g., GitHub)
git push origin refactor/15-authjs-allowlist

# Create the Pull Request using the gh CLI
# Note the --base flag to ensure it targets the `develop` branch
gh pr create \
  --base develop \
  --title "refactor(auth): P2_T2 replace barrier with Auth.js email allowlist" \
  --body "### Description
This PR replaces the temporary `cookie-session` based site barrier with a more robust email allowlist integrated directly into the Auth.js `signIn` callback. This resolves the technical conflict between the two session middlewares and improves the security and maintainability of access control.

The implementation follows the design outlined in `docs/eng/SSO_ALLOWLIST_PROPOSAL.md`.

**Closes #15** (Use the actual issue number here)

### How to Test
1. Add your Google email to `goodnumbers/config/allowed_emails.txt`.
2. Run the application (`npm run dev`).
3. Log in with your Google account. Verify you are granted access.
4. Use a different Google account whose email is *not* on the list.
5. Log in with that account. Verify you are denied access and redirected to the login page with an error."
```
