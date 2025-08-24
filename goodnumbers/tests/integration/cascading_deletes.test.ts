import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const prisma = new PrismaClient();

describe('Cascading Deletes', () => {
  let userId: string;
  let journalId: string;
  let clusterId: string;

  beforeAll(async () => {
    // Clean up any existing data to ensure a clean test environment
    await prisma.glycemicEventCluster.deleteMany();
    await prisma.journal.deleteMany();
    await prisma.user.deleteMany();

    // Create a user
    const user = await prisma.user.create({
      data: {
        email: 'test-user-cascading@example.com',
        name: 'Test User',
      },
    });
    userId = user.id;

    // Create a journal associated with the user
    const journal = await prisma.journal.create({
      data: {
        userId: userId,
        status: 'COMPLETE',
        podcastTitle: 'Test Podcast',
      },
    });
    journalId = journal.id;

    // Create a glycemic event cluster associated with the journal
    const cluster = await prisma.glycemicEventCluster.create({
      data: {
        journalId: journalId,
        eventType: 'HIGH_GLUCOSE',
        eventCount: 5,
        meanTimeMinutes: 600,
        clusterDataJson: {},
      },
    });
    clusterId = cluster.id;
  });

  afterAll(async () => {
    // Clean up after tests
    await prisma.glycemicEventCluster.deleteMany();
    await prisma.journal.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('should delete associated journals and clusters when a user is deleted', async () => {
    // Verify that the user, journal, and cluster exist before deletion
    const userBeforeDelete = await prisma.user.findUnique({
      where: { id: userId },
    });
    const journalBeforeDelete = await prisma.journal.findUnique({
      where: { id: journalId },
    });
    const clusterBeforeDelete = await prisma.glycemicEventCluster.findUnique({
      where: { id: clusterId },
    });

    expect(userBeforeDelete).not.toBeNull();
    expect(journalBeforeDelete).not.toBeNull();
    expect(clusterBeforeDelete).not.toBeNull();

    // Delete the user
    await prisma.user.delete({ where: { id: userId } });

    // Attempt to find the user, journal, and cluster after user deletion
    const userAfterDelete = await prisma.user.findUnique({
      where: { id: userId },
    });
    const journalAfterDelete = await prisma.journal.findUnique({
      where: { id: journalId },
    });
    const clusterAfterDelete = await prisma.glycemicEventCluster.findUnique({
      where: { id: clusterId },
    });

    // Assert that all associated records are null (deleted)
    expect(userAfterDelete).toBeNull();
    expect(journalAfterDelete).toBeNull();
    expect(clusterAfterDelete).toBeNull();
  });
});
