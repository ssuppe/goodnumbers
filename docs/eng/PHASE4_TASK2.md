# Goodnumbers — Phase 4, Task 2

## TL;DR

Remove user emails from server-side authentication logs, replacing them with user IDs to enhance privacy and mitigate PII leakage.

## Invariants (do not change)

- No user email addresses may be written to standard output or standard error by the authentication module.
- All log messages for user-specific authentication events must retain a traceable, non-PII user identifier (`userId`).
- The core logic of the email allowlist must remain functionally unchanged.
- The application must continue to deny access securely by default if the allowlist configuration is unreadable.

## Assumptions & Scope

- **Assumption**: The only location where PII (email) is logged during the authentication flow is within the `signIn` callback in `goodnumbers/src/lib/auth.ts`.
- **Assumption**: `userId` is a sufficiently unique and non-personally-identifiable token for logging and debugging purposes.
- **Scope**: This task is strictly limited to modifying logging statements within the `signIn` callback in `goodnumbers/src/lib/auth.ts`. All other files and functions are out of scope.
- **Scope**: The remediation applies only to `console.log` and `console.error` statements. Integration with a formal, structured logging library is out of scope for this task.

## Objectives

1.  Modify all `console.log` and `console.error` statements in `goodnumbers/src/lib/auth.ts` to log `userId` instead of `userEmail`.
2.  Validate through manual testing that a successful login with an allowlisted user no longer prints the user's email to the server console.
3.  Validate through manual testing that a denied login with a non-allowlisted user no longer prints the user's email to the server console.
4.  Confirm that the corresponding `userId` is present in all modified log messages to ensure traceability for debugging.

## Risks & Mitigations

- **Risk**: A log statement containing PII is missed.
  - **Mitigation**: Perform a mandatory string search for the `userEmail` variable within `goodnumbers/src/lib/auth.ts` before committing to ensure all instances have been remediated.
- **Risk**: Debugging authentication issues becomes more difficult without the email address directly in the logs.
  - **Mitigation**: Ensure the `userId` is consistently logged in every message where the email was previously, providing a reliable and traceable identifier that can be correlated back to a user if necessary.
- **Risk**: Accidental modification of the core authorization logic breaks the allowlist functionality.
  - **Mitigation**: The code change must be surgical, only replacing variables within existing log calls. The full automated test suite must be run to catch any regressions in functionality.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea**: Eliminate the logging of user email addresses during the authentication process to protect user privacy.
- **Mechanism**: In `goodnumbers/src/lib/auth.ts`, the `signIn` callback currently logs the `userEmail` variable for both successful and failed authentication attempts. This will be changed to log the `userId` variable, which is already available in the function's scope. This preserves the traceability of the log event without exposing PII.
- **Trade-offs**:
  - **Pro**: Significantly improves user privacy and reduces the security risk associated with storing or transmitting logs containing PII. This aligns with data minimization principles.
  - **Con**: Debugging a specific user's login issue may require an extra step to look up the user by their ID. This is a standard and acceptable operational practice for protecting PII.
- **Go/No-Go**: **Go**. The privacy and security benefits are critical and far outweigh the minor operational adjustment for debugging.

## Implementation Notes

- **Target File**: `goodnumbers/src/lib/auth.ts`
- **Target Function**: The `signIn` callback within the `authConfig` object.
- **Variable Mapping**: The `userId` variable is already available in the function scope. No new data fetching is required.
- **Precision**: The change must be a direct 1-to-1 replacement of the `userEmail` variable with `userId` inside any `console.*` call strings. The surrounding log message text should be updated for clarity (e.g., "User" -> "User with ID").

## Acceptance Gates

- **Pass**: A code review confirms that no `console.log` or `console.error` calls in `goodnumbers/src/lib/auth.ts`'s `signIn` callback reference the `userEmail` variable.
- **Pass**: A manual test of a successful login with an allowlisted user shows server logs containing the correct `userId` and **no** email address.
- **Pass**: A manual test of a failed login with a non-allowlisted user shows server logs containing the correct `userId` and **no** email address.
- **Pass**: The full automated test suite (`npm test`) completes successfully, confirming no regressions were introduced.

## “Make-sure-you” Checklist

- [ ] Have you searched the entire `src/lib/auth.ts` file for the string `userEmail` to ensure all logging instances are caught?
- [ ] Have you confirmed that the `userId` variable is correctly scoped and available in all log statements where it is used?
- [ ] Have you executed the manual verification steps for both a successful login and a denied login?
- [ ] Have you confirmed that the new log output is still clear and useful for debugging purposes?
- [ ] Have you run the automated test suite to ensure that the core allowlist logic remains unchanged and fully functional?

## Project hygiene prep

1.  **Create a GitHub Issue**: Use the `gh` CLI to create an issue to track this task.
    ```bash
    gh issue create --title "fix(auth): P4_T2 Remediate PII in server logs" --body "Removes user emails from all console logs in the Auth.js signIn callback, replacing them with the non-PII userId for improved privacy and security."
    ```
2.  **Create a Feature Branch**: Create a new branch from `develop`, including the issue number.
    ```bash
    # Replace 'ISSUE_NUMBER' with the number of the issue you just created
    git checkout develop
    git pull origin develop
    git checkout -b fix/ISSUE_NUMBER-remove-pii-logs
    ```
3.  **Follow a Test-Driven Approach**: Although this change is primarily validated manually, ensure the automated tests are run before and after the change to guarantee no regressions.

## In-depth test plan

### Manual Verification Strategy

This is the primary method for validating the objective.

1.  **Test Case 1: Successful Login (Allowlisted User)**

    - **Precondition**: Ensure your primary Google email address is present in the `goodnumbers/config/allowed_emails.txt` file.
    - **Steps**:
      1.  In your terminal, navigate to the `goodnumbers` directory: `cd goodnumbers`.
      2.  Start the development server: `npm run dev`.
      3.  In your browser, attempt to sign in with your allowlisted Google account.
      4.  Observe the server console output in your terminal.
    - **Expected Result**:
      - The login succeeds.
      - A log message similar to `[Auth.js] ALLOWED: User with ID <your-user-id> is in the allowlist.` is printed.
      - Crucially, **no log message containing your email address is printed** by the `signIn` callback.

2.  **Test Case 2: Denied Login (Non-Allowlisted User)**
    - **Precondition**: Ensure an alternate Google email address you have access to is **not** in `goodnumbers/config/allowed_emails.txt`.
    - **Steps**:
      1.  Ensure the development server is running.
      2.  In a different browser profile or incognito window, attempt to sign in with the non-allowlisted Google account.
      3.  Observe the server console output in your terminal.
    - **Expected Result**:
      - The login is denied by the application.
      - A log message similar to `[Auth.js] DENIED: User with ID <user-id-of-denied-user> is NOT in the allowlist.` is printed.
      - Crucially, **no log message containing the denied email address is printed**.

### Automated Regression Testing

1.  **Goal**: Verify that the core logic of the authentication and authorization system has not been broken.
2.  **Action**: Run the full Jest test suite from the `goodnumbers` directory.
    ```bash
    cd goodnumbers && npm test
    ```
3.  **Expected Result**: All existing tests must pass. No changes to the test files are expected for this task.

## In-depth engineering plan

1.  **Locate Target File**: Open the file `goodnumbers/src/lib/auth.ts` in your code editor.

2.  **Identify Target Function**: Navigate to the `signIn` callback function within the `authConfig` object.

3.  **Apply Code Changes**: Replace the contents of `goodnumbers/src/lib/auth.ts` with the following code. The changes replace `userEmail` with `userId` in all logging statements and adjust the messages for clarity.

    ```typescript
    // file: goodnumbers/src/lib/auth.ts
    import { PrismaAdapter } from "@auth/prisma-adapter";
    import type { JWT } from "next-auth/jwt";
    import type { Session, DefaultUser, User, Profile } from "next-auth";
    import type { AuthOptions } from "next-auth";

    interface GoogleProfile extends Profile {
      picture?: string;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    import GoogleProvider from "@auth/express/providers/google";

    import { readFile } from "fs/promises";
    import * as path from "path";
    import { fileURLToPath } from "url";
    import { prisma } from "../db.js"; // Import the shared Prisma client

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const ALLOWLIST_FILE_PATH = path.join(
      __dirname,
      "../../config/allowed_emails.txt"
    );
    let cachedAllowedEmails: Set<string> | null = null;
    let lastReadTime: number = 0;
    const CACHE_DURATION_MS = 5 * 60 * 1000;

    export async function getAllowedEmails(): Promise<Set<string>> {
      const now = Date.now();
      if (cachedAllowedEmails && now - lastReadTime < CACHE_DURATION_MS) {
        return cachedAllowedEmails;
      }
      try {
        const data = await readFile(ALLOWLIST_FILE_PATH, "utf8");
        const emails = data
          .split("\n")
          .map((line) => line.trim().toLowerCase())
          .filter((line) => line.length > 0 && !line.startsWith("#"));
        cachedAllowedEmails = new Set(emails);
        lastReadTime = now;
        console.log(
          `[Auth.js] SUCCESS: Loaded ${emails.length} allowed emails.`
        );
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

    export const authConfig: AuthOptions = {
      adapter: PrismaAdapter(prisma),
      providers: [
        {
          id: "google",
          name: "Google",
          type: "oauth",
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          authorization: { params: { prompt: "select_account" } },
          profile(profile: GoogleProfile) {
            // Ensure id is always a string. Google's 'sub' should always be present.
            if (!profile.sub) {
              throw new Error("Google profile 'sub' (ID) is missing.");
            }
            return {
              id: profile.sub as string,
              name: profile.name,
              email: profile.email,
              // Google's profile includes a 'picture' property for the user's avatar.
              image: profile.picture ?? "",
            };
          },
        },
      ],
      session: {
        strategy: "jwt",
      },
      callbacks: {
        async signIn({ user, profile }: { user: User; profile?: Profile }) {
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
            console.log(
              `[Auth.js] DENIED: User with ID ${userId} is NOT in the allowlist.`
            );
            return false;
          }

          // If the user is on the allowlist, ensure their agreement flag is set to true.
          try {
            await prisma.user.update({
              where: { id: userId },
              data: { agreementsSigned: true },
            });

            console.log(
              `[Auth.js] INFO: Ensured agreementsSigned is true for user ID ${userId}.`
            );
          } catch (error) {
            console.error(
              `[Auth.js] CRITICAL: Failed to update agreementsSigned for user ID ${userId}. Denying login.`,
              { errorMessage: (error as Error).message }
            );
            // If we can't update the database, we must not allow the user to log in.
            return false;
          }

          console.log(
            `[Auth.js] ALLOWED: User with ID ${userId} is in the allowlist.`
          );
          // Allow sign-in
          return true;
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

4.  **Verify Changes**: Execute the manual and automated test plans detailed above to confirm the changes are correct and have not introduced any regressions.

5.  **Commit and Create Pull Request**: Once verification is complete, commit the changes and open a pull request.
    ```bash
    git add src/lib/auth.ts
    git commit -m "fix(auth): P4_T2 remove pii from server logs"
    git push origin fix/ISSUE_NUMBER-remove-pii-logs
    gh pr create --base develop --title "fix(auth): P4_T2 Remediate PII from server logs" --body "Closes #ISSUE_NUMBER. Replaces user email with userId in all auth-related server logs to enhance privacy."
    ```
