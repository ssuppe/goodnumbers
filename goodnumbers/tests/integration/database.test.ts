import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Connection', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to the database and perform a query', async () => {
    const userCount = await prisma.user.count();
    expect(userCount).toBeGreaterThanOrEqual(0);
  });
});
