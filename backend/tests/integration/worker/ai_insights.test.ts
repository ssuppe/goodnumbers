import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  PrismaClient,
  Journal,
  User,
  GlycemicEventCluster,
} from '@goodnumbers/types';

// 1. Mock Prisma
const mockPrismaUpdate = vi.fn();
const mockPrismaFindUnique = vi.fn();
const mockPrismaFindFirst = vi.fn();
const mockPrismaFindMany = vi.fn();
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
      findMany: mockPrismaFindMany,
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
  decrypt: vi.fn((val: string) => `decrypted-${val}`),
}));

// 4. Mock HotspotDetector
vi.mock('../../../src/lib/analysis/HotspotDetector.js', () => ({
  HotspotDetector: vi.fn().mockImplementation(() => ({
    detectEvents: vi.fn().mockReturnValue([]),
    findClusters: vi.fn().mockReturnValue([
      {
        id: 'cluster-1',
        type: 'hyper',
        avgStartMinute: 720,
        avgDurationMinutes: 60,
        eventCount: 3,
        activeDays: [1, 2, 3],
        events: [{ startTime: '2023-01-01T12:00:00Z' }],
      },
    ]),
  })),
}));

// 5. Mock Gemini AI
const MOCK_AI_ASSESSMENT = {
  observation: 'Mocked AI Observation: Dawn Phenomenon suspected.',
  probableDriver: 'Dawn phenomenon.',
  systemImpact: 'Pump increases correction activity.',
  lifestyleExperiment: 'Drink a glass of water.',
  reflectionForDoctor: '- Check basal rates between 3 AM and 5 AM.',
  quickLogSuggestions: ['Late snack', 'Adjust basal', 'Dawn phenomenon'],
  initialPrompt: 'Mocked initial prompt?',
};
const MOCK_EXECUTIVE_SUMMARY = [
  {
    type: 'win',
    icon: '🏆',
    title: 'TIR on Target',
    short_description: 'Great job!',
  },
  {
    type: 'trend',
    icon: '📈',
    title: 'Stable Glucose',
    short_description: 'Steady week.',
  },
  {
    type: 'warn',
    icon: '⚠️',
    title: 'Morning Highs',
    short_description: 'Check basal.',
  },
];
vi.mock('../../../src/lib/ai/gemini.js', () => ({
  generateClusterAIInsight: vi.fn().mockResolvedValue(MOCK_AI_ASSESSMENT),
  generateExecutiveSummary: vi.fn().mockResolvedValue(MOCK_EXECUTIVE_SUMMARY),
}));

// Mock other libs to avoid side effects
vi.mock('../../../src/lib/queue.js');
vi.mock('ioredis');

// Dynamically import to ensure mocks are applied
let processJournalJob: (job: {
  id: string;
  data: { journalId: string };
}) => Promise<{ status: string }>;

interface MockJournalWithUser extends Partial<Journal> {
  user: Partial<User>;
}

describe('Journal AI Insights Integration', () => {
  const mockJob = {
    id: 'test-job-id',
    data: { journalId: 'test-journal-id' },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ processJournalJob } = await import('../../../src/worker.js'));

    const mockJournal: MockJournalWithUser = {
      id: 'test-journal-id',
      userId: 'test-user-id',
      createdAt: new Date(),
      user: {
        nightscoutUrl: 'https://ns.example.com',
        nightscoutToken: 'encrypted-token',
        preferredUnits: 'MGDL',
      },
    };

    mockPrismaFindUnique.mockResolvedValue(mockJournal as unknown as Journal);
    mockPrismaUpdate.mockResolvedValue({});
    mockPrismaFindFirst.mockResolvedValue(null);
    mockPrismaFindMany.mockResolvedValue([]);
    mockPrismaTransaction.mockResolvedValue([[], []]);
  });

  it('should generate and save AI assessments for detected clusters', async () => {
    // Setup Mock Data
    mockFetchEntries.mockResolvedValue([
      { sgv: 100, date: Date.now(), utcOffset: 0 },
    ]);
    mockFetchTreatments.mockResolvedValue([]);
    mockFetchProfile.mockResolvedValue([
      { defaultProfile: 'Default', store: { Default: { timezone: 'UTC' } } },
    ]);

    // Run the worker
    await processJournalJob(mockJob);

    // Verification: Cluster Insights Persistence
    // Check createMany call in the transaction
    const createManyCall = mockPrismaCreateMany.mock.calls[0] as [
      { data: Array<Partial<GlycemicEventCluster>> },
    ];

    expect(createManyCall).toBeDefined();
    const clustersSaved = createManyCall[0].data;
    expect(clustersSaved).toHaveLength(2);

    // Verify AI assessment is present in the saved cluster data
    expect(clustersSaved[0]).toHaveProperty('aiInsight', MOCK_AI_ASSESSMENT);
    expect(clustersSaved[1]).toHaveProperty('aiInsight', MOCK_AI_ASSESSMENT);
    expect(clustersSaved[0]).toHaveProperty(
      'quickLogSuggestions',
      MOCK_AI_ASSESSMENT.quickLogSuggestions,
    );

    // Verify deterministic insights array is also present (even if empty)
    expect(clustersSaved[0]).toHaveProperty('insights');
    expect(Array.isArray(clustersSaved[0].insights)).toBe(true);
  });
});
