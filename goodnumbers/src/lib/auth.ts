import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "@auth/express/providers/google";
import { prisma } from "./prisma.ts";
import type { ExpressAuthConfig } from "@auth/express";

export const authConfig: ExpressAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  // Set trustHost to true for all environments to speed up development.
  // This is acceptable given full control over the development environment.
  trustHost: true,
};