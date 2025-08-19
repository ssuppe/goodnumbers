// goodnumbers/src/index.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ExpressAuth } from '@auth/express';
import { authConfig } from './lib/auth.ts'; // We will modify authConfig later

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

// --- Static Files ---
app.use(express.static('public'));

// --- Auth.js Middleware ---
// All requests to /api/auth/* will be handled by Auth.js
app.use('/api/auth', ExpressAuth(authConfig));

// --- API Routes ---
// Example placeholder for future API routes
app.get('/api/protected-data', (req, res) => {
  // In a real scenario, you'd check req.auth here to ensure user is logged in
  res.json({ message: 'This is protected data.' });
});

// --- Health Check Endpoint ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// --- Global Error Handler ---
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction,
  ) => {
    console.error('--- Global Error Handler Caught an Error ---');
    console.error(err.stack);
    res.status(500).send('Something broke!');
  },
);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
