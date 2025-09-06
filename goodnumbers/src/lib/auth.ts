import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "@auth/express/providers/google";
import { prisma } from "./prisma.js";
import { ExpressAuthConfig } from "@auth/express";

export const authConfig: ExpressAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  // THIS IS THE CRITICAL SECURITY FIX:
  trustHost:
    process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test',
};
