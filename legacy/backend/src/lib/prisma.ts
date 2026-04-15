// file: backend/src/lib/prisma.ts
import {
  PrismaClient,
  Prisma,
} from '../../../packages/types/src/generated/client/index.js';

export { Prisma };

console.log(
  `[prisma.ts] Module loaded. NODE_ENV: ${process.env.NODE_ENV}. DB_URL: ${process.env.DATABASE_URL}`,
);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'stdout', level: 'query' },
      { emit: 'stdout', level: 'info' },
      { emit: 'stdout', level: 'warn' },
      { emit: 'stdout', level: 'error' },
    ],
  });

console.log(
  `[prisma.ts] Prisma client instance created/retrieved. DB_URL: ${process.env.DATABASE_URL}`,
);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
