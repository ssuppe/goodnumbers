// src/routes/barrier.ts
import { Router } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import rateLimit from 'express-rate-limit';

export const barrierRouter = Router();

const barrierLoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// Apply rate limiting to the login route to prevent brute-force attacks
const barrierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per window
  message:
    'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

barrierRouter.post('/api/barrier-login', barrierLimiter, (req, res) => {
  try {
    const { username, password } = barrierLoginSchema.parse(req.body);

    const storedUser = Buffer.from(process.env.BARRIER_USERNAME!);
    const providedUser = Buffer.from(username);
    const storedPass = Buffer.from(process.env.BARRIER_PASSWORD!);
    const providedPass = Buffer.from(password);

    const isUserMatch =
      storedUser.length === providedUser.length &&
      timingSafeEqual(storedUser, providedUser);
    const isPassMatch =
      storedPass.length === providedPass.length &&
      timingSafeEqual(storedPass, providedPass);

    if (isUserMatch && isPassMatch) {
      req.session!.is_authorized = true;
      return res.status(200).json({ message: 'Login successful' });
    }

    return res.status(401).json({ message: 'Invalid username or password' });
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return res.status(400).json({ message: 'Invalid request body' });
  }
});
