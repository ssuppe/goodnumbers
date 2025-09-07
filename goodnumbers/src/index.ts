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
          'img-src': ["'self'", 'data:', 'https://authjs.dev'], // Allow images from authjs.dev
          'form-action': ["'self'", '*'], // Add this line to allow form submissions to any origin
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
  app.use(express.static('public')); // Serve static files from 'public' directory

  // If running behind a proxy in production (e.g., Google Cloud Run),
  // trust the `X-Forwarded-*` headers. In dev/test, this is not needed and can be a security risk.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // --- Auth Routes ---
  app.use('/api/auth', ExpressAuth(authConfig));

  // --- API Routes ---
  // The imports have been moved to the top of the file.
  app.use('/api/user', userRoutes); // All user routes are prefixed

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/api/session', async (req, res) => {
    const session = await getSession(req, authConfig);
    res.json(session);
  });

  // Example of a fully protected route for dashboard access
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
// This allows test runners to import the module without starting the server.
if (
  import.meta.url.startsWith('file://') &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  startServer();
}
