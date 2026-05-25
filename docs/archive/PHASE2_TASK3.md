# Goodnumbers — `todo.md`

## TL;DR

Restrict application access to a predefined list of beta testers by implementing a secure, test-driven email allowlist within the Auth.js `signIn` callback.

## Invariants (do not change)

- **Authentication Library:** All authentication logic must be implemented using `@auth/express` v5.
- **Test-Driven Development:** All new functionality must be introduced by first writing a failing test that defines the expected behavior.
- **Secure by Default:** The system must default to denying access if the email allowlist cannot be read or parsed, preventing accidental unauthorized access.
- **Privacy by Design:** The implementation must not log Personally Identifiable Information (PII) to system logs.

## Assumptions & Scope

- **Assumption: Project State:** This task begins from the state of the project at the completion of Phase 2, Task 2. The core Auth.js integration and a session endpoint are already in place.
- **Assumption: File Location:** The allowlist will be a simple text file located at `goodnumbers/config/allowed_emails.txt`.
- **Scope:** This task is strictly limited to the backend implementation of the `signIn` callback and its corresponding unit tests. It does not include any UI changes for denied access.
- **Out of Scope:** Frontend error handling, UI for managing the allowlist, integration testing with a real Google login.

## Objectives

1.  **Codify Requirements as Tests:** Create a comprehensive unit test suite for the `signIn` callback that verifies behavior for allowed users, denied users, and file system errors.
2.  **Implement Allowlist Logic:** Implement the `isEmailAllowed` function and the `signIn` callback in the Auth.js configuration to check a user's email against the allowlist file.
3.  **Enforce Secure Defaults:** Ensure the implementation is "fail-closed," meaning any error in reading or parsing the allowlist file results in denying the sign-in attempt.
4.  **Guarantee User Privacy:** Implement the logic in a way that prevents user email addresses from being written to server logs.
5.  **Achieve Passing Suite:** Ensure all new unit tests pass, maintaining a green build for the CI/CD quality gate.

## Risks & Mitigations

- **Risk:** A misconfigured file path or permissions issue with `allowed_emails.txt` could lock all users out of the application.
  - **Mitigation:** The `signIn` function will include detailed, but PII-free, server-side error logging to make the root cause of access denial immediately obvious to the system administrator.
- **Risk:** Reading the allowlist from the filesystem on every login attempt could cause performance bottlenecks under load.
  - **Mitigation:** The implementation will include a simple time-based in-memory cache to store the set of allowed emails, significantly reducing file I/O operations.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Intercept the Auth.js sign-in flow to validate a user's email against a centrally managed text file before a session is created.
- **Mechanism:**
  1.  **TDD (Test-Driven Development):**
      - **RED:** Write unit tests for the `signIn` callback logic. These tests will use `jest.unstable_mockModule` to mock the `fs/promises` module.
      - **GREEN:** Implement the `signIn` callback in `src/lib/auth.ts`, ensuring it does not log any PII. The logic will read the file, parse it, cache the result, and return `true` or `false`.
      - **REFACTOR:** Review the implementation for clarity, error handling, and security.
- **Trade-offs:** This approach centralizes access control in a simple text file, which is effective for an MVP. The trade-off is that updating the list requires a direct file system change, which is acceptable for the beta phase.
- **Go/No-Go:** Go. The approach is secure, private, testable, and aligns with the project's requirements.

## Implementation Notes

- **Allowlist File:** Located at `goodnumbers/config/allowed_emails.txt`. It's a simple text file where each line is an email address. Lines starting with `#` and empty lines will be ignored.
- **Case-Insensitivity:** All email comparisons must be performed in a case-insensitive manner.
- **Caching:** A simple in-memory `Set` will cache the allowed emails with a 5-minute TTL to reduce file I/O.
- **Mocking ES Modules:** The test plan relies on `jest.unstable_mockModule` and `jest.resetModules()` to correctly mock dependencies and ensure tests are isolated and reliable.

## Acceptance Gates

1.  All new unit tests for the `signIn` callback logic must pass.
2.  Server logs must not contain any user email addresses during the sign-in process.
3.  Manual verification: An attempt to log in with an email present in `allowed_emails.txt` must succeed.
4.  Manual verification: An attempt to log in with an email NOT in `allowed_emails.txt` must fail.

## “Make-sure-you” Checklist

- [ ] Have you created the unit tests **before** writing the implementation code?
- [ ] Does your test suite cover allowed emails, denied emails, and file unreadable errors?
- [ ] Have you verified that your implementation **does not** log user emails?
- [ ] Is your implementation correctly ignoring comments and empty lines in the allowlist file?
- [ ] Is the email comparison case-insensitive?
- [ ] Have you added your own test email to `config/allowed_emails.txt` for manual testing?

## Project hygiene prep

1.  **Create a GitHub Issue:**
    ```bash
    gh issue create --title "feat(auth): P2_T3 Implement Email Allowlist" --body "Restricts application access via a file-based email allowlist in the Auth.js signIn callback. Closes P2_T3."
    ```
2.  **Create a Feature Branch:**
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/P2_T3-email-allowlist
    ```

## A Note on Security and Privacy: Removing PII from Logs

Before you begin writing code, it's crucial to understand a non-negotiable security principle: **we must never log sensitive user information**.

- **What is PII?** Personally Identifiable Information (PII) is any data that can be used to identify a specific individual. A user's email address is a primary example of PII.
- **Why is logging PII bad?** Server logs are often stored for long periods and accessed by multiple systems (monitoring, analytics, etc.). If an email address is in those logs, it can be exposed through a data breach, mishandled by a third-party tool, or misused by an insider. Protecting user privacy is a core responsibility.
- **Your Task:** The implementation for the email allowlist must check a user's email, but it must **not** print that email to the console or any other log.

You will modify the logging to be both safe and useful. Instead of logging the email, you will log the user's internal database ID (`user.id`) if they are an existing user. For a brand new user who doesn't have an ID yet, you will log a generic message. This gives us the ability to trace activity for existing users without exposing their private information.

**Example of what NOT to do:**

```typescript
// BAD: Leaks PII
console.log(`[Auth] Login attempt for ${user.email}. Allowed: YES.`);
```

**Example of the secure approach you will implement:**

```typescript
// GOOD: Safe and private
const identifier = user.id ? `user ID ${user.id}` : "a new user";
console.log(`[Auth] Login attempt for ${identifier}. Allowed: YES.`);
```

This discipline is a sign of a professional engineer. Adhere to it strictly.

## In-depth test plan

The TDD process begins by creating a test file that codifies the requirements for the allowlist feature. We will mock the file system to isolate the logic and reset the module cache between tests to ensure reliability.

```typescript
// file: goodnumbers/tests/unit/auth.allowlist.test.ts
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock the fs/promises module BEFORE importing the auth module that uses it.
// This is critical for ES Modules.
jest.unstable_mockModule("fs/promises", () => ({
  readFile: jest.fn(),
}));

// Now, dynamically import the modules after the mock has been configured.
const { readFile } = await import("fs/promises");

// Type assertion for the mocked function
const mockedReadFile = readFile as jest.Mock;

describe("Auth.js signIn Callback", () => {
  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    mockedReadFile.mockClear();
    // CRITICAL: Reset the module cache to clear the internal in-memory cache
    // within auth.ts, ensuring tests are independent and not flaky.
    jest.resetModules();
  });

  it("should return TRUE for a user whose email is on the allowlist", async () => {
    // Arrange: Simulate a valid allowlist file
    const allowlistContent = "user1@example.com\nuser2@example.com";
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: "user1@example.com" },
    } as any);

    // Assert
    expect(result).toBe(true);
  });

  it("should return FALSE for a user whose email is NOT on the allowlist", async () => {
    // Arrange
    const allowlistContent = "user1@example.com\nuser2@example.com";
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "3", email: "user3@example.com" },
    } as any);

    // Assert
    expect(result).toBe(false);
  });

  it("should handle case-insensitivity correctly", async () => {
    // Arrange
    const allowlistContent = "User.One@Example.COM";
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: "user.one@example.com" },
    } as any);

    // Assert
    expect(result).toBe(true);
  });

  it("should ignore comments and empty lines in the allowlist file", async () => {
    // Arrange
    const allowlistContent = `
      # This is a comment
      user1@example.com

      user2@example.com
    `;
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const allowed = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: "user1@example.com" },
    } as any);
    const denied = await authConfig.callbacks!.signIn!({
      user: { id: "3", email: "# This is a comment" },
    } as any);

    // Assert
    expect(allowed).toBe(true);
    expect(denied).toBe(false);
  });

  it("should return FALSE if the allowlist file cannot be read (secure default)", async () => {
    // Arrange: Simulate a file system error
    mockedReadFile.mockRejectedValue(new Error("File not found"));
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: "user1@example.com" },
    } as any);

    // Assert
    expect(result).toBe(false);
  });

  it("should return FALSE if the user has no email", async () => {
    // Arrange
    const allowlistContent = "user1@example.com";
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: null },
    } as any);

    // Assert
    expect(result).toBe(false);
  });
});
```

## In-depth engineering plan

### Commit 1: RED — Write Failing Unit Tests

First, we codify all requirements as failing tests.

#### **Action 1: Create the Test File**

Create a new file `goodnumbers/tests/unit/auth.allowlist.test.ts` and add the full content from the test plan above.

#### **Action 2: Verify Failure and Commit**

Run the test suite. The tests will fail because the `signIn` callback has not been implemented in `src/lib/auth.ts`. This is our **RED** state.

```bash
cd goodnumbers
npm test
git add .
git commit -m "test(auth): add failing tests for email allowlist"
```

---

### Commit 2: GREEN — Implement and Fix

Now, we write the necessary code to make the tests pass.

#### **Action 1: Create the Allowlist Configuration File**

Create the directory and the file for the allowlist. Add your own email so you can perform a manual test later.

````bash
cd goodnumbers
mkdir config```

````

// file: goodnumbers/config/allowed_emails.txt

# Add emails of beta testers below, one per line.

# Lines starting with # and empty lines are ignored.

your.email@gmail.com

````

#### **Action 2: Update the Auth.js Configuration**

Modify `goodnumbers/src/lib/auth.ts` to include the `signIn` callback and the supporting logic, making sure to follow the secure logging practice.

```typescript
// file: goodnumbers/src/lib/auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "@auth/express/providers/google";
import { prisma } from "./prisma.js";
import type { ExpressAuthConfig } from "@auth/express";
import fs from "fs/promises";
import type { User } from "@auth/express-adapter";

// --- Email Allowlist Logic ---

// In-memory cache to avoid reading the file on every single login attempt.
let allowedEmails: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Checks if a given user's email is in the allowlist.
 * It uses a simple in-memory, time-based cache to reduce file I/O.
 * @param user The user object from the Auth.js callback.
 * @returns {Promise<boolean>} True if the email is allowed, false otherwise.
 */
async function isEmailAllowed(user: Partial<User>): Promise<boolean> {
  const { email, id } = user;
  if (!email) {
    return false; // Cannot allow a user without an email.
  }

  const now = Date.now();
  // Refresh cache if it's empty or expired
  if (!allowedEmails || now - cacheTimestamp > CACHE_TTL) {
    try {
      const fileContent = await fs.readFile(
        "config/allowed_emails.txt",
        "utf-8"
      );
      allowedEmails = new Set(
        fileContent
          .split("\n")
          .map((line) => line.trim().toLowerCase())
          .filter((line) => line && !line.startsWith("#"))
      );
      cacheTimestamp = now;
      console.log("[Auth] Refreshed email allowlist from file.");
    } catch (error) {
      console.error(
        "[CRITICAL AUTH ERROR] Could not read allowed_emails.txt. Defaulting to denying all new sign-ins.",
        error
      );
      allowedEmails = new Set();
    }
  }

  const isAllowed = allowedEmails.has(email.toLowerCase());

  // SECURE LOGGING: Log the user's ID if available, otherwise log a generic message.
  // NEVER log the email address.
  const identifier = id ? `user with ID ${id}` : "a new user";
  console.log(
    `[Auth] Login attempt for ${identifier}. Allowed: ${
      isAllowed ? "YES" : "NO"
    }.`
  );
  return isAllowed;
}

// --- Auth.js v5 Configuration ---

export const authConfig: ExpressAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    async signIn({ user }) {
      return await isEmailAllowed(user);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
````

#### **Action 3: Verify Success and Commit**

Run the test suite again. All tests, including the new allowlist tests, should now pass. This is our **GREEN** state.

```bash
cd goodnumbers
npm test
git add .
git commit -m "feat(auth): P2_T3 implement email allowlist in signIn callback"
```

---

### Commit 3: REFACTOR — Review and Push

The final step is to review the code and prepare the Pull Request.

- **Privacy & Security:** The implementation correctly avoids logging PII. The function uses a secure-by-default (fail-closed) mechanism.
- **Clarity:** The `isEmailAllowed` function is well-documented and separated from the main `authConfig` object.
- **Performance:** The cache prevents unnecessary file I/O.

After a final review and successful manual test, push the branch and create a Pull Request.

```bash
cd goodnumbers
git push origin feat/P2_T3-email-allowlist
gh pr create --base develop --title "feat(auth): P2_T3 Implement Email Allowlist" --body "Closes #<issue_number>. This PR restricts application access via a file-based email allowlist in the Auth.js signIn callback, developed via TDD and with PII-safe logging."
```
