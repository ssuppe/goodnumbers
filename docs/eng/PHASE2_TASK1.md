# Implementation Plan: Phase 2, Task 1 - Pre-Release Access Barrier

**Author:** Dr. Gemini, Technical Lead
**Audience:** Junior Engineer
**Date:** 2025-08-16

## 1. Overview and Goal

Welcome! This document will guide you through the process of implementing the pre-release access barrier for the Goodnumbers application.

**The primary goal of this task is to create a site-wide password barrier to restrict access to the application during our private beta phase.** This is a critical first step in our authentication system. We will follow a strict Test-Driven Development (TDD) workflow, which is a cornerstone of our development process. This means we will write tests *before* we write the implementation code.

This task is broken down into four major steps:
1.  **The "Red" Step:** Write tests that define the functionality we want, and watch them fail.
2.  **The "Green" Step:** Write the absolute minimum amount of code required to make our tests pass.
3.  **Repeat Red->Green:** Add the remaining tests for the feature and implement the full logic to make them pass.
4.  **The "Refactor" Step:** Clean up our code to make it more maintainable, relying on our tests to ensure we don't break anything.

## 2. Security & Best Practices

Before we write any code, it's important to understand the security principles we'll be applying. Writing secure code is not an afterthought; it's a core part of the development process.

-   **Secure Credential Comparison:** We will not use a simple `===` check to compare passwords. This can be vulnerable to timing attacks. Instead, we will use Node.js's built-in `crypto.timingSafeEqual` function, which takes a constant amount of time to execute, regardless of the input.
-   **Brute-Force Protection:** We must protect our login endpoint from automated password guessing attacks. We will implement rate limiting to slow down and block attackers.
-   **Secure Session Cookies:** Cookies are a common target for attackers. We will configure our session cookies with the `httpOnly`, `secure`, and `sameSite` flags to protect them from various attacks like XSS and CSRF.
-   **Type Safety:** We will avoid using `@ts-ignore`. Instead, we will properly extend TypeScript's types using a declaration file (`.d.ts`) to ensure our code is fully type-safe and easier to maintain.
-   **Secret Management:** We will never commit secrets to version control. We will use a `.env` file for local development and ensure it is listed in our `.gitignore` file.

## 3. Prerequisites

Before you begin, please ensure you have read and understood the following documents. They provide the essential context for this task:

1.  `docs/PRD.md`: Understands the "why" behind the feature.
2.  `docs/TECHNICAL_SPECIFICATION.md`: Details the technical requirements for the barrier.
3.  `docs/DEVELOPMENT_PROCESS.md`: Explains our Git workflow and commit standards.
4.  `docs/IMPLEMENTATION_PLAN.md`: Shows where this task fits into the overall project plan.

## 4. Step-by-Step Implementation Guide

Let's begin the implementation. Follow these steps precisely.

### Step 4.1: Create Test File and Initial Failing Tests (The "Red" Step)

First, we set up our branch and create our initial, failing tests.

1.  **Create a Feature Branch:**
    Following our development process, create a new branch from the `develop` branch.

    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/P2_T1-access-barrier
    ```

2.  **Create the Test File:**
    Create a new integration test file for our barrier feature.

    ```bash
    touch goodnumbers/tests/integration/barrier.test.ts
    ```

3.  **Write the Initial Failing Tests:**
    Open `goodnumbers/tests/integration/barrier.test.ts` and add the following code. This code imports the necessary tools and defines our first two test cases.

    ```typescript
    import request from 'supertest';
    import { app } from '../../src/index'; // We will create this import later

    describe('Pre-Release Access Barrier', () => {
      it('should redirect to the barrier login page for an unauthenticated request to a protected route', async () => {
        const response = await request(app).get('/api/some-protected-api');
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/barrier-login.html');
      });

      it('should return 401 for a login attempt with incorrect credentials', async () => {
        const response = await request(app)
          .post('/api/barrier-login')
          .send({ username: 'wrong', password: 'user' });
        expect(response.status).toBe(401);
      });

      it('should allow unauthenticated access to /health and return 200 OK', async () => {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
      });
    });
    ```
    *Note: The import for `app` will show an error right now. That is expected.*

4.  **Run the Tests and Watch Them Fail:**
    This is the "Red" step. Run the test command from the `goodnumbers` directory.

    ```bash
    cd goodnumbers
    npm test
    ```

    The tests will fail. This is good! It means our tests are correctly identifying that the feature is not yet implemented.

### Step 4.2: Minimal Implementation to Pass Tests (The "Green" Step)

Now, we'll write the minimum code needed to make our first two tests pass.

1.  **Install Dependencies:**
    We need `cookie-session` to manage the barrier session and `express-rate-limit` for security.

    ```bash
    npm install cookie-session @types/cookie-session express-rate-limit zod
    ```

2.  **Create the Stub Login Page:**
    The redirect test needs a file to redirect to. Create a placeholder HTML file.

    ```bash
    touch public/barrier-login.html
    ```

    Open `public/barrier-login.html` and add this content:

    ```html
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Private Beta Access</title>
    </head>
    <body>
        <h1>Private Beta Access</h1>
        <p>This is a placeholder for the barrier login page.</p>
    </body>
    </html>
    ```

3.  **Configure Environment Variables:**
    First, ensure your `.env` file is ignored by git. Check your root `.gitignore` file and add `.env` if it's not there.

    Next, update `.env.example` with the new variables required for the barrier.

    ```
    # .env.example
    BARRIER_USERNAME=
    BARRIER_PASSWORD=
    COOKIE_SECRET=
    ```

    Now, create your own local `.env` file. You will need to manually add your `BARRIER_USERNAME` and `BARRIER_PASSWORD` to this file. For `COOKIE_SECRET`, generate a secure, random string (e.g., using `openssl rand -base64 32` in your terminal) and add it to the file.

4.  **Create TypeScript Declaration File:**
    To avoid using `@ts-ignore`, we need to tell TypeScript about our new session property. Create a new file for this.

    ```bash
    mkdir -p src/types
    touch src/types/express-session.d.ts
    ```

    Add the following content to `src/types/express-session.d.ts`:

    ```typescript
    import 'cookie-session';

    declare module 'cookie-session' {
      interface SessionData {
        is_authorized?: boolean;
      }
    }
    ```

5.  **Write Minimal Implementation:**
    Now, let's modify `src/index.ts`. We will export `app` for our tests and add the minimal middleware and route. Ensure `dotenv/config` is imported at the top to load environment variables.

    ```typescript
    // src/index.ts
    import express from 'express';
    import cookieSession from 'cookie-session';
    import 'dotenv/config'; // Explicitly import dotenv/config

    const app = express();
    app.use(express.json());
    app.use(express.static('public'));

    // Configure cookie session with security best practices
    app.use(
      cookieSession({
        name: 'barrier_session',
        secret: process.env.COOKIE_SECRET!,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // Protect against CSRF attacks
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
    );

    // Barrier Middleware (Minimal)
    app.use((req, res, next) => {
      if (req.path === '/barrier-login.html' || req.path.startsWith('/api/barrier-login') || req.path === '/health') {
        return next();
      }
      if (req.session && req.session.is_authorized) {
        return next();
      }
      return res.redirect('/barrier-login.html');
    });

    // Barrier Login Route (Minimal)
    app.post('/api/barrier-login', (req, res) => {
      res.status(401).send({ message: 'Unauthorized' });
    });
    
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    export { app, server }; // Export for testing
    ```

6.  **Run Tests and Watch Them Pass:**
    This is the "Green" step.

    ```bash
    npm test
    ```

    Your first two tests should now pass!

### Step 4.3: Add Remaining Tests and Implement Full Logic

Now we repeat the cycle: add more tests, watch them fail, and then implement the logic to make them pass.

1.  **Add Remaining Test Cases:**
    Add the following tests to `goodnumbers/tests/integration/barrier.test.ts`. These will test for a *successful* login and verify that a logged-in user can bypass the barrier.

    ```typescript
    // Add these inside the describe block in barrier.test.ts

    it('should return 200 and set a cookie for a successful login', async () => {
      const response = await request(app)
        .post('/api/barrier-login')
        .send({
          username: process.env.BARRIER_USERNAME,
          password: process.env.BARRIER_PASSWORD,
        });
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should allow access to a protected route after a successful login', async () => {
      const agent = request.agent(app); // Use an agent to maintain the session cookie
      
      // First, log in
      await agent
        .post('/api/barrier-login')
        .send({
          username: process.env.BARRIER_USERNAME,
          password: process.env.BARRIER_PASSWORD,
        });

      // Then, access the protected route
      const response = await agent.get('/api/some-protected-api');
      expect(response.status).toBe(404); // Expect 404 as the route does not exist yet
    });
    ```

2.  **Run Tests and Watch New Tests Fail:**
    Run `npm test` again. The two new tests will fail.

3.  **Implement the Full Logic:**
    Now, update the `/api/barrier-login` route in `src/index.ts` with the complete, secure logic.

    ```typescript
    // In src/index.ts, replace the minimal POST /api/barrier-login with this:
    import { z } from 'zod';
    import { timingSafeEqual } from 'crypto';

    const barrierLoginSchema = z.object({
      username: z.string(),
      password: z.string(),
    });

    app.post('/api/barrier-login', (req, res) => {
      try {
        const { username, password } = barrierLoginSchema.parse(req.body);

        // Securely compare credentials using a constant-time algorithm
        const storedUser = Buffer.from(process.env.BARRIER_USERNAME!);
        const providedUser = Buffer.from(username);
        const storedPass = Buffer.from(process.env.BARRIER_PASSWORD!);
        const providedPass = Buffer.from(password);

        const isUserMatch = storedUser.length === providedUser.length && timingSafeEqual(storedUser, providedUser);
        const isPassMatch = storedPass.length === providedPass.length && timingSafeEqual(storedPass, providedPass);

        if (isUserMatch && isPassMatch) {
          req.session!.is_authorized = true;
          return res.status(200).json({ message: 'Login successful' });
        }

        return res.status(401).json({ message: 'Invalid username or password' });
      } catch (error) {
        return res.status(400).json({ message: 'Invalid request body' });
      }
    });
    ```

4.  **Run All Tests:**
    Run `npm test` one more time. All four tests should now be passing. Congratulations!

### Step 4.4: Refactor for Maintainability

Our tests are all passing, which gives us a safety net to clean up our code without fear of breaking it.

1.  **Create a Middleware File:**
    Let's move the barrier middleware logic into its own file.

    ```bash
    mkdir -p src/middleware
    touch src/middleware/barrier.ts
    ```

    Add the following content to `src/middleware/barrier.ts`:

    ```typescript
    // src/middleware/barrier.ts
    import { Request, Response, NextFunction } from 'express';

    export const barrierMiddleware = (req: Request, res: Response, next: NextFunction) => {
      // Allow access to the login page, the API endpoint, and the health check
      if (req.path === '/barrier-login.html' || req.path.startsWith('/api/barrier-login') || req.path === '/health') {
        return next();
      }

      if (req.session && req.session.is_authorized) {
        return next();
      }

      // If not authorized, redirect to the login page
      return res.redirect('/barrier-login.html');
    };
    ```

2.  **Create a Route File:**
    Let's move the route handler to its own file, now including rate limiting.

    ```bash
    mkdir -p src/routes
    touch src/routes/barrier.ts
    ```

    Add the following content to `src/routes/barrier.ts`:

    ```typescript
    // src/routes/barrier.ts
    import { Router } from 'express';
    import { z } from 'zod';
    import { timingSafeEqual } from 'crypto';
    import rateLimit from 'express-rate-limit';

    export const barrierRouter = Router();

    const barrierLoginSchema = z.object({
      username: z.string(),
      password: z.string(),
    });

    // Apply rate limiting to the login route to prevent brute-force attacks
    const barrierLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // Limit each IP to 10 login requests per window
        message: 'Too many login attempts from this IP, please try again after 15 minutes',
        standardHeaders: true,
        legacyHeaders: false,
    });

    barrierRouter.post('/api/barrier-login', barrierLimiter, (req, res) => {
      try {
        const { username, password } = barrierLoginSchema.parse(req.body);

        const storedUser = Buffer.from(process.env.BARRIER_USERNAME!);
        const providedUser = Buffer.from(username);
        const storedPass = Buffer.from(process.env.BARRIER_PASSWORD!);
        const providedPass = Buffer.from(password);

        const isUserMatch = storedUser.length === providedUser.length && timingSafeEqual(storedUser, providedUser);
        const isPassMatch = storedPass.length === providedPass.length && timingSafeEqual(storedPass, providedPass);

        if (isUserMatch && isPassMatch) {
          req.session!.is_authorized = true;
          return res.status(200).json({ message: 'Login successful' });
        }

        return res.status(401).json({ message: 'Invalid username or password' });
      } catch (error) {
        return res.status(400).json({ message: 'Invalid request body' });
      }
    });
    ```

3.  **Update `src/index.ts`:**
    Now, update the main application file to use our new, refactored modules. It will be much cleaner.

    ```typescript
    // src/index.ts
    import express from 'express';
    import cookieSession from 'cookie-session';
    import 'dotenv/config';
    import { barrierMiddleware } from './middleware/barrier';
    import { barrierRouter } from './routes/barrier';

    const app = express();
    app.use(express.json());
    app.use(express.static('public'));

    app.use(
      cookieSession({
        name: 'barrier_session',
        secret: process.env.COOKIE_SECRET!,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
    );

    // Use the middleware and router
    app.use(barrierMiddleware);
    app.use('/', barrierRouter); // Mount the router at the root

    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    export { app, server };
    ```

4.  **Final Test Run:**
    Run the tests one last time to ensure our refactoring didn't break anything.

    ```bash
    npm test
    ```
    All tests should still pass.

## 5. Final Steps

You have successfully implemented the feature with robust security measures! The final steps are to commit your work and create a Pull Request.

1.  **Commit Your Work:**
    Stage and commit your changes using our conventional commit format.

    ```bash
    git add .
    git commit -m "feat(auth): implement secure pre-release site access barrier"
    ```

2.  **Create a Pull Request:**
    Push your branch and open a Pull Request against the `develop` branch.

    ```bash
    git push origin feat/P2_T1-access-barrier
    gh pr create --base develop --title "feat(auth): implement secure pre-release site access barrier" --body "Closes #<issue-number>. Implements the site-wide password barrier for private beta access as per Phase 2, Task 1. Includes rate limiting, secure credential comparison, and hardened session cookie configuration."
    ```
    *(Remember to replace `<issue-number>` with the actual issue number for this task.)*

Excellent work. You've completed a critical feature while adhering to our quality and process standards.
