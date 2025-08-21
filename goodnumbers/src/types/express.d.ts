// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Request } from 'express'; // Explicitly import Request

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user?: {
          id: string;
          email: string;
        };
      };
      // Also add session here, as it's another common missing property
      session?: {
        csrfSecret: string;
        id: string; // Added id property
        user?: {
          id: string;
          email: string;
        };
      };
    }
  }
}
