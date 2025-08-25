# Goodnumbers — PHASE 4, TASK 3 (Revised)

Implement server-side middleware to enforce user agreement acceptance, blocking access to sensitive APIs until agreements are signed.

### Invariants (do not change)

- All state-modifying API endpoints must be protected by authentication and authorization checks.
- The system must never trust client-side enforcement of access control. Authorization logic MUST reside on the backend.
- A user's `agreementsSigned` status is the single source of truth for this authorization check.

### Assumptions & Scope

- **Assumption**: An authentication middleware (`protect`) already exists and correctly populates `req.auth.user.id` for authenticated users.
- **Assumption**: The `User` model in the Prisma schema includes a boolean field `agreementsSigned`.
- **Scope**: This task is limited to creating and applying the backend enforcement middleware. It does not include the frontend UI for signing agreements or the logic that sets the `agreementsSigned` flag to `true`.
- **Scope**: The middleware will be applied to existing API routes for journals (`/api/journals`) and specific user settings endpoints.
- **Observation**: The `IMPLEMENTATION_PLAN.md` mentions protecting `DELETE /me` and leaving `/session-status` and `/agreements` unprotected. These routes do not currently exist in `goodnumbers/src/routes/user.ts`. This plan will correctly proceed by protecting only the routes that _do_ exist (`/settings` and `/regenerate-rss-token`).

### Objectives

1.  **Create Authorization Middleware**: Implement a new Express middleware that checks the `agreementsSigned` flag for the current user in the database.
2.  **Secure Journal Routes**: Apply the new middleware to the entire `/api/journals` route group to protect all journal-related actions (CRUD).
3.  **Secure User Management Routes**: Apply the new middleware selectively to sensitive user endpoints (`PUT /settings`, `POST /regenerate-rss-token`).
4.  **Prevent Unauthorized Access**: Ensure requests from users with `agreementsSigned: false` to protected endpoints are rejected with a `403 Forbidden` status code and a specific JSON error payload.
5.  **Validate with Tests**: Implement a comprehensive integration test suite to verify both blocked (`403`) and permitted (success) access based on the `agreementsSigned` flag.

### Risks & Mitigations

- **Risk**: Incorrect middleware ordering (authorization before authentication) could lead to errors or security bypasses.
  - **Mitigation**: The implementation plan explicitly mandates that the `enforceAgreements` middleware is placed _after_ the `protect` (authentication) middleware in the Express route definitions.
- **Risk**: Applying the middleware globally could lock users out of the flow needed to sign the agreements in the first place.
  - **Mitigation**: The plan specifies applying the middleware only to specific, sensitive routes, leaving agreement-signing and session status endpoints unprotected by this specific check.
- **Risk**: Database connection failure during the check could lead to incorrect access decisions (fail-open).
  - **Mitigation**: The middleware will `try...catch` database operations and pass errors to the global error handler, which defaults to a secure "deny access" state and returns a `500` error.

### Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea**: Prevent users who haven't signed the terms of service from accessing core application features.
- **Mechanism**:
  1.  Develop a new Express middleware function named `enforceAgreements`.
  2.  This function will extract the `userId` from the `req.auth` object (populated by a preceding authentication middleware).
  3.  It will perform a database lookup on the `User` table for that `userId`.
  4.  If `user.agreementsSigned` is `false` or the user is not found, it will immediately respond with a `403 Forbidden` error.
  5.  If `true`, it will call `next()` to pass control to the next handler.
  6.  This middleware will then be attached to the relevant Express routes.
- **Trade-offs**:
  - **Performance**: Adds one database query to each protected API call. This is an acceptable cost for a critical security check. This could be optimized later by embedding the `agreementsSigned` status in the JWT session token if performance becomes a concern.
    - **Security Caveat**: While embedding the status in a JWT is faster, it introduces the risk of **stale sessions**. A JWT is a snapshot of the user's state when it was created. If a user's `agreementsSigned` status is later revoked server-side, their existing JWT will remain valid and continue to grant access until it expires. The current database-lookup approach provides **real-time authorization**, which is more secure and the correct choice for this critical check.
  - **Simplicity**: A centralized middleware is simpler, more maintainable, and less error-prone than adding this authorization check inside every individual controller/route handler.
- **Go/No-Go**: **Go**. This is a non-negotiable security requirement.

### Implementation Notes

- **API Contract**:
  - **Provider (Middleware)**:
    - Pre-condition: `req.auth.user.id` must exist.
    - Post-condition (Success): Calls `next()`.
    - Post-condition (Failure): Responds with `403 Forbidden` and a JSON body: `{ "message": "User agreements must be signed to access this resource.", "code": "AGREEMENTS_NOT_SIGNED" }`.
- **Attach Points**:
  - `goodnumbers/src/index.ts`: Apply to the `/api/journals` route group. The middleware order will be `protect`, `enforceAgreements`, `doubleCsrfProtection`.
  - `goodnumbers/src/routes/user.ts`: Apply to `PUT /settings` and `POST /regenerate-rss-token`. The middleware order will be `protect`, `enforceAgreements`, `doubleCsrfProtection`.
- **Error Handling**: Database errors within the middleware must be caught and passed to the `next(error)` function to be handled by the global error handler. This ensures a secure fail-closed state.

### Acceptance Gates

- An integration test making a `POST` request to `/api/journals` for a user with `agreementsSigned: false` must fail with a `403` status and the correct error code in the body.
- The same integration test, authenticated as a user with `agreementsSigned: true`, must pass with a `201` status.
- An integration test making a `PUT` request to `/api/user/settings` for a user with `agreementsSigned: false` must fail with a `403` status.
- The same test, authenticated as a user with `agreementsSigned: true`, must pass with a `200` status.

### “Make-sure-you” Checklist

- [ ] The new middleware file is created at `goodnumbers/src/middleware/enforceAgreements.ts`.
- [ ] The new middleware is placed immediately _after_ the existing `protect` middleware in all route definitions.
- [ ] The middleware handles the case where a user ID from the session does not correspond to a user in the database (defaults to deny).
- [ ] The middleware returns a clear, structured JSON error message on authorization failure.
- [ ] The middleware is applied to the entire `/api/journals` router in `index.ts`.
- [ ] The middleware is applied _only_ to the `PUT /settings` and `POST /regenerate-rss-token` routes in `user.ts`.
- [ ] CSRF protection is applied to all state-changing routes (`journals`, `user/settings`, `user/regenerate-rss-token`).
- [ ] All new code is covered by the provided integration test suite, demonstrating both "deny" and "allow" paths.

### Project hygiene prep

1.  **Create GitHub Issue**: Use the `gh` CLI to create an issue to track the work for this task.

    ```bash
    gh issue create --title "feat(security): P4_T3 add middleware to enforce agreements on backend" --body "Implement and apply server-side middleware to enforce the agreement gate, preventing access to sensitive APIs until agreements are signed. This resolves a critical security vulnerability."
    ```

2.  **Create Git Branch**: Create a new feature branch from the `develop` branch. Include the issue number in the branch name. (Example assumes the new issue is #43).

    ```bash
    git checkout develop
    git pull
    git checkout -b feat/43-agreement-enforcement-middleware
    ```

3.  **Follow Test-Driven Development**: Adhere to the Red-Green-Refactor cycle. Start by writing a failing test that defines the desired security behavior.

### In-depth test plan

The following test file should be created first to drive the implementation. It verifies all acceptance gates and follows a metamorphic testing pattern. It has been updated to include CSRF tokens for all state-changing requests.

<!-- file: goodnumbers/tests/integration/enforcement.test.ts -->

```typescript
import request from "supertest";
import { prisma } from "../../src/db";
import app from "../../src/index";
import type { User } from "@prisma/client";
import { connection as redisConnection } from "../../src/lib/queue";

describe("Agreement Enforcement Middleware", () => {
  let userWithNoAgreement: User;
  let userWithAgreement: User;
  let agent: request.SuperAgentTest;
  let csrfToken: string;

  beforeAll(async () => {
    // Clean database
    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test users
    [userWithNoAgreement, userWithAgreement] = await Promise.all([
      prisma.user.create({
        data: {
          email: "no-agreement@example.com",
          agreementsSigned: false,
        },
      }),
      prisma.user.create({
        data: {
          email: "with-agreement@example.com",
          agreementsSigned: true,
        },
      }),
    ]);

    // Setup supertest agent to handle cookies for CSRF
    agent = request.agent(app);
    const tokenRes = await agent.get("/api/csrf-token");
    csrfToken = tokenRes.body.csrfToken;
  });

  afterAll(async () => {
    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
    await redisConnection.quit();
  });

  describe("Journal Routes Protection", () => {
    it("should return 403 Forbidden for a user without signed agreements", async () => {
      const response = await agent
        .post("/api/journals")
        .set("x-test-user-id", userWithNoAgreement.id)
        .set("x-csrf-token", csrfToken)
        .send({ title: "My Journal" }); // Example payload

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("AGREEMENTS_NOT_SIGNED");
    });

    it("should return 201 Created for a user with signed agreements", async () => {
      const response = await agent
        .post("/api/journals")
        .set("x-test-user-id", userWithAgreement.id)
        .set("x-csrf-token", csrfToken)
        .send({ title: "My Journal" }); // Example payload

      expect(response.status).toBe(201);
    });
  });

  describe("User Settings Route Protection", () => {
    const settingsPayload = {
      nightscoutUrl: "https://my-nightscout.com",
      nightscoutToken: "my-token",
      preferredUnits: "MGDL",
    };

    it("should return 403 Forbidden for a user without signed agreements", async () => {
      const response = await agent
        .put("/api/user/settings")
        .set("x-test-user-id", userWithNoAgreement.id)
        .set("x-csrf-token", csrfToken) // <-- ADDED CSRF TOKEN
        .send(settingsPayload);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("AGREEMENTS_NOT_SIGNED");
    });

    it("should return 200 OK for a user with signed agreements", async () => {
      const response = await agent
        .put("/api/user/settings")
        .set("x-test-user-id", userWithAgreement.id)
        .set("x-csrf-token", csrfToken) // <-- ADDED CSRF TOKEN
        .send(settingsPayload);

      expect(response.status).toBe(200);
    });
  });

  describe("User RSS Token Route Protection", () => {
    it("should return 403 Forbidden for a user without signed agreements", async () => {
      const response = await agent
        .post("/api/user/regenerate-rss-token")
        .set("x-test-user-id", userWithNoAgreement.id)
        .set("x-csrf-token", csrfToken) // <-- ADDED CSRF TOKEN
        .send();

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("AGREEMENTS_NOT_SIGNED");
    });

    it("should return 200 OK for a user with signed agreements", async () => {
      const response = await agent
        .post("/api/user/regenerate-rss-token")
        .set("x-test-user-id", userWithAgreement.id)
        .set("x-csrf-token", csrfToken) // <-- ADDED CSRF TOKEN
        .send();

      expect(response.status).toBe(200);
    });
  });
});
```

### In-depth engineering plan

**Step 1: Create the Middleware File**

Create a new file to house the authorization logic. The safeguard check now correctly returns a `500` status and logs a critical error.

<!-- file: goodnumbers/src/middleware/enforceAgreements.ts -->

```typescript
import { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";

/**
 * Middleware to enforce that a user has signed the agreements.
 * This middleware MUST run AFTER the authentication middleware (`protect`).
 * It checks the `agreementsSigned` flag in the database for the authenticated user.
 *
 * @param req - The Express request object, expecting `req.auth.user.id` to be populated.
 * @param res - The Express response object.
 * @param next - The Express next function.
 */
export const enforceAgreements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.auth?.user?.id;

    // This state should be impossible if `protect` runs first.
    // It indicates a server logic error, not a client authentication error.
    if (!userId) {
      console.error(
        "[FATAL] userId not found in request after 'protect' middleware. This indicates a critical server misconfiguration."
      );
      return res.status(500).json({ message: "Internal server error" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agreementsSigned: true },
    });

    // If user not found in DB or agreements are not signed, deny access.
    if (!user || !user.agreementsSigned) {
      return res.status(403).json({
        message: "User agreements must be signed to access this resource.",
        code: "AGREEMENTS_NOT_SIGNED",
      });
    }

    // If agreements are signed, proceed to the next handler.
    next();
  } catch (error) {
    // Pass database or other unexpected errors to the global error handler.
    // This defaults to a secure "deny" state.
    next(error);
  }
};
```

**Step 2: Apply Middleware to Journal Routes**

Modify `goodnumbers/src/index.ts` to apply the new middleware to all journal-related API endpoints. The order of middleware application is critical for security and correct error responses.

<!-- file: goodnumbers/src/index.ts -->

```typescript
// goodnumbers/src/index.ts
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import { ExpressAuth } from "@auth/express";
import { authConfig } from "./lib/auth.js";
import { protect } from "./middleware/auth.js";
import {
  doubleCsrfProtection,
  generateCsrfToken,
  invalidCsrfTokenError,
} from "./middleware/csrf.js";
import { errorHandler } from "./middleware/errorHandler.js";
import userRouter from "./routes/user.js";
import { journalsRouter } from "./routes/journals.js";
import { enforceAgreements } from "./middleware/enforceAgreements.js"; // <-- IMPORT

const app = express();
const port = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "https://authjs.dev",
          "https://lh3.googleusercontent.com",
        ],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://oauth2.googleapis.com",
          "https://www.googleapis.com",
        ],
        formAction: ["'self'", "https://accounts.google.com"],
        frameSrc: ["'self'", "https://accounts.google.com"],
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
app.use(express.json()); // Body parser
app.use(cookieParser());

// --- Static Files ---
app.use(express.static("public"));

// --- Auth.js Middleware ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use("/api/auth", ExpressAuth(authConfig as any));

// API route for the frontend to get a CSRF token
app.get("/api/csrf-token", (req, res) => {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

// --- API Routes ---
app.use("/api/user", userRouter);

// Apply middleware stack to the entire journals route group.
// Order is CRITICAL: 1. Auth check, 2. Agreement check, 3. CSRF check.
app.use(
  "/api/journals",
  protect,
  enforceAgreements, // <-- APPLY MIDDLEWARE HERE
  doubleCsrfProtection,
  journalsRouter
);

// --- Health Check Endpoint ---
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// --- Error Handling Middleware ---

// Specific error handler for CSRF issues
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err === invalidCsrfTokenError) {
      return res.status(403).json({ message: "Invalid CSRF token" });
    }
    next(err);
  }
);

// Global Error Handler - THIS MUST BE THE LAST MIDDLEWARE
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
```

**Step 3: Apply Middleware to User Routes**

Modify `goodnumbers/src/routes/user.ts` to apply the middleware only to the sensitive, state-changing endpoints. CSRF protection has now been added.

<!-- file: goodnumbers/src/routes/user.ts -->

```typescript
// goodnumbers/src/routes/user.ts
import express from "express";
import { userSettingsSchema } from "../lib/schemas.js";
import { encrypt } from "../lib/encryption.js";
import { protect } from "../middleware/auth.js";
import { prisma } from "../db.js";
import rateLimit from "express-rate-limit";
import { validateRequest } from "../middleware/validateRequest.js";
import { createId } from "@paralleldrive/cuid2";
import { enforceAgreements } from "../middleware/enforceAgreements.js"; // <-- IMPORT
import { doubleCsrfProtection } from "../middleware/csrf.js"; // <-- IMPORT CSRF

const router = express.Router();

// A stricter rate limiter for sensitive operations
const sensitiveOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * PUT /api/user/settings
 * Description: Updates the settings for the authenticated user.
 * Access: Private (requires authentication, signed agreements, and CSRF token)
 */
router.put(
  "/settings",
  protect,
  enforceAgreements,
  doubleCsrfProtection, // <-- APPLY CSRF MIDDLEWARE HERE
  validateRequest(userSettingsSchema),
  async (req, res, next) => {
    try {
      const userId = req.auth?.user?.id;
      if (!userId) {
        console.error(
          "[FATAL] userId not found in request after protect middleware."
        );
        return res.status(500).json({ message: "Internal server error." });
      }

      const { nightscoutUrl, nightscoutToken, preferredUnits } = req.body;

      const encryptedUrl = encrypt(nightscoutUrl);
      const encryptedToken = encrypt(nightscoutToken);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          nightscoutUrl: encryptedUrl,
          nightscoutToken: encryptedToken,
          preferredUnits: preferredUnits,
        },
        select: {
          id: true,
          email: true,
          preferredUnits: true,
        },
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/regenerate-rss-token
 * Description: Regenerates the RSS token for the authenticated user.
 * Access: Private (requires authentication, signed agreements, and CSRF token)
 */
router.post(
  "/regenerate-rss-token",
  protect,
  enforceAgreements,
  doubleCsrfProtection, // <-- APPLY CSRF MIDDLEWARE HERE
  sensitiveOperationLimiter,
  async (req, res, next) => {
    try {
      const userId = req.auth?.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authorized" });
      }

      const newToken = createId();

      await prisma.user.update({
        where: { id: userId },
        data: {
          rssToken: newToken,
        },
      });

      res.status(200).json({ rssToken: newToken });
    } catch (error) {
      next(error);
    }
  }
);

// NOTE: We are intentionally NOT applying `enforceAgreements` to any other user routes
// that might be added, such as GET /api/user/session-status or POST /api/user/sign-agreements,
// as the user must be able to access those before signing.

export default router;
```

**Step 4: Execute Tests and Finalize**

1.  Run the newly created integration tests to confirm the logic is correct and passes.

    ```bash
    cd goodnumbers && npm test -- tests/integration/enforcement.test.ts
    ```

2.  Once all tests pass, commit the changes using the Conventional Commit standard.

    ```bash
    git add .
    git commit -m "feat(security): P4_T3 add middleware to enforce agreements on backend"
    ```

3.  Push the branch and create a Pull Request, linking it to the issue created in the prep stage.

    ```bash
    git push origin feat/43-agreement-enforcement-middleware
    gh pr create --base develop --title "feat(security): P4_T3 Add middleware to enforce agreements" --body "Closes #43. This PR introduces and applies the enforceAgreements middleware to secure sensitive API endpoints, ensuring users cannot access core features without having signed the terms of service."
    ```
