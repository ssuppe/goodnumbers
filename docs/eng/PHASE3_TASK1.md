# file: docs/eng/PHASE3_TASK1_CSRF_IMPLEMENTATION.md

# Goodnumbers — PHASE 3, TASK 1: Secure Journal Creation API

## TL;DR

Implement the `POST /api/journals` endpoint with robust, stateless CSRF protection using `tiny-csrf`. This task establishes the foundational security pattern for all state-changing API endpoints in the application.

## Objectives

1.  **Codify CSRF Rules as Tests:** Create a focused integration test that proves state-changing endpoints are vulnerable without CSRF protection.
2.  **Implement CSRF Middleware Correctly:** Install and configure `cookie-parser` and `tiny-csrf` globally, ensuring the correct middleware order for them to function.
3.  **Implement Journal Creation Endpoint:** Build the basic `POST /api/journals` endpoint, protected by the full authentication and CSRF middleware chain.
4.  **Achieve a Green Build:** Ensure all new tests pass, confirming the security layer is working as expected.

## Risk & Mitigation

- **Risk: (HIGH) Cross-Site Request Forgery (CSRF).** An attacker could trick an authenticated user's browser into unintentionally creating a journal.
  - **Mitigation:** The `POST /api/journals` endpoint **must** be protected by `tiny-csrf`. The client (and our tests) will fetch a token from `/api/csrf-token` and include it in the `x-csrf-token` header of the `POST` request.

## Method Outline (Red-Green-Refactor)

1.  **RED:** Write a new, focused integration test (`journals.test.ts`) that verifies the `POST /api/journals` endpoint correctly rejects requests that are missing a valid CSRF token. The test will initially fail.
2.  **GREEN:** Install dependencies (`cookie-parser`, `tiny-csrf`). Implement the minimal code in `src/index.ts` and `src/routes/journal.ts` to make the test pass.
3.  **REFACTOR:** Review the implementation for clarity and adherence to project conventions, then open a pull request.

## Acceptance Gates

1.  The `POST /api/journals` endpoint returns a `403 Forbidden` error if a valid CSRF token is not provided in the `x-csrf-token` header.
2.  The `POST /api/journals` endpoint returns a `401 Unauthorized` error if the user is not authenticated.
3.  The `POST /api/journals` endpoint returns a `201 Created` status when provided with a valid user session and CSRF token.

## “Make-sure-you” Checklist

- [ ] Have you updated your `.env.test` file with the `CSRF_SECRET` and `COOKIE_SECRET`?
- [ ] Have you created the new integration test file **before** writing the implementation code?
- [ ] Is `cookie-parser` registered in `src/index.ts` **before** the `csrf` middleware?
- [ ] Have you applied the `protect` and `enforceOnboarding` middleware to the new journal router?
- [ ] Have you updated the test for `POST` to fetch and use a **`x-csrf-token`** header?

---

## In-depth Engineering Plan

### Commit 1: RED — Write Failing Integration Test

First, we codify the CSRF requirement as a failing test.

#### **Action 1: Update Test Environment**

Add secrets for `cookie-parser` and `tiny-csrf` to your test environment file.

```markdown
# file: .env.test

AUTH_SECRET=a_super_secret_key_for_testing_authjs_sessions
AUTH_GOOGLE_ID=test_google_id
AUTH_GOOGLE_SECRET=test_google_secret

# The CSRF secret that tiny-csrf requires. It MUST be 32+ characters.

CSRF_SECRET=a_very_secure_and_long_secret_for_testing_csrf_thirty_two_chars
COOKIE_SECRET=a_different_super_secret_key_for_testing_cookies

NODE_ENV=test
```

#### **Action 2: Create the Focused Test File**

Create a new file `tests/integration/journals.test.ts`. This test proves that an authenticated user cannot create a journal without the CSRF token.

```markdown
# file: tests/integration/journals.test.ts

import request from 'supertest';
import \* as http from 'http';
import { PrismaClient, User } from '@prisma/client';
import type { Express } from 'express';
import { createApp } from '../../src/index';

const prisma = new PrismaClient();

let app: Express;
let server: http.Server;
let agent: request.SuperTest<request.Test>;
let user1: User;
let csrfToken: string;

describe('POST /api/journals', () => {
// Before each test, create a fresh app instance and test agent.
// The 'agent' is crucial as it stores and sends cookies automatically.
beforeEach((done) => {
app = createApp();
server = app.listen(0, async () => {
agent = request.agent(server);

      await prisma.user.deleteMany();
      user1 = await prisma.user.create({
        data: {
          email: `user1-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: 'https://user1.ns.com',
        },
      });

      // This request will fail initially, but once implemented, the agent
      // will get the CSRF cookie, and we'll get the token for our header.
      const csrfRes = await agent.get('/api/csrf-token').catch(() => ({ body: {} }));
      csrfToken = csrfRes.body.csrfToken;

      done();
    });

});

afterEach((done) => {
server.close(done);
});

afterAll(async () => {
await prisma.$disconnect();
});

it('should return 401 Unauthorized if no user is authenticated', async () => {
const res = await agent
.post('/api/journals')
.set('x-csrf-token', csrfToken)
.send();
expect(res.status).toBe(401);
});

it('should return 403 Forbidden if the CSRF token header is missing', async () => {
const res = await agent
.post('/api/journals')
.set('x-test-user-id', user1.id) // Authenticate via test header
.send({}); // No 'x-csrf-token' header
expect(res.status).toBe(403);
});

it('should return 201 Created if the user is authenticated and CSRF token is valid', async () => {
const res = await agent
.post('/api/journals')
.set('x-test-user-id', user1.id)
.set('x-csrf-token', csrfToken)
.send();

    expect(res.status).toBe(201);
    expect(res.body.journal).toBeDefined();
    expect(res.body.journal.userId).toBe(user1.id);

});
});
```

#### **Action 3: Verify Failure and Commit**

Run the test suite. The tests will fail with `404 Not Found` and `403 Forbidden` errors because the routes and middleware do not exist. This is our correct **RED** state.

```bash
cd goodnumbers
npm test
git add .
git commit -m "test(api): add failing csrf tests for journal creation"
```

---

### Commit 2: GREEN — Implement and Fix

Now, write the minimum code necessary to make the tests pass.

#### **Action 1: Install Dependencies**

```bash
cd goodnumbers
npm install cookie-parser tiny-csrf
npm install --save-dev @types/cookie-parser
```

#### **Action 2: Create the Journal Router**

Create `goodnumbers/src/routes/journal.ts` with only the `POST` handler implemented.

```markdown
# file: src/routes/journal.ts

import { Router } from 'express';
import { prisma } from '../lib/prisma.ts';

const router = Router();

// POST /api/journals - Create a new journal
router.post('/', async (req, res) => {
// The 'protect' middleware ensures req.user exists.
const userId = req.user!.id;

try {
const journal = await prisma.journal.create({
data: { userId },
});
res.status(201).json({ journal });
} catch (error) {
console.error(`[API] Failed to create journal for user ${userId}:`, error);
res.status(500).json({ error: 'Could not create journal.' });
}
});

export default router;
```

#### **Action 3: Wire Up Middleware in the Main App**

This is the most critical step. Update `goodnumbers/src/index.ts` to add and correctly order `cookie-parser` and `tiny-csrf`.

```markdown
# file: src/index.ts

import './lib/env.ts';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts';
import { getSession } from '@auth/express';
import cookieParser from 'cookie-parser'; // NEW
import csrf from 'tiny-csrf'; // NEW

import { escapeHtml } from './lib/utils.ts';

import userRoutes from './routes/user.ts';
import journalRoutes from './routes/journal.ts'; // NEW
import { protect } from './middleware/auth.ts';
import { enforceOnboarding } from './middleware/onboarding.ts';

export function createApp() {
// --- Fatal Error Checks ---
if (!process.env.AUTH_SECRET) throw new Error('FATAL: AUTH_SECRET is not set.');
if (!process.env.AUTH_GOOGLE_ID) throw new Error('FATAL: AUTH_GOOGLE_ID is not set.');
if (!process.env.AUTH_GOOGLE_SECRET) throw new Error('FATAL: AUTH_GOOGLE_SECRET is not set.');
const csrfSecret = process.env.CSRF_SECRET;
if (!csrfSecret || (process.env.NODE_ENV !== 'test' && csrfSecret.length < 32)) {
throw new Error('FATAL: CSRF_SECRET is not set or is not 32+ characters long.');
}

const app = express();

// --- Security & Core Middlewares ---
app.use(helmet({ contentSecurityPolicy: false })); // Disabled for simplicity in placeholder pages
app.use(rateLimit({ windowMs: 15 _ 60 _ 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use(express.json());
app.use(express.static('public'));
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// --- CRITICAL MIDDLEWARE ORDER ---

// 1. Cookie Parser: Must run first to parse cookies for subsequent middleware.
app.use(cookieParser(process.env.COOKIE_SECRET));

// 2. Auth.js: Handles authentication sessions.
app.use('/api/auth', ExpressAuth(authConfig));

// 3. CSRF Protection: Protects all subsequent state-changing routes.
app.use(csrf(csrfSecret, ['POST', 'PUT', 'DELETE']));

// --- API Routes ---

// Endpoint for the client/tests to get a valid CSRF token.
app.get('/api/csrf-token', (req, res) => {
res.json({ csrfToken: req.csrfToken() });
});

app.use('/api/user', userRoutes);
// Apply the full security chain to the journal routes.
app.use('/api/journals', protect, enforceOnboarding, journalRoutes);

// --- Health & Session Routes ---
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/session', async (req, res) => res.json(await getSession(req, authConfig)));

// --- Placeholder Page Routes (unchanged) ---
app.get('/agreements', protect, (req, res) => { res.send(`<h1>Agreements Page</h1>...`); });
app.get('/setup-account', protect, (req, res) => { res.send(`<h1>Account Setup Page</h1>...`); });
app.get('/dashboard', protect, enforceOnboarding, (req, res) => { res.send(`Welcome, ${escapeHtml(req.user!.email)}!`); });

return app;
}

// Check if the file is being run directly to start the server.
if (
import.meta.url.startsWith('file://') &&
process.argv === new URL(import.meta.url).pathname
) {
const app = createApp();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server is running on http://localhost:${PORT}`);
});
}
```

#### **Action 4: Verify Success and Commit**

Run the test suite again. All tests should now pass. This is our **GREEN** state.

```bash
cd goodnumbers
npm test
git add .
git commit -m "feat(api): implement secure journal creation endpoint with csrf"
```

---

### **TODO: Complete the Rest of the Journal API**

If the above plan works successfully, you have established the core security pattern. You can now return to our chat to get the code for the remaining parts of the Journal API.

**[Continue this conversation here when you are ready for the next steps](https://aistudio.google.com/prompts/1lvrfJj-WaonUGek8M3R6yfrq7Rtutub6?save=true)**

The next steps will include:

- Adding tests for `GET`, `PUT`, `DELETE` endpoints.
- Implementing the logic for those endpoints, including ownership checks and input validation.
- Refactoring the code for clarity and completeness.

```

```
