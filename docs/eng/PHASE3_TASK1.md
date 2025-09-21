# Goodnumbers — PHASE 3, TASK 1: Secure Journal Creation API with Robust Integration Testing

## 1. Overview for the Junior Engineer

Welcome to Phase 3! This first task is one of the most important in the entire project. We will be implementing the `POST /api/journals` endpoint, which allows a user to create a new journal. More importantly, we will be setting up the security foundation—specifically **Cross-Site Request Forgery (CSRF) protection**—that will protect all of our future sensitive API endpoints.

This document will guide you through the process using a professional, **Test-Driven Development (TDD)** approach. We will write a test that fails first, then write the code to make it pass. This ensures our security works exactly as we expect.

During our initial attempts, we discovered a subtle but critical issue where our testing tools struggled with the security libraries. This document contains the final, superior solution that solves those problems, resulting in a clean, secure, and highly reliable implementation.

## 2. Technical Deep Dive: The "Why" Behind Our Choices

### What is CSRF?

CSRF is an attack where a malicious website can trick your browser into making a request to our application without your consent. Since your browser automatically sends your login cookie with the request, our app might think it was you who, for example, asked to delete a journal. We must prevent this.

### Our CSRF Strategy: The Double Submit Cookie Pattern

We will use a modern, stateless security pattern. Here’s how it works:

1.  When you first visit our app, the server sends your browser a special, secure cookie containing a secret CSRF token.
2.  Our frontend code is designed to read this token from the cookie.
3.  For any sensitive action (like creating a journal), our frontend will include that same token in a special header, like `x-csrf-token`.
4.  Our server will then check: "Does the token in the header match the token in the cookie?" If they match, the request is legitimate. If not, it's rejected.

A malicious website cannot read the cookie from your browser, so it cannot forge a valid request.

### The Testing Challenge We Overcame (The Important Part!)

Our initial plan was to use the standard `supertest` library for testing. However, we discovered that it had trouble correctly managing the **signed cookies** that our CSRF library, `tiny-csrf`, creates for security. This led to frustrating and misleading test failures.

After careful research, we found a better tool for the job: **`supertest-session`**. This is a specialized version of `supertest` designed specifically to handle complex, cookie-based sessions perfectly.

**The key insight is that `supertest-session` allows us to keep our application code 100% identical between test and production environments.** We solve the testing problem by using a better testing tool, not by changing our application's security logic. This is a major win for project quality and reliability.

## 3. The Step-by-Step Implementation Plan

We will follow the "Red-Green-Refactor" TDD workflow.

### Commit 1: RED — Write a Failing Test to Define Our Goal

First, we will set up our test environment and write a test that proves our application is not secure yet. The test will fail, which is exactly what we want. This is our **RED** state.

#### **Action 1: Install a New, Specialized Testing Dependency**

This is the key library that will make our tests reliable.

```bash
cd goodnumbers
npm install --save-dev supertest-session
```

#### **Action 2: Update Your Test Environment File**

Ensure your `.env.test` file contains the necessary secrets for `cookie-parser` and `tiny-csrf`. The test environment uses these to run the middleware just like it would in production.

```markdown
# file: .env.test

AUTH_SECRET=a_super_secret_key_for_testing_authjs_sessions
AUTH_GOOGLE_ID=test_google_id
AUTH_GOOGLE_SECRET=test_google_secret

# The CSRF secret that tiny-csrf requires. It MUST be 32+ characters long.

CSRF_SECRET=a_very_secure_and_long_secret_for_testing_csrf_thirty_two_chars

# A secret for signing cookies, used by cookie-parser.

COOKIE_SECRET=a_different_super_secret_key_for_testing_cookies

NODE_ENV=test
```

#### **Action 3: Create the Focused Integration Test File**

Create a new file at `tests/integration/journals.test.ts`. Notice how we import and use `supertest-session` here. This test defines our security requirements: an unauthenticated user gets a `401`, and an authenticated user without a CSRF token gets a `403`.

```markdown
# file: tests/integration/journals.test.ts

import session from 'supertest-session'; // We use the specialized 'supertest-session'
import \* as http from 'http';
import { PrismaClient, User } from '@prisma/client';
import type { Express } from 'express';
import { createApp } from '../../src/index';

const prisma = new PrismaClient();

let app: Express;
let server: http.Server;
// The 'agent' is now a 'Session' object, which is better at handling cookies.
let agent: session.Session;
let user1: User;
let csrfToken: string;

describe('POST /api/journals', () => {
beforeEach((done) => {
app = createApp();
server = app.listen(0, async () => {
// Initialize the session agent. It wraps our app and will
// correctly manage signed cookies across multiple requests in a single test.
agent = session(app);

      await prisma.user.deleteMany();
      user1 = await prisma.user.create({
        data: {
          email: `user1-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: 'https://user1.ns.com',
        },
      });

      // The agent makes a request to get the token. It will automatically
      // handle the 'set-cookie' header from the response for us.
      const csrfRes = await agent.get('/api/csrf-token');
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

#### **Action 4: Verify Failure and Commit**

Run your tests. They will fail with `404 Not Found` because we haven't created the routes yet. This is perfect. It means our test setup is working and is correctly reporting that the feature doesn't exist.

```bash
cd goodnumbers
npm test
git add .
git commit -m "test(api): add failing csrf tests for journal creation"
```

---

### Commit 2: GREEN — Implement the Feature to Make the Tests Pass

Now we will write the actual application code. The goal is to write just enough to make our failing tests turn green.

#### **Action 1: Install Application Dependencies**

These are the libraries our _application_ needs, as opposed to the testing libraries.

```bash
cd goodnumbers
npm install cookie-parser tiny-csrf
npm install --save-dev @types/cookie-parser
```

#### **Action 2: Create the Journal Router**

Create a new file at `goodnumbers/src/routes/journal.ts`. This file will handle requests for the `/api/journals` path. For now, we only need to implement the `POST` route.

```markdown
# file: src/routes/journal.ts

import { Router } from 'express';
import { prisma } from '../lib/prisma.ts';

const router = Router();

// This handler will only be reached if the request has already passed
// through the 'protect' and 'csrf' middleware successfully.
router.post('/', async (req, res) => {
// We can safely assume 'req.user' exists because of the 'protect' middleware.
const userId = req.user!.id;

try {
const journal = await prisma.journal.create({
data: { userId },
});
// Respond with a '201 Created' status and the new journal object.
res.status(201).json({ journal });
} catch (error) {
console.error(`[API] Failed to create journal for user ${userId}:`, error);
res.status(500).json({ error: 'Could not create journal.' });
}
});

export default router;
```

#### **Action 3: Create a Global Error Handler**

During debugging, we realized that unhandled errors were causing generic `500` responses without any useful information. A global error handler is a professional best practice. It will catch any unexpected errors in our application and ensure we log them and send a clean response.

Create a new file at `goodnumbers/src/middleware/errorHandler.ts`.

```markdown
# file: src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';

// Express identifies this as an error handler because it has 4 arguments.
export function errorHandler(
err: Error,
req: Request,
res: Response,
next: NextFunction,
) {
// Log the full error to the console for debugging.
// This is the most important part for development.
console.error('--- UNHANDLED ERROR ---');
console.error(err.stack);
console.error('--- END UNHANDLED ERROR ---');

// Send a generic, safe response to the client.
res.status(500).json({
error: 'An internal server error occurred.',
});
}
```

#### **Action 4: Wire Everything Together in `index.ts`**

This is the most critical step. We will update our main application file to use all the new pieces in the correct order. The order of middleware in Express is extremely important.

```markdown
# file: src/index.ts

import './lib/env.ts';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts';
import { getSession } from '@auth/express';
import cookieParser from 'cookie-parser'; // For parsing cookies
import csrf from 'tiny-csrf'; // For CSRF protection

import { escapeHtml } from './lib/utils.ts';

// Import our new modules
import journalRoutes from './routes/journal.ts';
import { errorHandler } from './middleware/errorHandler.ts';

// Import existing modules
import userRoutes from './routes/user.ts';
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
const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret) throw new Error('FATAL: COOKIE_SECRET is not set.');

const app = express();

// --- Security & Core Middlewares ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({ windowMs: 15 _ 60 _ 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use(express.json());
app.use(express.static('public'));

// --- UNIFIED MIDDLEWARE ORDER FOR ALL ENVIRONMENTS ---
// This order is critical for security to function correctly.

// 1. Cookie Parser: It must run first so that cookies are parsed and available
// on the `req` object for other middleware to use. We pass it the secret
// so it can validate signed cookies.
app.use(cookieParser(cookieSecret));

// 2. Auth.js: Handles all authentication logic. It needs `cookie-parser` to
// read the session cookie.
app.use('/api/auth', ExpressAuth(authConfig));

// 3. CSRF Protection: This middleware protects against CSRF attacks. It needs
// `cookie-parser` to read its own CSRF cookie.
app.use(csrf(csrfSecret, ['POST', 'PUT', 'DELETE']));

// --- API Routes ---

// This endpoint is for our client to get the initial token.
app.get('/api/csrf-token', (req, res) => {
res.json({ csrfToken: req.csrfToken() });
});

app.use('/api/user', userRoutes);

// Here, we apply our full security chain to the journal routes. A request must
// be authenticated (`protect`), the user must be fully onboarded (`enforceOnboarding`),
// and the CSRF token must be valid before the request can reach the journal router.
app.use('/api/journals', protect, enforceOnboarding, journalRoutes);

// --- Health Check and other routes ---
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/session', async (req, res) => res.json(await getSession(req, authConfig)));
app.get('/agreements', protect, (req, res) => { res.send(`<h1>Agreements Page</h1>...`); });
app.get('/setup-account', protect, (req, res) => { res.send(`<h1>Account Setup Page</h1>...`); });
app.get('/dashboard', protect, enforceOnboarding, (req, res) => { res.send(`Welcome, ${escapeHtml(req.user!.email)}!`); });

// --- Global Error Handler ---
// This MUST be the very last middleware. If any route or middleware before this
// throws an error, Express will skip straight to this handler.
app.use(errorHandler);

return app;
}

// --- Server Startup Logic ---
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

#### **Action 5: Verify Success and Commit**

Run the test suite again. All the tests in `journals.test.ts` should now pass. This is our **GREEN** state. We have successfully implemented the secure endpoint.

```bash
cd goodnumbers
npm test
git add .
git commit -m "feat(api): implement secure journal creation endpoint"
```

---

## 4. Next Steps

Congratulations! You have successfully established the core security pattern for the entire application. The foundation is now solid.

When you are ready, you can return to our chat to get the code for the remaining parts of the Journal API.

**[Continue this conversation here when you are ready for the next steps](https://aistudio.google.com/prompts/1lvrfJj-WaonUGek8M3R6yfrq7Rtutub6?save=true)**

The next steps will involve building on this foundation:

- Adding tests for the `GET`, `PUT`, and `DELETE` journal endpoints.
- Implementing the logic for those endpoints, including critical security checks for data ownership.
- Adding input validation to protect against bad data.

```

```
