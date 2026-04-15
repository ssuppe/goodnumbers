You've raised an excellent point. My apologies. Adhering to TDD principles is crucial, and you are correct to challenge a plan that relies solely on manual verification.

While the placeholder UI itself is a temporary testing tool that will be discarded, the new `GET /api/session` endpoint is a piece of production backend code. As such, it **must** be accompanied by its own automated integration test.

Relying on a manual UI test to validate a permanent API endpoint is a violation of TDD. The endpoint's contract must be verified independently.

I have updated the plan to include a new integration test for the `/api/session` endpoint. This ensures that even after the placeholder UI is removed, we have an automated guarantee that the session endpoint functions correctly.

---

# Goodnumbers — `todo.md` (Phase 2, Task 2 - TDD Compliant)

## TL;DR

Implement a minimal HTML/JS UI served by Express to manually test the complete Google OAuth login/logout flow, and add a dedicated integration test to automatically verify the new `/api/session` endpoint contract.

## Invariants (do not change)

- All authentication logic must be handled by `@auth/express` v5.
- The UI must be a single, static HTML file with vanilla JavaScript.
- All new API endpoints must be accompanied by automated integration tests.

## Assumptions & Scope

- **Assumption: Project State:** This task begins from the state of the project at the completion of Phase 2, Task 1.
- **Assumption: Core Auth.js Integration:** The core Auth.js v5 components, configuration, and middleware are already integrated into the Express application.
- **Scope:** This task includes creating a static HTML page, enabling an Express static file server, and adding a `GET /api/session` endpoint with its corresponding integration test.
- **Out of Scope:** Advanced UI styling, integration with a frontend framework, automated End-to-End (E2E) testing for the HTML page itself.

## Objectives

1.  **Validate Session Endpoint Contract (TDD):** Create a failing integration test for the `/api/session` endpoint, then implement the endpoint to make the test pass.
2.  **Enable Static Asset Serving:** Successfully configure the Express server to serve static files from a `public` directory.
3.  **Implement Session Endpoint:** Create a `GET /api/session` endpoint that uses `getSession` from Auth.js to return the current user's session object.
4.  **Develop Placeholder UI:** Create a single `index.html` file that consumes the `/api/session` endpoint.
5.  **Verify End-to-End Flow:** Manually verify the complete user authentication lifecycle using the placeholder UI.

## Risks & Mitigations

- **Risk:** The `/api/session` endpoint inadvertently exposes sensitive data not required by the UI.
  - **Mitigation:** The endpoint will only return the default session object provided by the `getSession` utility. The new integration test will assert the shape of the returned object, acting as a contract test.
- **Risk:** The CSRF protection mechanism in Auth.js v5 complicates the simple HTML form POST for sign-out.
  - **Mitigation:** The manual test plan serves as the primary verification gate for the UI's interaction with the backend. If sign-out fails, the test will catch it.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Provide a simple, fast, and isolated method to test the entire backend authentication flow while ensuring the new API endpoint is covered by automated tests.
- **Mechanism:**
  1.  **Test-Driven Development (TDD):**
      - **RED:** Write a new integration test for `GET /api/session`. The test will initially fail with a 404.
      - **GREEN:** Implement the `/api/session` route in `src/index.ts` to make the test pass.
  2.  **UI Implementation:**
      - Integrate the `express.static` middleware into `src/index.ts`.
      - Create the `public/index.html` file with JavaScript to consume the now-tested endpoint.
- **Trade-offs:** This approach slightly increases the task's scope by adding a new test file, but it significantly improves long-term quality by ensuring the API endpoint is robust and maintainable. This is a positive trade-off.
- **Go/No-Go:** Go. The updated plan is more robust and aligns with the project's TDD philosophy.

## Implementation Notes

- **API Endpoint:** `GET /api/session`. Implementation must use `getSession` from `@auth/express`.
- **Testing:** The new integration test must cover both authenticated and unauthenticated states by mocking the `getSession` function.
- **Static Serving:** Use `app.use(express.static('public'))` in `src/index.ts`.
- **Sign-Out Form:** The sign-out button must be of `type="submit"` inside a `<form>` with `method="POST"` and `action="/api/auth/signout"`.

## Acceptance Gates

1.  **Automated tests for `/api/session` pass successfully.**
2.  Navigating a browser to `http://localhost:3000/` serves the `public/index.html` file.
3.  The rendered page correctly displays the "Logged out" status initially.
4.  The full manual sign-in/sign-out flow works as expected.

## “Make-sure-you” Checklist

- [ ] Have you created the new integration test for `/api/session` **before** implementing the endpoint?
- [ ] Does your new test cover both authenticated and unauthenticated scenarios?
- [ ] Have you created the `public` directory at the root of the `goodnumbers` project?
- [ ] Have you correctly registered the `express.static` middleware in `src/index.ts`?
- [ ] Is your `index.html` file using only vanilla JavaScript?
- [ ] Have you performed the full manual test flow and confirmed it works after all automated tests pass?

## Project hygiene prep

1.  **Create a GitHub Issue:**
    ```bash
    gh issue create --title "feat(auth): P2_T2 Add Placeholder UI and Session Endpoint" --body "Creates a minimal HTML/JS UI to manually test the auth flow and adds a TDD-compliant /api/session endpoint with integration tests. Closes P2_T2."
    ```
2.  **Create a Feature Branch:**
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/P2_T2-auth-test-ui
    ```

## In-depth test plan

### Automated Integration Test (New)

A new test file will be created to verify the `/api/session` endpoint. We will mock the `getSession` function to simulate different authentication states.

```typescript
// file: goodnumbers/tests/integration/session.test.ts
import request from "supertest";
import { app } from "../../src/index.js";
import * as http from "http";
import { jest } from "@jest/globals";

// Mock the getSession function from @auth/express
jest.unstable_mockModule("@auth/express", () => ({
  getSession: jest.fn(),
}));

// We need to dynamically import getSession after the mock is set up
const { getSession } = await import("@auth/express");
const mockedGetSession = getSession as jest.Mock;

let server: http.Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  // Reset the mock before each test
  mockedGetSession.mockClear();
});

describe("GET /api/session", () => {
  it("should return null when the user is not authenticated", async () => {
    // Arrange: Simulate no session
    mockedGetSession.mockResolvedValue(null);

    // Act
    const response = await request(server).get("/api/session");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it("should return the session object when the user is authenticated", async () => {
    // Arrange: Simulate an active session
    const mockSession = {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    mockedGetSession.mockResolvedValue(mockSession);

    // Act
    const response = await request(server).get("/api/session");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockSession);
  });
});
```

### Manual Test Plan

The manual test plan remains the same, but it is now a secondary verification of the complete E2E flow after the API's contract has been guaranteed by automated tests.

1.  **Unauthenticated Journey:** Navigate to `/`. Verify "Logged out" status.
2.  **Authentication Flow:** Click sign-in, complete Google flow, return to `/`. Verify "Logged in" status with user email.
3.  **Logout Flow:** Click "Sign Out". Verify return to "Logged out" status.

## In-depth engineering plan

### Action 1: Write Failing Test for `/api/session`

Create the new test file `goodnumbers/tests/integration/session.test.ts` with the code from the test plan above. Run the test suite.

```bash
cd goodnumbers
npm test
```

This will fail because the `/api/session` route does not exist, resulting in a 404 error. This is our **RED** state.

### Action 2: Implement Endpoint and Static Serving to Pass Test

Update the main server file `goodnumbers/src/index.ts` to add the `express.static` middleware and the `/api/session` route.

```typescript
// file: goodnumbers/src/index.ts
import "./lib/env.ts";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ExpressAuth } from "@auth/express";
import { authConfig } from "./lib/auth.ts";
import { getSession } from "@auth/express";

// This function encapsulates the app creation and validation logic.
export function createApp() {
  // --- Fatal Error Checks for Environment Variables ---
  if (!process.env.AUTH_SECRET) {
    throw new Error("FATAL: Environment variable AUTH_SECRET is not set.");
  }
  if (!process.env.AUTH_GOOGLE_ID) {
    throw new Error("FATAL: Environment variable AUTH_GOOGLE_ID is not set.");
  }
  if (!process.env.AUTH_GOOGLE_SECRET) {
    throw new Error(
      "FATAL: Environment variable AUTH_GOOGLE_SECRET is not set."
    );
  }

  const app = express();

  // --- Security Middlewares ---
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "img-src": ["'self'", "data:", "https://authjs.dev"], // Allow images from authjs.dev
        },
      },
    })
  );
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // --- Core Middlewares ---
  app.use(express.json());
  app.use(express.static("public")); // Serve static files from 'public' directory

  // If your app is served through a proxy, trust the proxy to allow us to read the `X-Forwarded-*` headers
  app.set("trust proxy", true);

  // --- Auth Routes ---
  app.use("/api/auth", ExpressAuth(authConfig));

  // --- API Routes ---
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/api/session", async (req, res) => {
    const session = await getSession(req, authConfig);
    res.json(session);
  });

  return app;
}

// Create the app instance using the factory function.
export const app = createApp();

// This function handles the server startup.
function startServer() {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Only start the server if the file is run directly.
if (
  import.meta.url.startsWith("file://") &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  startServer();
}
```

Run the test suite again. The new integration test should now pass. This is our **GREEN** state.

### Action 3: Create the Placeholder UI File

Create a new directory `goodnumbers/public/` and add the `index.html` file within it.

````html
// file: goodnumbers/public/index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Goodnumbers Auth Test</title>
    <style>
      body {
        font-family: sans-serif;
        padding: 2em;
        line-height: 1.5;
      }
      #auth-container {
        border: 1px solid #ccc;
        padding: 1em;
        border-radius: 8px;
        max-width: 400px;
      }
      button,
      a {
        font-size: 1em;
        padding: 0.5em 1em;
        cursor: pointer;
        text-decoration: none;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <h1>Goodnumbers Auth Test Page</h1>
    <div id="auth-container">
      <p>Loading session status...</p>
    </div>

    <script>
      const authContainer = document.getElementById("auth-container");

      async function updateUI() {
        try {
          const res = await fetch("/api/session");
          if (!res.ok) {
            throw new Error(`Server responded with status: ${res.status}`);
          }
          const session = await res.json();

          if (session && session.user) {
            // User is logged in
            authContainer.innerHTML = `
              <p><strong>Status:</strong> Logged in</p>
              <p><strong>Email:</strong> ${session.user.email}</p>
              <form action="/api/auth/signout" method="POST">
                  <button type="submit">Sign Out</button>
              </form>
            `;
          } else {
            // User is logged out
            authContainer.innerHTML = `
              <p><strong>Status:</strong> Logged out</p>
              <a href="/api/auth/signin/google">Sign in with Google</a>
            `;
          }
        } catch (error) {
          console.error("Error fetching session:", error);
          authContainer.innerHTML = `<p style="color: red;">Error fetching session. See console for details.</p>`;
        }
      }

      // Update the UI when the page loads
      document.addEventListener("DOMContentLoaded", updateUI);
    </script>
  </body>
</html>
``` ### Action 4: Commit and Push After running the manual tests successfully,
commit all changes. ```bash cd goodnumbers git add . git commit -m "feat(auth):
P2_T2 add placeholder ui and session endpoint" git push origin
feat/P2_T2-auth-test-ui
````
