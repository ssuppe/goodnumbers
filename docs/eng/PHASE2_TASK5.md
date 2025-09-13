# Goodnumbers — `todo.md`

## TL;DR

Implement a hardened, secure, test-driven `PUT /api/user/settings` endpoint to manage user preferences and encrypted Nightscout credentials, complete with an updated, XSS-safe placeholder UI for manual verification.

## Invariants (do not change)

- **Test-Driven Development:** All functionality must be introduced by first writing a failing integration test that defines the expected API behavior and data transformations.
- **Server-Side Enforcement:** All validation and authorization logic must be enforced on the server.
- **Privacy by Design:** Sensitive credentials (`nightscoutToken`) MUST be encrypted at rest using the established `encrypt` utility.
- **Secure Rendering:** All user-controlled data rendered in server-side templates MUST be HTML-escaped to prevent Cross-Site Scripting (XSS) vulnerabilities.

## Assumptions & Scope

- **Assumption: Project State:** This task begins from the state of the project at the completion of Phase 2, Task 4. The `protect` middleware, `encrypt`/`decrypt` utilities, and the `express-rate-limit` package are available and functional.
- **Assumption: Validation Library:** The project will use `zod` for schema-based input validation. `{{ZOD_SCHEMA_LIBRARY}}` = `zod`.
- **Scope:** This task includes creating a new API endpoint, writing a comprehensive integration test suite, and updating the temporary placeholder UI on the `/agreements` and `/setup-account` pages with explicit security controls.
- **Out of Scope:** A production-ready frontend UI, E2E browser testing for the placeholder UI.

## Objectives

1.  **Codify API Contract as a Test:** Create a new integration test suite for the user settings API that verifies success cases, invalid data handling, unauthorized access, and the correct encryption of sensitive data.
2.  **Implement Secure Endpoint:** Implement the `PUT /api/user/settings` endpoint, ensuring it uses the `protect` middleware for authentication and `zod` for strict input validation.
3.  **Guarantee Data Encryption:** Ensure the implementation correctly uses the `encrypt` utility for the `nightscoutToken` before persisting it to the database.
4.  **Implement Defense-in-Depth:** Harden the endpoint with a strict, specific rate limiter to prevent abuse and add explicit authorization comments for future code maintainability.
5.  **Provide Secure Manual Test Interface:** Update the placeholder UI on the `/setup-account` route to be secure against Stored XSS attacks by implementing server-side HTML escaping.

## Risks & Mitigations

- **Risk: (HIGH) Stored XSS vulnerability** from a malicious `nightscoutUrl` containing executable code.
  - **Mitigation:** Implement a server-side HTML escaping utility and apply it to all user-controlled data that is rendered in the placeholder UI's HTML template. This is a non-negotiable security requirement.
- **Risk:** (Medium) Sensitive `nightscoutToken` is accidentally stored as plaintext in the database.
  - **Mitigation:** The TDD process requires writing a test that explicitly fetches the data post-update and asserts that the stored value is **not** the plaintext token. The test will fail if encryption is not implemented correctly.
- **Risk:** (Medium) API abuse through rapid, repeated requests to the settings endpoint.
  - **Mitigation:** Apply a strict, endpoint-specific rate limiter to the `PUT /api/user/settings` route, configured with a low threshold appropriate for a settings page.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Create a single, unified, and security-hardened API endpoint for managing all mutable user settings.
- **Mechanism:**
  1.  **TDD (Test-Driven Development):**
      - **RED:** Write a comprehensive integration test for `PUT /api/user/settings`. The test will now include a case to verify rate-limiting behavior.
      - **GREEN:** Implement the API route using the `protect` middleware, a hardened `zod` schema (allowing `nulls`), conditional encryption logic, specific rate limiting, and Prisma for the database update.
      - **REFACTOR:** Clean up the implementation and add a final manual verification step.
  2.  **Manual Verification:**
      - Create an HTML escaping utility.
      - Modify the placeholder routes in `src/index.ts` to use this utility, rendering XSS-safe HTML forms with corrected client-side JavaScript.
- **Trade-offs:** This approach adds a small amount of upfront work (creating a utility function, configuring a rate limiter) in exchange for a significant increase in the application's security posture. This is a highly favorable trade-off.
- **Go/No-Go:** Go. The hardened plan is superior and necessary.

## Implementation Notes

- **API Endpoint:** `PUT /api/user/settings`
- **Rate Limiting:** Apply a unique `rateLimit` instance to the `/settings` route, configured for a low request threshold (e.g., 20 requests per 15 minutes).
- **XSS Prevention:** A utility function for HTML escaping must be created in `src/lib/utils.ts` and used for any user data injected into the placeholder UI's HTML strings.
- **Authorization Comment:** A specific, formatted comment explaining the reliance on the `protect` middleware must be added to the route handler for clarity and to prevent future maintenance errors.
- **API Consolidation:** The existing `POST /api/user/agreements` route will be removed, and its logic will be consolidated into this new endpoint.

## Acceptance Gates

1.  The new integration test suite (`user.test.ts`) passes with 100% success.
2.  The new test that verifies rate limiting behavior passes, confirming `429 Too Many Requests` responses are sent.
3.  Manual inspection of the `/setup-account` page's HTML source confirms that special characters in the pre-filled URL are escaped (e.g., `"` becomes `&quot;`).
4.  Manually submitting the form on the `/setup-account` page with empty values successfully clears the corresponding fields in the database.
5.  The value for `nightscoutToken` in the `dev.db` file is verified to be an encrypted string, not plaintext.

## “Make-sure-you” Checklist

- [ ] Have you created the integration test **before** writing the API implementation?
- [ ] Does your new test suite verify that exceeding the rate limit returns a `429` status code?
- [ ] Have you created and used an HTML escaping utility for the placeholder UI?
- [ ] Have you added the required security comment about middleware dependency in the route handler?
- [ ] Does your API logic contain a conditional check to ensure `encrypt()` is never called with a `null` value?
- [ ] Have you performed the full manual test flow, including attempting to save malicious input like `<script>alert(1)</script>` in the URL field?

## Project hygiene prep

1.  **Create a GitHub Issue:**
    ```bash
    gh issue create --title "feat(api): P2_T5 Implement User Settings API" --body "Creates a secure, protected PUT /api/user/settings endpoint for managing Nightscout credentials and preferences, developed via TDD. Closes P2_T5."
    ```
2.  **Create a Feature Branch:**
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/P2_T5-user-settings-api
    ```

## In-depth test plan

The TDD process begins by creating a new integration test file that codifies all requirements, including the new security checks.

### Commit 1: RED — Write Failing Integration Tests

#### Action 1: Install Dependencies

```bash
cd goodnumbers
npm install zod
```

#### Action 2: Create the Test File

This test suite is updated to include a critical test case for rate limiting.

```typescript
// file: goodnumbers/tests/integration/user.test.ts
import request from "supertest";
import { app } from "../../src/index.ts";
import * as http from "http";
import { PrismaClient, User } from "@prisma/client";
import { decrypt } from "../../src/lib/encryption.ts";

const prisma = new PrismaClient();
let server: http.Server;
let testUser: User;

describe("PUT /api/user/settings", () => {
  beforeAll((done) => {
    server = app.listen(0, done);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    testUser = await prisma.user.create({
      data: {
        email: `settings-user-${Date.now()}@test.com`,
        agreementsSigned: false,
        nightscoutUrl: "https://initial.url",
        nightscoutToken: "initial-encrypted-token",
      },
    });
  });

  afterAll(async (done) => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    server.close(done);
  });

  it("should return 401 Unauthorized if no user is authenticated", async () => {
    const response = await request(server).put("/api/user/settings").send({
      preferredUnits: "MMOL",
    });
    expect(response.status).toBe(401);
  });

  it("should return 400 Bad Request for invalid data", async () => {
    const response = await request(server)
      .put("/api/user/settings")
      .set("x-test-user-id", testUser.id)
      .send({
        nightscoutUrl: "not-a-valid-url",
      });
    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it("should successfully update all settings and encrypt the token", async () => {
    const settingsPayload = {
      nightscoutUrl: "https://my-nightscout-instance.com",
      nightscoutToken: "my-secret-token-12345",
      preferredUnits: "MMOL",
      agreementsSigned: true,
    };

    const response = await request(server)
      .put("/api/user/settings")
      .set("x-test-user-id", testUser.id)
      .send(settingsPayload);
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(updatedUser!.agreementsSigned).toBe(true);
    expect(updatedUser!.nightscoutUrl).toBe(settingsPayload.nightscoutUrl);
    expect(updatedUser!.preferredUnits).toBe("MMOL");
    expect(updatedUser!.nightscoutToken).not.toBe(
      settingsPayload.nightscoutToken
    );
    expect(decrypt(updatedUser!.nightscoutToken!)).toBe(
      settingsPayload.nightscoutToken
    );
  });

  it("should successfully clear optional fields when passed null", async () => {
    const settingsPayload = {
      nightscoutUrl: null,
      nightscoutToken: null,
    };

    const response = await request(server)
      .put("/api/user/settings")
      .set("x-test-user-id", testUser.id)
      .send(settingsPayload);
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(updatedUser!.nightscoutUrl).toBeNull();
    expect(updatedUser!.nightscoutToken).toBeNull();
  });

  describe("API Security", () => {
    it("should be rate-limited to prevent abuse", async () => {
      const settingsPayload = { preferredUnits: "MGDL" as const };
      const requests = [];
      const requestCount = 25; // Exceeds the planned limit of 20

      for (let i = 0; i < requestCount; i++) {
        requests.push(
          request(server)
            .put("/api/user/settings")
            .set("x-test-user-id", testUser.id)
            .send(settingsPayload)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitResponse = responses.find((res) => res.status === 429);

      expect(rateLimitResponse).toBeDefined();
      expect(rateLimitResponse?.body.error).toContain("Too many requests");
    });
  });
});
```

#### Action 3: Verify Failure and Commit

Run the test suite. The new tests will fail. This is our **RED** state.

```bash
cd goodnumbers
npm test
git add .
git commit -m "test(api): add failing tests for user settings endpoint"
```

## In-depth engineering plan

### Commit 2: GREEN — Implement the API

Now, write the code to make the tests pass, including the new security hardening.

#### Action 1: Create HTML Escaping Utility

Create a new utility file for common, non-domain-specific functions. This is a critical XSS countermeasure.

```typescript
// file: goodnumbers/src/lib/utils.ts
/**
 * A simple utility to escape special HTML characters in a string.
 * This is a critical security function to prevent Stored XSS attacks when
 * rendering user-provided data in server-side HTML templates.
 * @param str The input string to escape.
 * @returns The escaped string.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

#### Action 2: Create Hardened Validation Schema

Create a new file for the `zod` schema with `.nullable()` to explicitly allow fields to be cleared.

```typescript
// file: goodnumbers/src/lib/validation.ts
import { z } from "zod";

export const userSettingsSchema = z.object({
  nightscoutUrl: z.string().url().optional().nullable(),
  nightscoutToken: z.string().min(1).optional().nullable(),
  preferredUnits: z.enum(["MGDL", "MMOL"]).optional(),
  agreementsSigned: z.boolean().optional(),
});
```

#### Action 3: Replace User Route and Consolidate Logic

**Replace the entire contents** of `goodnumbers/src/routes/user.ts` with the following code. This implements the new unified `/settings` endpoint and removes the obsolete `/agreements` route.

```typescript
// file: goodnumbers/src/routes/user.ts
import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { protect } from "../middleware/auth.ts";
import { userSettingsSchema } from "../lib/validation.ts";
import { encrypt } from "../lib/encryption.ts";
import { z } from "zod";
import rateLimit from "express-rate-limit";

// Create a specific rate limiter for this sensitive endpoint.
const settingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Too many requests to update settings, please try again after 15 minutes.",
  },
});

const router = Router();

router.put("/settings", protect, settingsLimiter, async (req, res) => {
  // SECURITY: The user's identity is sourced from the `req.user` object,
  // which is securely populated by the upstream `protect` middleware.
  // All subsequent operations are authorized for this user ID only.
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const validatedSettings = userSettingsSchema.parse(req.body);
    const dataToUpdate: Record<string, any> = { ...validatedSettings };

    // CRITICAL: Only encrypt the token if it's a non-null string.
    if (typeof validatedSettings.nightscoutToken === "string") {
      dataToUpdate.nightscoutToken = encrypt(validatedSettings.nightscoutToken);
    } else if (validatedSettings.nightscoutToken === null) {
      dataToUpdate.nightscoutToken = null;
    }

    await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    console.error(`[API] Failed to update settings for user ${userId}:`, error);
    res.status(500).json({ error: "Could not save settings." });
  }
});

export default router;
```

#### Action 4: Verify Success and Commit

Run the test suite again. All tests should now pass. This is our **GREEN** state.

````bash
cd goodnumbers
npm test
git add .
git commit -m "feat(api): P2_T5 implement protected endpoint for user settings"```

---

### Commit 3: REFACTOR & Add UI — Review and Manually Verify

The final step is to update the placeholder UI with the XSS fix and corrected client-side logic.

#### Action 1: Update Server with Secure Placeholder UI

Modify `goodnumbers/src/index.ts`. This now imports and uses the `escapeHtml` utility and includes the complete client-side script for form submission.

```typescript
// file: goodnumbers/src/index.ts
import './lib/env.ts';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts';
import { getSession } from '@auth/express';
import userRoutes from './routes/user.ts';
import { protect } from './middleware/auth.ts';
import { enforceOnboarding } from './middleware/onboarding.ts';
import { escapeHtml } from './lib/utils.ts';

export function createApp() {
  if (!process.env.AUTH_SECRET) {
    throw new Error('FATAL: Environment variable AUTH_SECRET is not set.');
  }
  if (!process.env.AUTH_GOOGLE_ID) {
    throw new Error('FATAL: Environment variable AUTH_GOOGLE_ID is not set.');
  }
  if (!process.env.AUTH_GOOGLE_SECRET) {
    throw new Error(
      'FATAL: Environment variable AUTH_GOOGLE_SECRET is not set.',
    );
  }

  const app = express();
  app.use(helmet());
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
  app.use(express.json());
  app.use(express.static('public'));

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use('/api/auth', ExpressAuth(authConfig));
  app.use('/api/user', userRoutes);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/api/session', async (req, res) => {
    const session = await getSession(req, authConfig);
    res.json(session);
  });

  app.get('/agreements', protect, enforceOnboarding, (req, res) => {
    res.send(`<h1>Agreements Page</h1><p>User: ${escapeHtml(req.user?.email)}</p><p>Please sign the agreements.</p>
      <form id="agreement-form">
        <button type="submit">Sign Agreements</button>
      </form>
      <p id="message"></p>
      <script>
        document.getElementById('agreement-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const messageEl = document.getElementById('message');
          messageEl.textContent = 'Saving...';
          const response = await fetch('/api/user/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agreementsSigned: true })
          });
          if (response.ok) {
            window.location.href = '/setup-account';
          } else {
            messageEl.textContent = 'An error occurred.';
          }
        });
      </script>
    `);
  });

  app.get('/setup-account', protect, (req, res) => {
    const prefilledUrl = escapeHtml(req.user?.nightscoutUrl);
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <title>Account Setup</title>
          <style> body { font-family: sans-serif; padding: 2em; } input, select { margin-bottom: 1em; width: 300px; } button { padding: 0.5em 1em; } </style>
      </head>
      <body>
          <h1>Account Setup Page</h1>
          <p>User: ${escapeHtml(req.user?.email)}</p>
          <form id="settings-form">
              <label for="nightscoutUrl">Nightscout URL (leave blank to clear):</label><br>
              <input type="text" id="nightscoutUrl" name="nightscoutUrl" size="50" value="${prefilledUrl}"><br>

              <label for="nightscoutToken">Nightscout Token (leave blank to clear):</label><br>
              <input type="password" id="nightscoutToken" name="nightscoutToken" size="50"><br>

              <label for="preferredUnits">Preferred Units:</label><br>
              <select id="preferredUnits" name="preferredUnits">
                  <option value="MGDL" ${req.user?.preferredUnits === 'MGDL' ? 'selected' : ''}>mg/dL</option>
                  <option value="MMOL" ${req.user?.preferredUnits === 'MMOL' ? 'selected' : ''}>mmol/L</option>
              </select><br><br>

              <button type="submit">Save and Continue</button>
          </form>
          <p id="message"></p>
          <script>
            document.getElementById('settings-form').addEventListener('submit', async (e) => {
              e.preventDefault();
              const messageEl = document.getElementById('message');
              messageEl.textContent = 'Saving...';

              const formData = new FormData(e.target);
              const data = Object.fromEntries(formData.entries());

              if (data.nightscoutUrl === '') data.nightscoutUrl = null;
              if (data.nightscoutToken === '') data.nightscoutToken = null;

              try {
                const response = await fetch('/api/user/settings', {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                });

                if (response.ok) {
                  messageEl.textContent = 'Settings saved successfully! Redirecting...';
                  setTimeout(() => window.location.href = '/dashboard', 1500);
                } else {
                  const errorData = await response.json();
                  const errorMsg = errorData.errors ? errorData.errors[0].message : 'Could not save settings.';
                  messageEl.textContent = 'Error: ' + errorMsg;
                }
              } catch (error) {
                console.error('Failed to save settings:', error);
                messageEl.textContent = 'A network error occurred. Please try again.';
              }
            });
          </script>
      </body>
      </html>
    `);
  });

  app.get('/dashboard', protect, enforceOnboarding, (req, res) => {
    res.send(`Welcome to the dashboard, user ${escapeHtml(req.user!.email)}!`);
  });

  return app;
}

export const app = createApp();

function startServer() {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

if (
  import.meta.url.startsWith('file://') &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  startServer();
}
````

#### Action 2: Manual Verification

1.  Run `npm run dev`. Log in and proceed to the `/setup-account` page.
2.  **Test XSS:** In the URL field, enter the value `https://example.com"><script>alert('xss')</script>`. Save it.
3.  Navigate back to the `/setup-account` page. **Expected:** No alert box should appear. View the page source; the `value` attribute of the input should contain `&quot;&gt;&lt;script...`, not the raw script tag.
4.  **Test Clearing Fields:** Clear the URL field and save. Verify in the database that the value is `NULL`.

#### Action 3: Push and Create Pull Request

```bash
cd goodnumbers
git add .
git commit --amend --no-edit
git push origin feat/P2_T5-user-settings-api
gh pr create --base develop --title "feat(api): P2_T5 Implement User Settings API" --body "Closes #<issue_number>. Implements the protected user settings endpoint with TDD, validation, encryption, and security hardening (XSS, rate-limiting)."
```
