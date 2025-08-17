# Implementation Plan: Phase 2, Task 2 - Integrate User Authentication

**Author:** Gemini, Technical Lead
**Date:** 2025-08-17
**Version:** 1.0

## 1. Overview

This document provides a detailed, step-by-step plan for a junior engineer to implement user authentication into the Goodnumbers application. This task corresponds to **Phase 2, Task 2** of the master implementation plan.

The primary goal is to integrate **Auth.js** into our existing Express.js server, using **Google as the sole authentication provider**. This will handle all user login, registration, and session management.

This plan strictly follows the project's established `DEVELOPMENT_PROCESS.md`. All work should be done on a new feature branch created from `develop`.

## 2. Prerequisites

Before you begin, ensure you have completed the following:

1.  **Create a GitHub Issue:** As per the `DEVELOPMENT_PROCESS.md`, every task must start with an issue. Create one for this task now.

    ```bash
    gh issue create --title "feat(auth): P2_T2 integrate auth.js" --body "Integrate Auth.js with Google Provider and Prisma Adapter. See docs/eng/PHASE2_TASK2.md for the full implementation plan."
    ```

2.  **Pull Latest Changes:** Make sure your local `develop` branch is up-to-date with the remote repository.

    ```bash
    git checkout develop
    git pull
    ```

3.  **Create a Feature Branch:** Create a new branch for this task, following our naming conventions. Include the issue number in the branch name for easy tracking.

    ```bash
    # Replace 'ISSUE_NUMBER' with the actual issue number you just created
    git checkout -b feat/ISSUE_NUMBER-authjs-integration
    ```

4.  **Verify Environment:** Ensure your `.env` file in the `goodnumbers/` directory is correctly configured with the variables from `.env.example`, including `DATABASE_URL`, `COOKIE_SECRET`, etc.

## 3. Implementation Stages

We will implement this feature in four distinct stages. Please complete them in order, verifying your work at each step.

### Stage 1: Install Dependencies and Configure Environment

**Goal:** Add the necessary Auth.js libraries to the project and configure the required environment variables for Google OAuth.

1.  **Install Auth.js Packages:** Navigate to the `goodnumbers` directory and install the core Auth.js library and the Prisma adapter.

    ```bash
    cd goodnumbers
    npm install @auth/core @auth/prisma-adapter
    ```

2.  **Configure Google OAuth Credentials:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a new project or use an existing one.
    *   Navigate to "APIs & Services" > "Credentials".
    *   Create new "OAuth 2.0 Client IDs".
    *   Select "Web application" as the type.
    *   Under "Authorized redirect URIs", add the following URL: `http://localhost:3000/api/auth/callback/google`.
    *   Once created, Google will provide you with a **Client ID** and a **Client Secret**.

3.  **Update Environment File:** Add the credentials you just received to your `.env` file. Also, add a new secret for Auth.js itself. Your `.env` file should now include these lines:

    ```dotenv
    # ... existing variables
    
    # Auth.js
    AUTH_SECRET="YOUR_AUTH_SECRET_HERE" # Generate a strong random string, e.g., openssl rand -hex 32
    GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID_HERE"
    GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET_HERE"
    ```

4.  **IMPORTANT: Security Best Practices for Secrets**
    *   **DO NOT COMMIT THE `.env` FILE:** The `.env` file contains sensitive credentials. You must ensure it is listed in the `goodnumbers/.gitignore` file. Committing this file to version control will expose your application's secrets and create a severe security vulnerability.
    *   **PRODUCTION SECRET MANAGEMENT:** For a production environment, secrets must **not** be stored in a `.env` file on the server. They should be injected securely using a dedicated secret manager, such as Google Secret Manager, AWS Secrets Manager, or HashiCorp Vault. This plan is for local development only.

**Verification:**
*   Run `npm install` again to ensure all packages are correctly installed.
*   Confirm that the new dependencies (`@auth/core`, `@auth/prisma-adapter`) are listed in your `goodnumbers/package.json` file.

### Stage 2: Create the Auth.js Configuration

**Goal:** Create a dedicated configuration file for Auth.js that defines our providers, adapter, and session strategy.

1.  **Create a New File:** In the `goodnumbers/src/lib/` directory, create a new file named `auth.ts`.

2.  **Populate the Configuration:** Add the following code to `goodnumbers/src/lib/auth.ts`. This code sets up Auth.js to use the Prisma adapter and the Google provider.

    ```typescript
    // src/lib/auth.ts
    import { PrismaAdapter } from "@auth/prisma-adapter";
    import { PrismaClient } from "@prisma/client";
    import type { AuthOptions } from "@auth/core";
    import GoogleProvider from "@auth/core/providers/google";

    const prisma = new PrismaClient();

    export const authOptions: AuthOptions = {
      adapter: PrismaAdapter(prisma),
      providers: [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }),
      ],
      session: {
        strategy: "jwt", // Using JWT for session management
      },
      // Set secure cookies in production
      cookies: {
        sessionToken: {
          name: `__Secure-authjs.session-token`,
          options: {
            httpOnly: true, // Prevents client-side JS from accessing the cookie
            sameSite: 'lax', // Mitigates CSRF attacks
            path: '/',
            secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
          },
        },
      },
      callbacks: {
        // This callback enriches the JWT with data required for authorization.
        async jwt({ token, user }) {
          if (user) {
            // On initial sign-in, fetch the user from the DB to get the agreements flag.
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
            // Return a minimal token, practicing data minimization.
            return {
              id: user.id,
              email: user.email,
              agreementsSigned: dbUser?.agreementsSigned ?? false,
            };
          }
          // On subsequent requests, the token is already populated.
          return token;
        },
        // This callback makes the custom token data available to the client-side session object.
        async session({ session, token }) {
          if (session.user && token) {
            session.user.id = token.id as string;
            session.user.email = token.email as string;
            (session.user as any).agreementsSigned = token.agreementsSigned;
            // Remove default fields we don't want exposed in the session object.
            delete session.user.name;
            delete session.user.image;
          }
          return session;
        },
      },
    };
    ```

**Verification:**
*   Run a TypeScript check to ensure there are no compilation errors.
    ```bash
    cd goodnumbers
    npx tsc --noEmit
    ```

### Stage 2.5: Update Session Type Definitions

**Goal:** Update the TypeScript types to reflect the new, minimal session object we defined in the Auth.js callbacks.

1.  **Open the Type Definition File:** Navigate to and open `goodnumbers/src/types/express-session.d.ts`.

2.  **Update the Session Interface:** Modify the file to include the new fields (`id`, `email`, `agreementsSigned`) that we are adding to the session. The `name` and `image` properties should be removed from the `User` type if they exist, and the `is_authorized` property for the barrier session should be preserved.

    ```typescript
    // src/types/express-session.d.ts
    import 'cookie-session';
    import type { DefaultSession } from '@auth/core/types';

    // For the pre-release barrier session
    declare module 'cookie-session' {
      interface SessionData {
        is_authorized?: boolean;
      }
    }

    // For the main application user session (Auth.js)
    declare module '@auth/core/types' {
      interface Session {
        user?: {
          id: string;
          email: string;
          agreementsSigned: boolean;
        } & DefaultSession['user'];
      }
    }
    ```

**Verification:**
*   Run a TypeScript check again (`npx tsc --noEmit`) to ensure the new types are correct and there are no conflicts.

### Stage 4: Write Integration Tests (The "Red" Step)

**Goal:** Before implementing the feature, write failing integration tests that define what success looks like. This follows our Test-Driven Development (TDD) process.

1.  **Create a New Test File:** Create a new file at `goodnumbers/tests/integration/auth.test.ts`.

2.  **Add Test Cases:** Add the following tests to the new file. These tests will fail initially because the routes don't exist yet.

    ```typescript
    // tests/integration/auth.test.ts
    import request from 'supertest';
    import { app } from '../../src/index'; // Assuming your Express app is exported from index.ts

    describe('Auth Routes', () => {
      it('should return the default sign-in page', async () => {
        const res = await request(app).get('/api/auth/signin');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Sign in with Google');
      });

      it('should return an empty session for an unauthenticated user', async () => {
        const res = await request(app).get('/api/auth/session');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({});
      });
    });
    ```

3.  **Run and Confirm Failure:** Run the test suite from the `goodnumbers` directory. The new tests should fail with `404 Not Found` errors. This is the expected outcome of the "Red" step.

    ```bash
    cd goodnumbers
    npm test
    ```

### Stage 5: Implement to Pass Tests (The "Green" Step)

**Goal:** Write the minimum amount of code required to make the failing tests pass.

1.  **Integrate Auth.js into the Express Server:** This is the work originally planned for Stage 3. Create the `goodnumbers/src/routes/auth.ts` file and mount the `authRouter` in `goodnumbers/src/index.ts` as detailed below.

    *   **Create the Auth Route Handler (`src/routes/auth.ts`):**
        ```typescript
        // src/routes/auth.ts
        import { Router } from "express";
        import { Auth } from "@auth/core";
        import { authOptions } from "../lib/auth";

        const authRouter = Router();

        // We add a try-catch block to prevent server crashes from unhandled errors in the Auth.js library.
        authRouter.all("/*", async (req, res) => {
          try {
            const request = new Request(req.protocol + "://" + req.get("host") + req.originalUrl, {
              method: req.method,
              headers: req.headers as HeadersInit,
              body: req.method !== "GET" ? req.body : undefined,
            });

            const response = await Auth(request, authOptions);
            
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });

            res.status(response.status).send(await response.text());
          } catch (error) {
            console.error("[AUTH_ERROR]", error);
            res.status(500).send("An internal authentication error occurred.");
          }
        });

        export default authRouter;
        ```

    *   **Mount the Auth Router in Express (`src/index.ts`):**
        ```typescript
        // src/index.ts
        // ... other imports
        import authRouter from './routes/auth'; // Add this import

        // ... app setup (app.use(helmet()), etc.)

        // IMPORTANT: This middleware is required for Auth.js to correctly parse POST requests.
        // It must be placed BEFORE the authRouter.
        app.use(express.json());

        // --- ROUTES ---
        app.use("/api/auth", authRouter);

        // ... existing routes (barrier, etc.)

        // ... error handling and server start
        ```

2.  **Run and Confirm Success:** Run the test suite again. With the routes now implemented, the tests you wrote in the previous stage should pass.

    ```bash
    cd goodnumbers
    npm test
    ```

### Stage 6: Manual End-to-End Verification

**Goal:** With the automated tests passing, manually test the entire authentication flow to ensure it meets the requirements defined in the PRD and Technical Specification.

Follow these steps carefully.

1.  **Test New User Registration:**
    *   **Action:** Open a private/incognito browser window. Navigate to `http://localhost:3000/api/auth/signin`.
    *   **Action:** Click the "Sign in with Google" button and log in with a Google account that has **never** been used with this application before.
    *   **Expected Result:** After authenticating with Google, you should be redirected back to the application.
    *   **Database Check:** Use a database tool (or `npx prisma studio`) to inspect your `dev.db` file.
        *   Verify that a new record has been created in the `User` table for the new user.
        - Verify that a corresponding record has been created in the `Account` table, linking the User to the Google provider.

2.  **Test Existing User Login:**
    *   **Action:** Log out by navigating to `http://localhost:3000/api/auth/signout`.
    *   **Action:** Close the browser window and open a new private/incognito window.
    *   **Action:** Navigate to `http://localhost:3000/api/auth/signin` again.
    *   **Action:** Log in with the **same** Google account you used before.
    *   **Expected Result:** You should be logged in successfully.
    *   **Database Check:** Verify that **no new User record** was created. The system should have found and used the existing record.

3.  **Test Session Management:**
    *   **Action:** After logging in, try to navigate to `http://localhost:3000/api/auth/session`.
    *   **Expected Result:** You should see a JSON object containing your minimal session information (`id`, `email`, `agreementsSigned`).
    *   **Action:** Log out again. Navigate back to `http://localhost:3000/api/auth/session`.
    *   **Expected Result:** You should see an empty JSON object `{}`.

**Note on the "Agreements Page":** This task provides the foundational authentication mechanism. The specific server-side logic to enforce the agreement gate (i.e., checking the `agreementsSigned` flag and redirecting the user) will be implemented in the next task, **Phase 2, Task 3**. The user-facing UI for the agreements page will be built in **Phase 4**.

## 4. Final Steps

1.  **Review Your Code:** Read through all the changes you have made. Ensure the code is clean, commented where necessary, and follows project conventions.
2.  **Commit Your Changes:** Stage and commit your work with a clear, conventional commit message.

    ```bash
    git add .
    git commit -m "feat(auth): P2_T2 integrate auth.js with google provider"
    ```

3.  **Create a Pull Request:** Push your branch and open a Pull Request against the `develop` branch.

    ```bash
    git push --set-upstream origin feat/P2_T2-authjs-integration
    gh pr create --base develop --title "feat(auth): P2_T2 integrate auth.js" --body "This PR integrates Auth.js for user authentication using the Google provider and Prisma adapter, as outlined in the Phase 2, Task 2 implementation plan."
    ```

You have now completed the backend integration for user authentication.
