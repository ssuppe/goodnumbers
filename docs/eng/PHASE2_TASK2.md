### Implementation Plan: Phase 2, Task 2 - Agreement Gate Logic (Revised)

**Author:** Tech Lead
**Date:** 2025-08-17
**Task:** [Phase 2, Task 2: Implement Agreement Gate Logic](../IMPLEMENTATION_PLAN.md)

## 1. Goal

The goal of this task is to implement the backend logic for our mandatory agreement gate. We will modify our authentication flow so that any user who successfully authenticates through our system will automatically have their account marked as having signed the necessary agreements. This is a simple, robust, and idempotent solution that supports the frontend-driven agreement process outlined in the PRD.

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

### Step 1: Create a GitHub Issue & Branch

As per our `DEVELOPMENT_PROCESS.md`, every task must be tracked with a GitHub issue. This provides visibility and a place for discussion.

Execute the following command from your terminal. This will create the issue and link it to our plan.

```bash
# Remember to run this from the goodnumbers-workspace directory
gh issue create \
  --title "feat(auth): P2_T2 implement agreement-on-signin logic" \
  --body "### Task Description
This task implements the backend logic for the mandatory agreement gate, revised to a pre-login flow.

- Add `agreementsSigned` boolean field to the `User` model.
- Modify the Auth.js `signIn` callback to automatically set this flag to `true` for any user who successfully authenticates.
- This approach removes the need for a separate API endpoint and redirect middleware.

**Reference:** `docs/eng/PHASE2_TASK2.md`"
```

After running this, make a note of the new issue number (e.g., `#XX`). Now, create a dedicated branch for this work.

```bash
# Make sure you are still on the `develop` branch before running this
# Use the real issue number from the previous step.
git checkout -b feat/XX-agreement-on-signin
```

### Step 2: Database Schema Change

This step adds the necessary field to our database to track user consent.

First, update the `User` model in `goodnumbers/prisma/schema.prisma` to include the new `agreementsSigned` boolean field. It should default to `false` for any new users created.

```markdown
// file: goodnumbers/prisma/schema.prisma
// --- Auth.js Models ---
// These are the standard models required by Auth.js.
// Do not modify them unless you are following an official Auth.js guide.

model Account {
id String @id @default(cuid())
userId String
type String
provider String
providerAccountId String
refresh_token String? @db.Text
access_token String? @db.Text
expires_at Int?
token_type String?
scope String?
id_token String? @db.Text
session_state String?

user User @relation(fields: [userId], references: [id], onDelete: Cascade)

@@unique([provider, providerAccountId])
}

model Session {
id String @id @default(cuid())
sessionToken String @unique
userId String
expires DateTime
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
identifier String
token String @unique
expires DateTime

@@unique([identifier, token])
}

// --- Application-Specific Models ---

// Enum for type safety on user's preferred glucose units
enum GlucoseUnit {
MGDL
MMOL
}

model User {
id String @id @default(cuid())
name String?
email String? @unique
emailVerified DateTime?
image String?
accounts Account[]
sessions Session[]
journals Journal[]

// Application-specific settings
nightscoutUrl String?
nightscoutToken String? // This will be encrypted
preferredUnits GlucoseUnit @default(MGDL)
rssToken String @unique @default(cuid())

// NEW: Field to track if user has signed the agreements
agreementsSigned Boolean @default(false)
}

model Journal {
id String @id @default(cuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
userId String
user User @relation(fields: [userId], references: [id], onDelete: Cascade)

// Job progress tracking
status String @default("PENDING")
progress Int @default(0)
statusMessage String?

// User-provided subjective inputs
weeklyVibe String?
influencingFactors Json?
goalsForNextWeek String?

// AI-generated content
podcastTitle String?
podcastDescription String?
podcastAudioUrl String?
agpChartData Json?
analysisInsights Json?

// Relation to detailed analysis
clusters GlycemicEventCluster[]

@@index([userId])
}

model GlycemicEventCluster {
id String @id @default(cuid())
journalId String
journal Journal @relation(fields: [journalId], references: [id], onDelete: Cascade)

// Cluster summary data
eventType String
eventCount Int
meanTimeMinutes Int

// Detailed data and user notes
clusterDataJson Json
userNotes String?

@@index([journalId])
}
```

Next, apply this schema change to your local database by running a Prisma migration. Execute this command from the `goodnumbers` directory:

```bash
cd goodnumbers
npx prisma migrate dev --name add-user-agreements-signed
cd ..
```

This will create a new migration file and update your `dev.db` database.

### Step 3: Red - Write the Failing Test

We will use a test-driven approach. Our test will confirm that when the `signIn` callback is invoked for an allowed user, their `agreementsSigned` flag is updated to `true` in the database.

Create a new test file: `goodnumbers/tests/integration/auth.test.ts`.

```markdown
// file: goodnumbers/tests/integration/auth.test.ts
import "dotenv/config";
import { PrismaClient, User } from "@prisma/client";
import { authConfig, getAllowedEmails } from "../../src/lib/auth"; // We will test our actual config

// Mock the getAllowedEmails function to isolate our test
// For this test, we assume the user is always on the allowlist.
jest.mock("../../src/lib/auth", () => {
const originalModule = jest.requireActual("../../src/lib/auth");
return {
...originalModule,
// This mock ensures our test doesn't depend on the file system.
\_\_esModule: true,
// Mock the specific named export
getAllowedEmails: jest
.fn()
.mockResolvedValue(new Set(["test.user@example.com"])),
};
});

describe("Auth.js Callbacks", () => {
let prisma: PrismaClient;
let testUser: User;

beforeAll(() => {
prisma = new PrismaClient();
});

beforeEach(async () => {
// Clean up and create a fresh user before each test
await prisma.user.deleteMany({});
testUser = await prisma.user.create({
data: {
email: "test.user@example.com",
name: "Test User",
agreementsSigned: false, // Explicitly start as false
},
});
});

afterAll(async () => {
// Guard against running in a non-test environment
if (process.env.NODE_ENV === "test") {
await prisma.user.deleteMany({});
}
await prisma.$disconnect();
});

describe("signIn callback", () => {
it("should set agreementsSigned to true for an existing user who logs in", async () => {
// Pre-condition check: ensure the flag is false before the test runs
const userBefore = await prisma.user.findUnique({
where: { id: testUser.id },
});
expect(userBefore?.agreementsSigned).toBe(false);

      // Simulate the data Auth.js provides to the signIn callback
      // This includes the full `user` object with the `id` as the Prisma adapter would provide it.
      const signInParams = {
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
        account: null, // Not needed for our logic
        profile: {
          email: testUser.email!,
        },
      };

      // Directly call the signIn function from our auth configuration
      if (authConfig.callbacks && authConfig.callbacks.signIn) {
        // @ts-ignore - We are simulating the call with only the necessary properties
        const result = await authConfig.callbacks.signIn(signInParams);

        // The callback should return true to allow the sign-in to complete
        expect(result).toBe(true);
      } else {
        throw new Error("signIn callback is not defined in authConfig");
      }

      // Post-condition check: verify the flag was updated in the database
      const userAfter = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(userAfter?.agreementsSigned).toBe(true);
    });

    it("should return false if the user is not on the allowlist", async () => {
      // Arrange: Set up a user whose email is NOT on the mocked allowlist
      const disallowedUser = {
        id: "disallowed-id",
        email: "disallowed.user@example.com",
        name: "Disallowed User",
      };
      const signInParams = {
        user: disallowedUser,
        account: null,
        profile: { email: disallowedUser.email },
      };

      // Act: Directly call the signIn function
      if (authConfig.callbacks && authConfig.callbacks.signIn) {
        // @ts-ignore
        const result = await authConfig.callbacks.signIn(signInParams);
        // Assert: The callback should return false
        expect(result).toBe(false);
      } else {
        throw new Error("signIn callback is not defined in authConfig");
      }
    });

});
});
```

Now, run the test suite from the `goodnumbers` directory. The test will fail because our `signIn` logic doesn't yet update the database. This is our expected **Red** step.

```bash
cd goodnumbers
npm test
cd ..
```

### Step 4: Green - Implement the `signIn` Callback Logic

It's time to add the logic to make our test pass. We will modify the `signIn` callback in `goodnumbers/src/lib/auth.ts` to update the user's `agreementsSigned` flag to `true` right after a successful allowlist check. This version includes critical security and privacy improvements.

Replace the entire content of `goodnumbers/src/lib/auth.ts` with the following code. The new logic and improvements are clearly marked with comments.

```markdown
// file: goodnumbers/src/lib/auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import type { JWT } from "@auth/core/jwt";
import type { Session, DefaultUser } from "@auth/core/types";
import GoogleProvider from "@auth/express/providers/google";

import fs from "fs/promises";
import \* as path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

const **filename = fileURLToPath(import.meta.url);
const **dirname = path.dirname(**filename);
const ALLOWLIST_FILE_PATH = path.join(
**dirname,
"../../config/allowed_emails.txt"
);
let cachedAllowedEmails: Set<string> | null = null;
let lastReadTime: number = 0;
const CACHE_DURATION_MS = 5 _ 60 _ 1000;

export async function getAllowedEmails(): Promise<Set<string>> {
const now = Date.now();
if (cachedAllowedEmails && now - lastReadTime < CACHE_DURATION_MS) {
return cachedAllowedEmails;
}
try {
const data = await fs.readFile(ALLOWLIST_FILE_PATH, "utf8");
const emails = data
.split("\n")
.map((line) => line.trim().toLowerCase())
.filter((line) => line.length > 0 && !line.startsWith("#"));
cachedAllowedEmails = new Set(emails);
lastReadTime = now;
console.log(`[Auth.js] SUCCESS: Loaded ${emails.length} allowed emails.`);
return cachedAllowedEmails;
} catch (error) {
console.error(
`[Auth.js] CRITICAL ERROR: Could not read allowlist file at ${ALLOWLIST_FILE_PATH}.`,
error
);
cachedAllowedEmails = new Set();
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
authorization: { params: { prompt: "select_account" } },
}),
],
session: {
strategy: "jwt",
},
callbacks: {
async signIn({ user, profile }) {
// SECURITY IMPROVEMENT: Use the user ID from the user object for logging,
// not the email. The `user` object is guaranteed to be present here after
// the Prisma adapter has found or created the user.
const userId = user?.id;
const userEmail = profile?.email;

      if (!userEmail || !userId) {
        console.log(
          "[Auth.js] DENIED: Sign-in failed, no email or user ID from provider/adapter."
        );
        return false;
      }

      const allowedEmails = await getAllowedEmails();
      const isAllowed = allowedEmails.has(userEmail.toLowerCase());

      if (!isAllowed) {
        // PRIVACY IMPROVEMENT: Log the user ID, not the email, to prevent leaking PII.
        console.log(
          `[Auth.js] DENIED: User with ID ${userId} is NOT in the allowlist.`
        );
        return false;
      }

      // --- NEW LOGIC FOR AGREEMENT GATE (with Security Improvements) ---
      // If the user is on the allowlist, we ensure their agreement flag is set to true.
      // This is idempotent: it works for newly created users and safely re-asserts
      // for existing users on every login.
      try {
        // ROBUSTNESS IMPROVEMENT: Update the user by their primary key (`id`) instead of email.
        // This is more direct and less ambiguous than relying on a non-primary key field.
        await prisma.user.update({
          where: { id: userId },
          data: { agreementsSigned: true },
        });

        // PRIVACY IMPROVEMENT: Log the user ID, not the email.
        console.log(
          `[Auth.js] INFO: Ensured agreementsSigned is true for user ID ${userId}.`
        );
      } catch (error) {
        // SECURITY IMPROVEMENT: Log a controlled error message and avoid logging the raw error object,
        // which could contain sensitive information.
        console.error(
          `[Auth.js] CRITICAL: Failed to update agreementsSigned for user ID ${userId}. Denying login.`,
          { errorMessage: (error as Error).message }
        );
        // SECURITY: If we can't update the database to confirm agreement,
        // we must not allow the user to log in.
        return false;
      }
      // --- END OF NEW LOGIC ---

      console.log(`[Auth.js] ALLOWED: User with ID ${userId} is in the allowlist.`);
      return true; // Allow sign-in
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

Now, run the tests again. They should all pass! This is our **Green** step.

### Step 5: Manual Verification

While our automated test is great, a quick manual check is always a good idea to ensure everything works end-to-end.

1.  Open your `goodnumbers/prisma/dev.db` file with a SQLite viewer.
2.  Find a user you can log in with (one whose email is in your `allowed_emails.txt`) and manually set their `agreementsSigned` value to `0` (false). Save the change.
3.  Start the server (`cd goodnumbers && npm run dev`).
4.  In an incognito browser window, log in as that user.
5.  After a successful login, refresh your SQLite viewer.
6.  **Expected Result:** The user's `agreementsSigned` value in the database should now be `1` (true). This confirms our logic works perfectly for existing users.

### Step 6: Commit Your Work

Now that the implementation is complete and verified, commit your changes with a message that reflects the new, simplified approach.

```bash
# From the workspace root directory (goodnumbers-workspace)
git add .

# Create the commit
git commit -m "feat(auth): P2_T2 implement agreement-on-signin logic" -m "This commit implements the agreement gate by updating the Auth.js signIn callback. Any user who successfully authenticates will have their 'agreementsSigned' flag set to true in the database. This idempotent approach correctly handles new, existing, and legacy users. Security improvements include updating users by primary key and removing PII from logs. This change removes the need for a separate API endpoint and server-side redirect middleware, simplifying the overall architecture."
```

### Step 7: Create the Pull Request

Finally, push your branch and open a Pull Request against the `develop` branch.

```bash
# Push your branch to the remote
# Replace XX with your issue number
git push origin feat/XX-agreement-on-signin

# Create the pull request
gh pr create \
  --base develop \
  --title "feat(auth): P2_T2 implement agreement-on-signin logic" \
  --body "### Description
This PR implements the revised backend logic for the user agreement gate. The new flow assumes agreement is handled client-side before the sign-in button is enabled.

- The `User` model now has an `agreementsSigned` boolean field.
- The Auth.js `signIn` callback has been updated to automatically set this flag to `true` for any user who successfully authenticates. This is an idempotent operation that works for new and existing users.
- This new design is much simpler and removes the need for the previously planned global middleware and dedicated API endpoint.

**Security & Privacy Improvements:**
- All server-side logging in the authentication flow now uses the non-identifiable `user.id` instead of the user's email to protect PII.
- The database update logic now uses the user's primary key (`id`) for improved robustness.

**Closes #XX** (Replace with your actual issue number)

### How to Test

**Automated Tests:**
1. Run `cd goodnumbers && npm test`. Verify all tests in `tests/integration/auth.test.ts` pass.

**Manual Verification:**
1. Use a SQLite viewer to find a user in `prisma/dev.db` and set their `agreementsSigned` field to `0` (false).
2. Run the application and log in as that user.
3. Check the database again. **Verify** that the `agreementsSigned` field for that user has been updated to `1` (true)."
```
