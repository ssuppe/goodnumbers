# Authentication Configuration (Auth.js + Credentials)

The project uses **Auth.js v5 (Express)** with a **Credentials Provider** and a **Prisma Adapter**.

## Architecture

- **Provider:** Credentials (Email/Password).
- **Session Strategy:** JWT (JSON Web Tokens) signed with `AUTH_SECRET`.
- **Database:** SQLite (via Prisma).
- **Encryption:** User passwords are hashed using `bcrypt` (see `backend/src/lib/passwords.ts`).
- **Authorization:** An email allowlist is enforced (`backend/config/allowed_emails.txt`).

## Environment Variables

The following variables must be set in your `.env` for authentication to function:

- `AUTH_SECRET`: A secure random string used to sign session cookies.
- `AUTH_URL`: The base URL of your application (e.g., `http://localhost:5173` in dev).
- `ENCRYPTION_KEY`: A 32-byte (64-character) hex string for encrypting sensitive user data (like Nightscout tokens).

## Core Files

- `backend/src/lib/auth.ts`: Main Auth.js configuration, provider setup, and callbacks.
- `backend/src/lib/auth-utils.ts`: Utility functions for allowlist checking.
- `backend/src/middleware/auth.ts`: The `protect` middleware used to secure API routes.
- `backend/src/routes/user.ts`: Handles user settings and secure token storage.

## Workflow

1.  **Registration:** Users must be on the allowlist to register. Upon registration, their password is hashed and stored in SQLite.
2.  **Login:** The `authorize` callback verifies the password against the stored hash.
3.  **Session:** A signed JWT is stored in a cookie. The session is enriched with the user's ID and settings via the `jwt` and `session` callbacks.
4.  **Protection:** Routes wrapped with the `protect` middleware require a valid session.
