// Frontend/src/index.ts
import './lib/env.ts';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts';
import { getSession } from '@auth/express';

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

  // Placeholder for the agreements page. It's protected because a user must be logged in
  // to even know if they need to sign agreements.
  app.get('/agreements', protect, enforceOnboarding, (req, res) => {
    res.send(`<h1>Agreements Page</h1><p>User: ${req.user?.email}</p><p>Please sign the agreements.</p>
      <form action="/api/user/agreements" method="POST"><button type="submit">Sign Agreements</button></form>
    `);
  });

  // Placeholder for the account setup page.
  app.get('/setup-account', protect, (req, res) => {
    res.send(
      `<h1>Account Setup Page</h1><p>User: ${req.user?.email}</p><p>Please set up your account.</p>`,
    );
  });

  // Main dashboard, protected by both authentication and onboarding middleware.
  app.get('/dashboard', protect, enforceOnboarding, (req, res) => {
    res.send(`Welcome to the dashboard, user ${req.user!.id}!`);
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
