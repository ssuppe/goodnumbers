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

  it("should update the journal status to FAILED if an error occurs", async () => {
    const fakeJob: MockJob = { data: { journalId: "journal456" } };
    const errorMessage = "AI pipeline failed";

    // Arrange: Simulate a failure by having the main logic throw an error.
    // The first mock call represents the attempt to set status to COMPLETE, which fails.
    mockPrismaUpdate.mockRejectedValueOnce(new Error(errorMessage));

    // Act & Assert: Expect the function to re-throw the error
    await expect(processJournalJob(fakeJob)).rejects.toThrow(errorMessage);

    // Assert: Check that our logic updated the journal to FAILED
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: "journal456" },
      data: {
        status: "FAILED",
        statusMessage: errorMessage,
      },
    });
    expect(mockPrismaUpdate).toHaveBeenCalledTimes(2); // One for the failed update, one for the FAILED status update
  });
});