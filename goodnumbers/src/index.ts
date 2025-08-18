// src/index.ts
import express from 'express';
import cookieSession from 'cookie-session';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { barrierMiddleware } from './middleware/barrier.ts';
import { barrierRouter } from './routes/barrier.ts';

// ESM-compatible way to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Temporary route for debugging static file serving
app.get('/test.html', (req, res) => {
  console.log('>>> /test.html route handler reached');
  const testFilePath = path.join(__dirname, '../public/test.html');
  res.sendFile(testFilePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).send('Error sending file');
    }
  });
});
const publicPath = path.join(__dirname, '../public');
console.log('Serving static files from:', publicPath);
app.use(express.static(publicPath));

app.use(
  cookieSession({
    name: 'barrier_session',
    secret: process.env.COOKIE_SECRET!,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  }),
);

// --- ROUTES ---

// Use the middleware and router
app.use(barrierMiddleware);
app.use('/', barrierRouter); // Mount the router at the root

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// New: Handle the root path after barrier authentication
app.get('/', (req, res) => {
  res.send(
    '<h1>Welcome to Goodnumbers!</h1><p>You have successfully passed the barrier.</p>',
  );
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app, server };
