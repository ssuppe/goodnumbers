// goodnumbers/src/index.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth';
import { protect } from './middleware/auth';
import {
  doubleCsrfProtection,
  generateCsrfToken,
  invalidCsrfTokenError,
} from './middleware/csrf';
import { errorHandler } from './middleware/errorHandler'; // <-- IMPORT ERROR HANDLER
import userRouter from './routes/user';
import { journalsRouter } from './routes/journals';

const app = express();
const port = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(helmet());
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
app.use('/api/auth', ExpressAuth(authConfig));

// API route for the frontend to get a CSRF token
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
});

// --- API Routes ---
app.use('/api/user', userRouter);
app.use('/api/journals', protect, doubleCsrfProtection, journalsRouter);

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
app.use(errorHandler); // <-- USE THE CORRECT, IMPORTED HANDLER

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
