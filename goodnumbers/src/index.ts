// goodnumbers/src/index.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts'; // Note: .ts extension for ESM

// Import the new user router
import userRouter from './routes/user.ts';
import { journalsRouter } from './routes/journals.ts'; // Import the new journals router
import { protect } from './middleware/auth';
import cookieParser from 'cookie-parser';
import {
  doubleCsrfProtection,
  generateCsrfToken,
  invalidCsrfTokenError,
} from './middleware/csrf';

const app = express();
const port = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // Add CDN domains if you use them
        styleSrc: ["'self'", "'unsafe-inline'"], // Add CDNs if needed. 'unsafe-inline' is often needed for some libraries.
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(cookieParser());

// --- Static Files ---
app.use(express.static('public'));

// --- Auth.js Middleware ---
// All requests to /api/auth/* will be handled by Auth.js
app.use('/api/auth', ExpressAuth(authConfig));

// API route for the frontend to get a CSRF token
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

// --- API Routes ---
// Use the new user router for all routes starting with /api/user
app.use('/api/user', userRouter);
app.use('/api/journals', protect, doubleCsrfProtection, journalsRouter); // Use the new journals router with CSRF protection

// --- Health Check Endpoint ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

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

// --- Global Error Handler ---
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction,
  ) => {
    // --- RECOMMENDATION: SECURE LOGGING ---
    // In a production environment, never log the entire raw error object (`err`) or stack (`err.stack`),
    // as it may contain sensitive user data or system information. Use a structured,
    // production-ready logger (like Pino or Winston) that can sanitize output.
    // For now, we log a more controlled message.
    console.error('--- Global Error Handler Caught an Error ---');
    console.error(`Error Message: ${err.message}`);
    // For debugging, you might log the stack, but be aware of the risk of leaking PII.
    // console.error(`Stack: ${err.stack}`);

    // Always send a generic, non-revealing error message to the client.
    res.status(500).json({ message: 'An internal server error occurred.' });
  },
);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
