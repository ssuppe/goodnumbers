import './lib/env.ts';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts';
import { getSession } from '@auth/express';

import { escapeHtml } from './lib/utils.ts';

// Correctly placed top-level imports
import userRoutes from './routes/user.ts';
import { protect } from './middleware/auth.ts';
import { enforceOnboarding } from './middleware/onboarding.ts';

// This function encapsulates the app creation and validation logic.
export function createApp() {
  // --- Fatal Error Checks for Environment Variables ---
  if (!process.env.AUTH_SECRET) {
    throw new Error('FATAL: Environment variable AUTH_SECRET is not set.');
  }
  if (!process.env.AUTH_GOOGLE_ID) {
    throw new Error('FATAL: Environment variable AUTH_GOOGLE_ID is not set.');
  }
  if (!process.env.AUTH_GOOGLE_SECRET) {
    throw new Error(
      'FATAL: Environment variable AUTH_GOOGLE_SECRET is not set.',
    );
  }

  const app = express();

  // --- Security Middlewares ---
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'img-src': ["'self'", 'data:', 'https://authjs.dev'],
          'form-action': ["'self'", '*'],
        },
      },
    }),
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
  app.use(express.static('public'));

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // --- Auth Routes ---
  app.use('/api/auth', ExpressAuth(authConfig));

  // --- API Routes ---
  app.use('/api/user', userRoutes);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/api/session', async (req, res) => {
    const session = await getSession(req, authConfig);
    res.json(session);
  });

  // --- Onboarding and Application Routes ---

  // Placeholder for the agreements page. It is protected, but does NOT need
  // the onboarding middleware, as this is the destination for users who
  // have not completed this step.
  app.get('/agreements', protect, (req, res) => {
    res.send(`<h1>Agreements Page</h1><p>User: ${escapeHtml(req.user?.email)}</p><p>Please sign the agreements.</p>
      <form id="agreement-form">
        <button type="submit">Sign Agreements</button>
      </form>
      <p id="message"></p>
      <script>
        document.getElementById('agreement-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const messageEl = document.getElementById('message');
          messageEl.textContent = 'Saving...';
          const response = await fetch('/api/user/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agreementsSigned: true })
          });
          if (response.ok) {
            window.location.href = '/setup-account';
          } else {
            messageEl.textContent = 'An error occurred.';
          }
        });
      </script>
    `);
  });

  // Placeholder for the account setup page.
  app.get('/setup-account', protect, (req, res) => {
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
          <script>
            document.getElementById('settings-form').addEventListener('submit', async (e) => {
              e.preventDefault();
              const messageEl = document.getElementById('message');
              messageEl.textContent = 'Saving...';

              const formData = new FormData(e.target);
              const data = Object.fromEntries(formData.entries());

              if (data.nightscoutUrl === '') data.nightscoutUrl = null;
              if (data.nightscoutToken === '') data.nightscoutToken = null;

              try {
                const response = await fetch('/api/user/settings', {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                });

                if (response.ok) {
                  messageEl.textContent = 'Settings saved successfully! Redirecting...';
                  setTimeout(() => window.location.href = '/dashboard', 1500);
                } else {
                  const errorData = await response.json();
                  const errorMsg = errorData.errors ? errorData.errors[0].message : 'Could not save settings.';
                  messageEl.textContent = 'Error: ' + errorMsg;
                }
              } catch (error) {
                console.error('Failed to save settings:', error);
                messageEl.textContent = 'A network error occurred. Please try again.';
              }
            });
          </script>
      </body>
      </html>
    `,
    );
  });

  // Main dashboard, protected by both authentication and onboarding middleware.
  app.get('/dashboard', protect, enforceOnboarding, (req, res) => {
    res.send(`Welcome to the dashboard, user ${escapeHtml(req.user!.email)}!`);
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
  import.meta.url.startsWith('file://') &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  startServer();
}
