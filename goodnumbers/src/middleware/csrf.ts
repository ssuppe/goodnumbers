// file: goodnumbers-workspace/src/server/middleware/csrf.ts
import { doubleCsrf } from 'csrf-csrf';
import { Request } from 'express';

// Security: A CSRF secret MUST be a cryptographically strong,
// randomly generated string and loaded from environment variables.
if (!process.env.CSRF_SECRET) {
  throw new Error('CSRF_SECRET environment variable is not set!');
}
const isProduction = process.env.NODE_ENV === 'production';

export const {
  invalidCsrfTokenError,
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: (_req: Request) => process.env.CSRF_SECRET as string,
  getSessionIdentifier: (req: Request) => req.session?.id || '',
  cookieName: isProduction ? '__Host-csrf-token' : 'csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProduction,
  },
  getTokenFromRequest: (req: Request) => req.headers['x-csrf-token'] as string,
});
