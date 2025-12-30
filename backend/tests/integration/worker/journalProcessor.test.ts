import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@goodnumbers/types';

// 1. Mock Prisma
const mockPrismaUpdate = vi.fn();
const mockPrismaFindUnique = vi.fn();
const mockPrismaFindFirst = vi.fn();
const mockPrismaTransaction = vi.fn();
const mockPrismaDeleteMany = vi.fn();
const mockPrismaCreateMany = vi.fn();

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    journal: {
      update: mockPrismaUpdate,
      findUnique: mockPrismaFindUnique,
      findFirst: mockPrismaFindFirst,
    },
    glycemicEventCluster: {
      deleteMany: mockPrismaDeleteMany,
      createMany: mockPrismaCreateMany,
    },
    $transaction: mockPrismaTransaction,
  } as unknown as PrismaClient,
}));

// 2. Mock NightscoutClient
const mockFetchEntries = vi.fn();
const mockFetchTreatments = vi.fn();
const mockFetchProfile = vi.fn();

vi.mock('../../../src/lib/nightscout/client.js', () => ({
  NightscoutClient: vi.fn().mockImplementation(() => ({
    fetchEntries: mockFetchEntries,
    fetchTreatments: mockFetchTreatments,
    fetchProfile: mockFetchProfile,
  })),
}));

// 3. Mock Encryption
vi.mock('../../../src/lib/encryption.js', () => ({
  decrypt: vi.fn((val) => `decrypted-${val}`),
}));

// Mock other libs to avoid side effects
vi.mock('../../../src/lib/queue.js');
vi.mock('ioredis');

// Dynamically import to ensure mocks are applied
let processJournalJob: (job: any) => Promise<{ status: string }>;

describe('Journal Processor Worker', () => {
  const mockJob = {
    id: 'test-job-id',
    data: { journalId: 'test-journal-id' },
  } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ processJournalJob } = await import('../../../src/worker.js'));

    // Default mocks for success path
    mockPrismaFindUnique.mockResolvedValue({
      id: 'test-journal-id',
      userId: 'test-user-id',
      createdAt: new Date(),
      user: {
        nightscoutUrl: 'https://ns.example.com',
        nightscoutToken: 'encrypted-token',
      },
    } as any);

    mockPrismaUpdate.mockResolvedValue({});
    mockPrismaFindFirst.mockResolvedValue(null);

    // Mock transaction to return empty array (no clusters found is fine for this test)
    mockPrismaTransaction.mockResolvedValue([[], []]);
  });

  it('should fetch, sanitize, and persist treatments correctly', async () => {
    // Setup Mock Data
    const now = new Date();
    const validDate = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
    
    const mockTreatments = [
      // Valid Entry
      {
        _id: 't1',
        created_at: validDate.toISOString(),
        carbs: 45,
        insulin: 2.5,
        eventType: 'Meal Bolus',
      },
      // String Numbers (should be cast)
      {
        _id: 't2',
        created_at: validDate.toISOString(),
        carbs: '30',
        insulin: '1.5',
        eventType: 'Snack',
      },
      // PII in notes (should be stripped)
      {
        _id: 't3',
        created_at: validDate.toISOString(),
        carbs: 10,
        eventType: 'Correction',
        notes: 'Lunch at Mario\'s with Alice',
        enteredBy: 'Mom',
      },
      // Empty/Invalid (should be filtered out)
      {
        _id: 't4',
        created_at: validDate.toISOString(),
        carbs: null,
        insulin: 0,
        eventType: 'Note',
      },
    ];

    // Setup NightscoutClient mocks
    mockFetchEntries.mockResolvedValue([]);
    mockFetchTreatments.mockResolvedValue(mockTreatments);
    mockFetchProfile.mockResolvedValue([{ defaultProfile: 'Default', store: { Default: { timezone: 'UTC' } } }]);

    // Run the worker
    await processJournalJob(mockJob);

    // Verification 1: fetchTreatments called with correct date range (buffer check)
    // The worker calculates dates internally, so we check if the call happened with Date objects
    expect(mockFetchTreatments).toHaveBeenCalledTimes(1);
    const [arg1, arg2] = mockFetchTreatments.mock.calls[0];
    expect(arg1).toBeInstanceOf(Date);
    expect(arg2).toBeInstanceOf(Date);
    
    // Check if start date includes the ~7 day + 3hr buffer (roughly)
    // We won't assert exact milliseconds to avoid flaky tests, but check reasonable range
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(arg1.getTime()).toBeLessThan(sevenDaysAgo.getTime()); // Should be older than 7 days ago

    // Verification 2: Persistence Sanitization
    // We check the LAST call to prisma.journal.update, which saves the final payload
    const updateCalls = mockPrismaUpdate.mock.calls;
    const completeCall = updateCalls.find((call: any) => call[0].data.status === 'COMPLETE');
    
    expect(completeCall).toBeDefined();
    const savedData = completeCall![0].data as any;
    
    expect(savedData.treatments).toBeDefined();
    const savedTreatments = savedData.treatments;

    // Assert T1 (Valid)
    expect(savedTreatments).toContainEqual(expect.objectContaining({
      id: 't1',
      carbs: 45,
      insulin: 2.5,
    }));

    // Assert T2 (String Casting)
    expect(savedTreatments).toContainEqual(expect.objectContaining({
      id: 't2',
      carbs: 30,   // Number
      insulin: 1.5 // Number
    }));

    // Assert T3 (PII Stripping)
    const t3 = savedTreatments.find((t: any) => t.id === 't3');
    expect(t3).toBeDefined();
    expect(t3).not.toHaveProperty('notes');
    expect(t3).not.toHaveProperty('enteredBy');
    expect(t3.carbs).toBe(10);

    // Assert T4 (Filtering)
    const t4 = savedTreatments.find((t: any) => t.id === 't4');
    expect(t4).toBeUndefined();
  });
});