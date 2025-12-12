import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@goodnumbers/types';

// 1. Mock Prisma
const mockPrismaUpdate = vi.fn();
const mockPrismaFindUnique = vi.fn();
vi.mock('@src/lib/prisma.js', () => ({
  prisma: {
    journal: {
      update: mockPrismaUpdate,
      findUnique: mockPrismaFindUnique,
    },
  } as unknown as PrismaClient,
}));

// 2. Mock NightscoutClient
const mockFetchEntries = vi.fn();
const mockFetchTreatments = vi.fn();
const mockFetchProfile = vi.fn();

// We mock the class constructor to return our mock methods
vi.mock('@src/lib/nightscout/client.js', () => ({
  NightscoutClient: vi.fn().mockImplementation(() => ({
    fetchEntries: mockFetchEntries,
    fetchTreatments: mockFetchTreatments,
    fetchProfile: mockFetchProfile,
  })),
}));

// 3. Mock Encryption
vi.mock('@src/lib/encryption.js', () => ({
  decrypt: vi.fn((val) => `decrypted-${val}`),
}));

// 4. Mock AGP Calculation
// We mock this so we can verify the worker passes the result to the DB
vi.mock('@src/lib/agp/calculateAgp.js', () => ({
  calculateAgp: vi.fn(() => [{ time: '00:00', median: 100 }]),
}));

// Dynamically import to ensure mocks are applied
let processJournalJob: (job: MockJob) => Promise<{ status: string }>;

interface MockJob {
  id: string;
  data: { journalId: string };
}

describe('Worker Job Processing (Real Logic)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ processJournalJob } = await import('@src/worker.js'));
  });

  it('should decrypt credentials, fetch data, and save raw results', async () => {
    const fakeJob: MockJob = {
      id: 'job-123',
      data: { journalId: 'journal-123' },
    };

    // Arrange: Mock DB finding the user
    mockPrismaFindUnique.mockResolvedValue({
      id: 'journal-123',
      user: {
        nightscoutUrl: 'https://mock-ns.com',
        nightscoutToken: 'encrypted-token-123',
      },
    });

    // Arrange: Mock Nightscout API returns
    mockFetchEntries.mockResolvedValue(['entry1', 'entry2']);
    mockFetchTreatments.mockResolvedValue(['treatment1']);
    mockFetchProfile.mockResolvedValue([{ defaultProfile: 'Default' }]);

    // Arrange: Mock Update to resolve
    mockPrismaUpdate.mockResolvedValue({});

    // Act
    const result = await processJournalJob(fakeJob);

    // Assert: Success status
    expect(result).toEqual({ status: 'done' });

    // Assert: DB lookup
    expect(mockPrismaFindUnique).toHaveBeenCalledWith({
      where: { id: 'journal-123' },
      include: expect.objectContaining({ user: expect.any(Object) }),
    });

    // Assert: Client interaction
    expect(mockFetchEntries).toHaveBeenCalledWith(7);
    expect(mockFetchTreatments).toHaveBeenCalledWith(7);
    expect(mockFetchProfile).toHaveBeenCalled();

    // Assert: Final Persistence
    // We verify the last call to update contains the 'COMPLETE' status
    // and the mocked AGP data.
    const lastCallArgs = mockPrismaUpdate.mock.lastCall?.[0];
    expect(lastCallArgs.where).toEqual({ id: 'journal-123' });
    expect(lastCallArgs.data.status).toBe('COMPLETE');
    expect(lastCallArgs.data.agpChartData).toEqual([{ time: '00:00', median: 100 }]);
  });

  it('should handle missing credentials gracefully', async () => {
    const fakeJob: MockJob = {
      id: 'job-err',
      data: { journalId: 'journal-err' },
    };

    // Arrange: User exists but has no URL
    mockPrismaFindUnique.mockResolvedValue({
      id: 'journal-err',
      user: {
        nightscoutUrl: null, // MISSING
        nightscoutToken: 'encrypted',
      },
    });

    // Act & Assert
    await expect(processJournalJob(fakeJob)).rejects.toThrow(
      'User Nightscout credentials are missing',
    );

    // Verify we set status to FAILED
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
});