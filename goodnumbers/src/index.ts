import './lib/env.ts';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts';

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
      'FATAL: Environment variable AUTH_GOOGLE_SECRET is not set.'
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

  // If your app is served through a proxy, trust the proxy to allow us to read the `X-Forwarded-*` headers
  app.set('trust proxy', true);

  app.use('/api/auth', ExpressAuth(authConfig));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
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
if (import.meta.url.startsWith('file://') && process.argv[1] === new URL(import.meta.url).pathname) {
    startServer();
}