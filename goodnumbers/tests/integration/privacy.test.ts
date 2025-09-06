import { PrismaClient } from "@prisma/client";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

const prisma = new PrismaClient();

describe("User Data Privacy", () => {
  let userId: string;
  let journalId: string;
  let accountId: string;
  let sessionId: string;

  beforeAll(async () => {
    // 1. Create a user and all related data
    const user = await prisma.user.create({
      data: {
        email: `test-privacy-${Date.now()}@example.com`,
        accounts: {
          create: {
            type: "oauth",
            provider: "google",
            providerAccountId: `google-id-${Date.now()}`,
          },
        },
        sessions: {
          create: {
            sessionToken: `session-token-${Date.now()}`,
            expires: new Date(Date.now() + 86400 * 1000), // 24 hours from now
          },
        },
        journals: {
          create: {
            status: "COMPLETE",
          },
        },
      },
      include: {
        accounts: true,
        sessions: true,
        journals: true,
      },
    });
    userId = user.id;
    journalId = user.journals[0].id;
    accountId = user.accounts[0].id;
    sessionId = user.sessions[0].id;

    console.log(`Created User ID: ${userId}`);
    console.log(`Created Journal ID: ${journalId}`);
    const createdJournal = await prisma.journal.findUnique({ where: { id: journalId } });
    console.log(`Journal exists before deletion: ${!!createdJournal}`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should delete all related data when a user is deleted", async () => {
    // 2. Delete the user
    await prisma.user.delete({ where: { id: userId } });

    // 3. Assert that all related data is now null (gone)
    const deletedJournal = await prisma.journal.findUnique({
      where: { id: journalId },
    });
    const deletedAccount = await prisma.account.findUnique({
      where: { id: accountId },
    });
    const deletedSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    expect(deletedJournal).toBeNull();
    expect(deletedAccount).toBeNull();
    expect(deletedSession).toBeNull();
  });
});