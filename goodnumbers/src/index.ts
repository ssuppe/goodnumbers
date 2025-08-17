// src/index.ts
import express from 'express';
import cookieSession from 'cookie-session';
import 'dotenv/config';
import { barrierMiddleware } from './middleware/barrier';
import { barrierRouter } from './routes/barrier';

const app = express();
app.use(express.json());
app.use(express.static('public'));

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

// Use the middleware and router
app.use(barrierMiddleware);
app.use('/', barrierRouter); // Mount the router at the root

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app, server };
