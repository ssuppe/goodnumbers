import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Prisma client initialized successfully.');
    // Try to connect to ensure it's working
    await prisma.$connect();
    console.log('Prisma client connected successfully.');
  } catch (error) {
    console.error('Error initializing or connecting Prisma client:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
