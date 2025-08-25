// goodnumbers/src/index.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.js';
import { protect } from './middleware/auth.js';
import {
  doubleCsrfProtection,
  generateCsrfToken,
  invalidCsrfTokenError,
} from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import userRouter from './routes/user.js';
import { journalsRouter } from './routes/journals.js';
import { enforceAgreements } from './middleware/enforceAgreements.js';

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
          'https://authjs.dev',
          'https://lh3.googleusercontent.com',
        ],
        connectSrc: [
          "'self'",
          'https://accounts.google.com',
          'https://oauth2.googleapis.com',
          'https://www.googleapis.com',
        ],
        formAction: ["'self'", 'https://accounts.google.com'],
        frameSrc: ["'self'", 'https://accounts.google.com'],
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
app.use(express.json()); // Body parser
app.use(cookieParser());

// --- Static Files ---
app.use(express.static('public'));

// --- Auth.js Middleware ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use('/api/auth', ExpressAuth(authConfig as any));

// API route for the frontend to get a CSRF token
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

// --- API Routes ---
app.use('/api/user', userRouter);

// Apply middleware stack to the entire journals route group.
// Order is CRITICAL: 1. Auth check, 2. Agreement check, 3. CSRF check.
app.use(
  '/api/journals',
  protect,
  enforceAgreements,
  doubleCsrfProtection,
  journalsRouter,
);

// --- Health Check Endpoint ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// --- Error Handling Middleware ---

// Specific error handler for CSRF issues
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err === invalidCsrfTokenError) {
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    next(err);
  },
);

// Global Error Handler - THIS MUST BE THE LAST MIDDLEWARE
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
