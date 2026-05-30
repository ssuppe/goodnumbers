import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@src/lib/prisma.js';

describe('User Data Privacy', () => {
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
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: `creds-id-${Date.now()}`,
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
            status: 'COMPLETE',
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
    const createdJournal = await prisma.journal.findUnique({
      where: { id: journalId },
    });
    console.log(`Journal exists before deletion: ${!!createdJournal}`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should delete all related data when a user is deleted', async () => {
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

  // ADD THIS NEW TEST CASE
  it('should delete GlycemicEventClusters when their parent Journal is deleted', async () => {
    // Arrange: Create a user with a journal and a cluster
    const user = await prisma.user.create({
      data: {
        email: `cascade-test-${Date.now()}@example.com`,
        journals: {
          create: {
            status: 'COMPLETE',
            clusters: {
              create: {
                eventType: 'HIGH',
                eventCount: 5,
                meanTimeMinutes: 720,
                clusterDataJson: {},
              },
            },
          },
        },
      },
      include: { journals: { include: { clusters: true } } },
    });
    const journalId = user.journals[0].id;
    const clusterId = user.journals[0].clusters[0].id;

    // Assert precondition: The cluster exists
    const clusterBeforeDelete = await prisma.glycemicEventCluster.findUnique({
      where: { id: clusterId },
    });
    expect(clusterBeforeDelete).not.toBeNull();

    // Act: Delete the parent journal
    await prisma.journal.delete({ where: { id: journalId } });

    // Assert postcondition: The cluster is now gone
    const clusterAfterDelete = await prisma.glycemicEventCluster.findUnique({
      where: { id: clusterId },
    });
    expect(clusterAfterDelete).toBeNull();

    // Cleanup the user
    await prisma.user.delete({ where: { id: user.id } });
  });
});
