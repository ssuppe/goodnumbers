import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "@auth/express/providers/google";
import { prisma } from "./prisma.ts";
export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  // THIS IS THE CRITICAL SECURITY FIX:
  trustHost: true, // Changed to true for development
};
