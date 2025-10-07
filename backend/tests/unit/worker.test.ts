import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client'; // Import for typing

// Mock the Prisma client using vi.mock
const mockPrismaUpdate = vi.fn();
vi.mock('@src/lib/prisma.js', () => ({
  prisma: {
    journal: {
      update: mockPrismaUpdate,
    },
  } as unknown as PrismaClient, // Type assertion for the mock
}));

// Dynamically import the module under test after the mock is set up
// This will be done inside each test after vi.resetModules()
let processJournalJob: (job: MockJob) => Promise<void>;

interface MockJob {
  data: { journalId: string };
}

describe('Worker Job Processing', () => {
  beforeEach(async () => {
    mockPrismaUpdate.mockClear();
    vi.resetModules(); // Reset modules to ensure fresh import of worker.js
    // Dynamically import processJournalJob here to pick up the mock
    ({ processJournalJob } = await import('@src/worker.js'));
  });

  it('should update the journal status to COMPLETE on successful processing', async () => {
    const fakeJob: MockJob = { data: { journalId: 'journal123' } };

    mockPrismaUpdate.mockResolvedValue({});

    await processJournalJob(fakeJob);

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'journal123' },
      data: {
        status: 'COMPLETE',
      },
    });
    expect(mockPrismaUpdate).toHaveBeenCalledTimes(1);
  });

  it('should update the journal status to FAILED if an error occurs', async () => {
    const fakeJob: MockJob = { data: { journalId: 'journal456' } };
    const errorMessage = 'AI pipeline failed';

    mockPrismaUpdate.mockRejectedValueOnce(new Error(errorMessage));

    await expect(processJournalJob(fakeJob)).rejects.toThrow(errorMessage);

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'journal456' },
      data: {
        status: 'FAILED',
        statusMessage: errorMessage,
      },
    });
    expect(mockPrismaUpdate).toHaveBeenCalledTimes(2);
  });
});