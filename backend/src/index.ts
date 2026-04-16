// Frontend/src/index.ts
import './lib/env.js';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.js';
import { getSession } from '@auth/express';
import cookieParser from 'cookie-parser';
import csrf from 'tiny-csrf';

import { escapeHtml } from './lib/utils.js';
import journalRoutes from './routes/journal.js';
import { errorHandler } from './middleware/errorHandler.js';
import userRoutes from './routes/user.js';
import { protect } from './middleware/auth.js';
import { enforceAgreements } from './middleware/enforceAgreements.js';
import { enforceAccountSetup } from './middleware/enforceAccountSetup.js'; // Updated import
import { redirectIfNotAgreed } from './middleware/redirectIfNotAgreed.js';

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
  // Apply the full, secure middleware chain to the journals API
  app.use(
    '/api/journals',
    protect,
    csrfProtection,
    enforceAgreements, // First, authorize API access
    enforceAccountSetup, // Then, handle UI flow
    journalRoutes,
  );

  // --- Health Check and other routes ---
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/api/session', async (req, res) =>
    res.json(await getSession(req, authConfig)),
  );
  app.get('/agreements', protect, (req, res) => {
    res.send(`<h1>Agreements Page</h1><p>User: ${escapeHtml(req.user?.email)}</p><p>Please sign the agreements.</p>
      <form id="agreement-form">
        <button type="submit">Sign Agreements</button>
      </form>
      <p id="message"></p>
<script src="/js/agreements.js"></script>
    `);
  });
  app.get('/setup-account', protect, redirectIfNotAgreed, (req, res) => {
    const prefilledUrl = escapeHtml(req.user?.nightscoutUrl);
    res.send(
      `
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
          <script src="/js/setup-account.js"></script>
      </body>
      </html>
    `,
    );
  });
  // Update the dashboard route as well
  app.get(
    '/dashboard',
    protect,
    redirectIfNotAgreed, // Redirect if agreements not signed
    enforceAccountSetup, // Then, handle UI flow
    (req, res) => {
      res.send(`Welcome, ${escapeHtml(req.user!.email)}!`);
    },
  );

  // --- Global Error Handler ---
  app.use(errorHandler);

  return app;
}
