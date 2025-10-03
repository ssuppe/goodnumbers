import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock the Prisma client using unstable_mockModule
const mockPrismaUpdate = jest.fn();
jest.unstable_mockModule("../../src/lib/prisma.js", () => ({
  prisma: {
    journal: {
      update: mockPrismaUpdate,
    },
  },
}));

// Dynamically import the module under test after the mock is set up
const { processJournalJob } = await import("../../src/worker.js");

interface MockJob {
  data: { journalId: string };
}

describe("Worker Job Processing", () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockPrismaUpdate.mockClear();
  });

  it("should update the journal status to COMPLETE on successful processing", async () => {
    const fakeJob: MockJob = { data: { journalId: "journal123" } };

    // For now, let's assume success and mock the DB returning a record
    mockPrismaUpdate.mockResolvedValue({});

    // Act: Call the function we want to test
    await processJournalJob(fakeJob);

    // Assert: Check that our logic updated the journal correctly
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: "journal123" },
      data: {
        status: "COMPLETE",
      },
    });
    expect(mockPrismaUpdate).toHaveBeenCalledTimes(1);
  });
});