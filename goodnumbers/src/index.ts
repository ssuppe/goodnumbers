import './lib/env.ts';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts';
import { getSession } from '@auth/express';
import cookieParser from 'cookie-parser';
import csrf from 'tiny-csrf';

import { escapeHtml } from './lib/utils.ts';
import journalRoutes from './routes/journal.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import userRoutes from './routes/user.ts';
import { protect } from './middleware/auth.ts';
import { enforceOnboarding } from './middleware/onboarding.ts';

export function createApp() {
  // --- Fatal Error Checks ---
  if (!process.env.AUTH_SECRET)
    throw new Error('FATAL: Environment variable AUTH_SECRET is not set.');
  if (!process.env.AUTH_GOOGLE_ID)
    throw new Error('FATAL: Environment variable AUTH_GOOGLE_ID is not set.');
  if (!process.env.AUTH_GOOGLE_SECRET)
    throw new Error(
      'FATAL: Environment variable AUTH_GOOGLE_SECRET is not set.',
    );
  const csrfSecret = process.env.CSRF_SECRET;
  if (
    !csrfSecret ||
    (process.env.NODE_ENV !== 'test' && csrfSecret.length < 32)
  ) {
    throw new Error(
      'FATAL: CSRF_SECRET is not set or is not 32+ characters long.',
    );
  }
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret) throw new Error('FATAL: COOKIE_SECRET is not set.');

  const app = express();

  // --- Security & Core Middlewares ---
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.static('public'));

  // --- CRITICAL MIDDLEWARE ORDER ---
  // 1. Parse cookies first, as they are needed by auth and CSRF.
  app.use(cookieParser(cookieSecret));

  // 2. Parse the body next, so CSRF can read `req.body._csrf`.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // 3. Initialize Auth.js session handling.
  app.use('/api/auth', ExpressAuth(authConfig));

  // Create a reusable CSRF protection middleware.
  const csrfProtection = csrf(
    csrfSecret,
    ['POST', 'PUT', 'DELETE'],
    ['/api/auth/callback/google'],
  );

  // --- API Routes ---

  // This public endpoint provides the token to the client.
  // It needs to run AFTER cookie parser but BEFORE CSRF protection is applied anywhere.
  app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // Now, apply protection to all subsequent API routes.
  app.use('/api/user', protect, csrfProtection, userRoutes);
  app.use(
    '/api/journals',
    protect,
    enforceOnboarding,
    csrfProtection,
    journalRoutes,
  );

  // --- Health Check and other routes ---
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/api/session', async (req, res) =>
    res.json(await getSession(req, authConfig)),
  );
  app.get('/agreements', protect, (req, res) => {
    res.send(`<h1>Agreements Page</h1>...`);
  });
  app.get('/setup-account', protect, (req, res) => {
    res.send(`<h1>Account Setup Page</h1>...`);
  });
  app.get('/dashboard', protect, enforceOnboarding, (req, res) => {
    res.send(`Welcome, ${escapeHtml(req.user!.email)}!`);
  });

  // --- Global Error Handler ---
  app.use(errorHandler);

  return app;
}

// --- Server Startup Logic ---
if (
  import.meta.url.startsWith('file://') &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}
