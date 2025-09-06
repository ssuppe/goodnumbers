# Goodnumbers — `todo.md` (Phase 2, Task 1 - Security Hardened)

## TL;DR

Integrate Auth.js v5 with the Express backend and Prisma, establishing a security-hardened and professionally tested foundation that includes environment-aware configurations, CSRF validation, and guaranteed data privacy via cascading deletes.

## Invariants (do not change)

- **Authentication Library:** All authentication logic must be implemented using `@auth/express` v5.
- **Test-Driven Development:** All functionality and security controls must be introduced by first writing a failing test that defines the expected behavior.
- **Privacy by Design:** The system must guarantee that when a user account is deleted, all associated sensitive data is irretrievably deleted from the database.
- **Secure by Default:** The application's configuration must favor security in non-production environments (e.g., disabling `trustHost`).

## Assumptions & Scope

- **Assumption: Project State:** This task begins from the state of the project at the completion of Phase 1.
- **Assumption: Credentials:** You have a Google Cloud Project with OAuth 2.0 Client ID and Secret available.
- **Scope:** Backend integration of Auth.js, driven by a comprehensive test suite that now includes critical security and privacy validations.
- **Out of Scope:** Frontend UI, email allowlist logic, session cookie attribute testing (deferred to E2E tests), mutation testing.

## Objectives

1.  **Validate Startup Integrity:** Create a test proving the application fails securely if critical secrets are missing.
2.  **Verify API Contract and CSRF Protection:** Implement an integration test to confirm the Auth.js middleware exposes the correct routes, sets security headers, and correctly rejects `POST` requests that lack a valid CSRF token.
3.  **Enforce Environment-Aware Security:** Implement and test that the `trustHost` setting is safely disabled in development and only enabled in production.
4.  **Guarantee Data Privacy on Deletion:** Implement and test that deleting a `User` record triggers a cascading delete of all their associated `Journal`, `Account`, and `Session` records.
5.  **Achieve Passing Suite:** Ensure all new security, privacy, and functional tests pass, providing a green build for our CI/CD quality gate.

## Risks & Mitigations

- **Risk:** A "Host Header Injection" vulnerability is introduced by incorrectly using `trustHost`.
  - **Mitigation:** The TDD process will enforce the correct, environment-dependent implementation. The unit test will fail if `trustHost` is incorrectly enabled in a non-production environment.
- **Risk:** User's sensitive health data is orphaned in the database after an account is deleted, causing a major privacy violation.
  - **Mitigation:** This risk is addressed immediately in this task. We will write a failing integration test that proves the data is _not_ deleted, then modify the Prisma schema to make the test pass, guaranteeing privacy from the start.

## Project hygiene prep

1.  **Create a GitHub Issue:**
    ```bash
    gh issue create --title "feat(auth): P2_T1 Security-Hardened Auth.js Core Integration" --body "Integrates Auth.js v5 with a test suite hardened by security feedback. Includes CSRF testing, environment-aware config, and data privacy enforcement via cascading deletes. Closes P2_T1."
    ```
2.  **Create a Feature Branch:**
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/P2_T1-authjs-security-hardened
    ```

## In-depth Engineering and Test Plan (TDD Workflow)

---

### **Commit 1: RED — Write Failing Security and Privacy Tests**

First, we codify all new security and privacy requirements as failing tests.

#### **Action 1: Install Testing Dependencies**

```bash
cd goodnumbers
npm install --save-dev fast-check
```

#### **Action 2: Create Startup Integrity and API Contract Tests**

These tests now include a check for CSRF protection.

```typescript
// file: goodnumbers/tests/integration/startup.test.ts
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

describe("Application Startup", () => {
  // ... (This file's content is the same as the previous plan)
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("should throw a fatal error if AUTH_SECRET is not set", async () => {
    delete process.env.AUTH_SECRET;
    await expect(import("../../src/index.js")).rejects.toThrow(
      "FATAL: Environment variable AUTH_SECRET is not set."
    );
  });

  it("should throw a fatal error if GOOGLE_CLIENT_ID is not set", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(import("../../src/index.js")).rejects.toThrow(
      "FATAL: Environment variable GOOGLE_CLIENT_ID is not set."
    );
  });

  it("should throw a fatal error if GOOGLE_CLIENT_SECRET is not set", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    await expect(import("../../src/index.js")).rejects.toThrow(
      "FATAL: Environment variable GOOGLE_CLIENT_SECRET is not set."
    );
  });
});

// file: goodnumbers/tests/integration/auth.test.ts
import request from "supertest";
import { app } from "../../src/index.js";
import * as http from "http";

let server: http.Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

describe("API Contract: Auth.js Endpoints", () => {
  describe("GET /api/auth/signin", () => {
    // ... (tests for HTML content and security headers are the same)
    it("should return the default sign-in page HTML", async () => {
      const response = await request(server).get("/api/auth/signin");
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.text).toContain("Sign in with Google");
    });

    it("should include security headers set by Helmet", async () => {
      const response = await request(server).get("/api/auth/signin");
      expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("CSRF Protection", () => {
    it("POST /api/auth/signout should be rejected without a CSRF token", async () => {
      const response = await request(server).post("/api/auth/signout").send(); // No CSRF token included

      // Auth.js v5 returns a 200 with an error page for this case
      expect(response.status).toBe(200);
      expect(response.text).toContain("CSRFProtection");
    });
  });
});
```

#### **Action 3: Create Environment-Aware Unit Test**

This test enforces the new, safer `trustHost` logic.

```typescript
// file: goodnumbers/tests/unit/auth.test.ts
import { describe, it, expect, jest } from "@jest/globals";

describe("Auth Configuration Properties", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv; // Restore original environment
    jest.resetModules(); // Important to clear module cache
  });

  it("should set trustHost to TRUE only in a production environment", async () => {
    // Test case 1: Production
    process.env.NODE_ENV = "production";
    const { authConfig: prodConfig } = await import("../../src/lib/auth.js");
    expect(prodConfig.trustHost).toBe(true);
  });

  it("should set trustHost to FALSE in a development environment", async () => {
    // Test case 2: Development
    process.env.NODE_ENV = "development";
    const { authConfig: devConfig } = await import("../../src/lib/auth.js");
    expect(devConfig.trustHost).toBe(false);
  });

  it("should set trustHost to FALSE when NODE_ENV is not set", async () => {
    // Test case 3: Unset (defaults to safe)
    delete process.env.NODE_ENV;
    const { authConfig: defaultConfig } = await import("../../src/lib/auth.js");
    expect(defaultConfig.trustHost).toBe(false);
  });
});
```

#### **Action 4: Create Cascading Delete Privacy Test**

This test proves our commitment to user privacy. It will fail until the schema is corrected.

```typescript
// file: goodnumbers/tests/integration/privacy.test.ts
import { PrismaClient } from "@prisma/client";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

const prisma = new PrismaClient();

describe("User Data Privacy", () => {
  let userId: string;
  let journalId: string;
  let accountId: string;
  let sessionId: string;

  beforeAll(async () => {
    // 1. Create a user and all related data
    const user = await prisma.user.create({
      data: {
        email: `test-privacy-${Date.now()}@example.com`,
        accounts: {
          create: {
            type: "oauth",
            provider: "google",
            providerAccountId: `google-id-${Date.now()}`,
          },
        },
        sessions: {
          create: {
            sessionToken: `session-token-${Date.now()}`,
            expires: new Date(Date.now() + 86400 * 1000), // 24 hours from now
          },
        },
        journals: {
          create: {
            status: "COMPLETE",
          },
        },
      },
      include: {
        accounts: true,
        sessions: true,
        journals: true,
      },
    });
    userId = user.id;
    journalId = user.journals[0].id;
    accountId = user.accounts[0].id;
    sessionId = user.sessions[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should delete all related data when a user is deleted", async () => {
    // 2. Delete the user
    await prisma.user.delete({ where: { id: userId } });

    // 3. Assert that all related data is now null (gone)
    const deletedJournal = await prisma.journal.findUnique({
      where: { id: journalId },
    });
    const deletedAccount = await prisma.account.findUnique({
      where: { id: accountId },
    });
    const deletedSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    expect(deletedJournal).toBeNull();
    expect(deletedAccount).toBeNull();
    expect(deletedSession).toBeNull();
  });
});
```

#### **Action 5: Verify Failure and Commit**

Run `npm test`. The new tests will fail. This is our **RED** state.

````bash
cd goodnumbers
npm test
git add .
git commit -m "test(auth): add failing security, privacy, and config tests"```

---

### **Commit 2: GREEN — Implement and Fix**

Now, write the code to make all tests pass.

#### **Action 1: Install Dependencies & Update Environment**

These steps are unchanged.

```bash
cd goodnumbers
npm install @auth/express @auth/prisma-adapter
# Then update your .env and .env.example files
````

#### **Action 2: Update Schema for Cascading Deletes**

Update `prisma/schema.prisma` with `onDelete: Cascade` on **all** relations pointing to the `User` model.

```prisma
// file: goodnumbers/prisma/schema.prisma
// ... (datasource, generator, enums)

model User {
  // ... (fields)
  accounts        Account[]
  sessions        Session[]
  journals        Journal[] // This relation is managed from the Journal model
  // ... (other fields)
}

model Journal {
  // ... (fields)
  userId               String
  // THIS IS THE CRITICAL PRIVACY FIX:
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ... (other fields)
}

// ... (GlycemicEventCluster model)

model Account {
  // ... (fields)
  userId             String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  // ... (fields)
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ... (VerificationToken model)
```

Now, apply the migration.

```bash
cd goodnumbers
npx prisma migrate dev --name feat-privacy-cascades
```

#### **Action 3: Create Singleton Prisma Client & Environment-Aware Auth Config**

Create `src/lib/prisma.ts` as before. Update `src/lib/auth.ts` to implement the secure `trustHost` logic.

```typescript
// file: goodnumbers/src/lib/prisma.ts
// ... (content is the same as previous plan)
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// file: goodnumbers/src/lib/auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "@auth/express/providers/google";
import { prisma } from "./prisma.js";
import { ExpressAuthConfig } from "@auth/express";

export const authConfig: ExpressAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  // THIS IS THE CRITICAL SECURITY FIX:
  trustHost: process.env.NODE_ENV === "production",
};
```

#### **Action 4: Update Express App**

The `src/index.ts` file remains the same as the previous plan, as it already contains the code to make the startup and contract tests pass.

#### **Action 5: Verify Success and Commit**

Run the test suite again. All tests, including the new security and privacy tests, should now pass. This is our **GREEN** state.

```bash
cd goodnumbers
npm test
git add .
git commit -m "feat(auth): P2_T1 implement core auth and privacy controls"
```

---

### **Commit 3: REFACTOR — Review and Clean Up**

The final step is to review the code and tests.

- **Security Review:** Have all of the security engineer's recommendations been addressed? Yes: `trustHost` is environment-dependent and tested; CSRF protection is verified; cascading deletes are implemented and tested.
- **Test Clarity:** Are the test names clear? The `privacy.test.ts` file clearly communicates its critical purpose.
- **Code Quality:** The implementation remains clean and well-organized.

This completes the task. The resulting implementation is not only functional but also demonstrably more secure and privacy-respecting, with a high-quality test suite to prove it.
