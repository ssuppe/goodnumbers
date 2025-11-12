import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { PrismaClient } from '@goodnumbers/types';

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
let processJournalJob: (job: MockJob) => Promise<{ status: string }>; // Changed return type

interface MockJob {
  data: { journalId: string };
}

describe('Worker Job Processing', () => {
  beforeEach(async () => {
    vi.useFakeTimers(); // Use fake timers for each test
    mockPrismaUpdate.mockClear();
    vi.resetModules(); // Reset modules to ensure fresh import of worker.js
    // Dynamically import processJournalJob here to pick up the mock
    ({ processJournalJob } = await import('@src/worker.js'));
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers after each test
  });

  it('should update the journal status to COMPLETE on successful processing', async () => {
    const fakeJob: MockJob = { data: { journalId: 'journal123' } };

    // Mock all prisma.journal.update calls to resolve successfully
    mockPrismaUpdate.mockResolvedValue({});

    const promise = processJournalJob(fakeJob);

    // Advance timers for each stage
    vi.advanceTimersByTime(5000); // Stage 1
    await vi.runAllTimersAsync(); // Process microtasks after timer advance

    vi.advanceTimersByTime(5000); // Stage 2
    await vi.runAllTimersAsync();

    vi.advanceTimersByTime(5000); // Stage 3
    await vi.runAllTimersAsync();

    vi.advanceTimersByTime(5000); // Stage 4
    await vi.runAllTimersAsync();

    // Final stage (no sleep after this, but ensure all promises resolve)
    await promise; // Await the main job promise

    expect(mockPrismaUpdate).toHaveBeenCalledTimes(5); // 4 progress updates + 1 final COMPLETE

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'journal123' },
      data: {
        status: 'ANALYZING_DATA',
        progress: 20,
        statusMessage:
          'Gathering your blood glucose, insulin, and meal data...',
      },
    });
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'journal123' },
      data: {
        status: 'DRAFTING_INSIGHTS',
        progress: 40,
        statusMessage: 'Running analysis to find trends and hotspots...',
      },
    });
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'journal123' },
      data: {
        status: 'GENERATING_AUDIO',
        progress: 60,
        statusMessage:
          'Writing the script for your personalized audio summary...',
      },
    });
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'journal123' },
      data: {
        progress: 80,
        statusMessage: 'Recording your podcast...',
      },
    });
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'journal123' },
      data: {
        status: 'COMPLETE',
        progress: 100,
        statusMessage: 'Your journal is ready.',
      },
    });
  });

  it('should update the journal status to FAILED if an error occurs', async () => {
    const fakeJob: MockJob = { data: { journalId: 'journal456' } };
    const errorMessage = 'AI pipeline failed';

    // Mock the sequence of prisma calls:
    // 1. ANALYZING_DATA (Success)
    // 2. DRAFTING_INSIGHTS (Failure)
    // 3. FAILED (Success, from the catch block)
    mockPrismaUpdate
      .mockResolvedValueOnce({}) // Call 1
      .mockRejectedValueOnce(new Error(errorMessage)) // Call 2
      .mockResolvedValueOnce({}); // Call 3

    // Concurrently await the rejection and advance the timers to trigger it.
    // This pattern avoids both unhandled rejection warnings and test timeouts.
    await Promise.all([
      expect(processJournalJob(fakeJob)).rejects.toThrow(errorMessage),
      vi.runAllTimersAsync(),
    ]);

    // Verify the sequence of prisma update calls
    expect(mockPrismaUpdate).toHaveBeenCalledTimes(3);

    // 1. The first successful status update
    expect(mockPrismaUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'journal456' },
      data: {
        status: 'ANALYZING_DATA',
        progress: 20,
        statusMessage:
          'Gathering your blood glucose, insulin, and meal data...',
      },
    });

    // 2. The update that was attempted before the failure
    expect(mockPrismaUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'journal456' },
      data: {
        status: 'DRAFTING_INSIGHTS',
        progress: 40,
        statusMessage: 'Running analysis to find trends and hotspots...',
      },
    });

    // 3. The final 'FAILED' status update from the catch block
    expect(mockPrismaUpdate).toHaveBeenNthCalledWith(3, {
      where: { id: 'journal456' },
      data: {
        status: 'FAILED',
        statusMessage: `Simulation failed: ${errorMessage}`,
      },
    });
  });
});
