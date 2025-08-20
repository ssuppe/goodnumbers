import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const userEmail = 'test.user@example.com';
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { agreementsSigned: false },
      });
      console.log(`User ${userEmail} agreementsSigned set to false.`);
    } else {
      console.log(`User ${userEmail} not found.`);
    }
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
