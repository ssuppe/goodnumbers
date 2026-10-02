import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseCliArgs,
  findUserForCoaching,
  triggerCoachingForUser,
  findAllUsersForCoaching,
  triggerCoachingForAllUsers,
  type PrismaClientLike,
  type QueueLike,
} from '../../../src/lib/cli/triggerCoaching.js';

describe('CLI Trigger Coaching Utility', () => {
  describe('parseCliArgs', () => {
    it('should parse --username=clark format', () => {
      const result = parseCliArgs(['node', 'script.js', '--username=clark']);
      expect(result).toEqual({ username: 'clark' });
    });

    it('should parse --username clark positional format', () => {
      const result = parseCliArgs(['node', 'script.js', '--username', 'clark']);
      expect(result).toEqual({ username: 'clark' });
    });

    it('should parse --email=clark@example.com format', () => {
      const result = parseCliArgs([
        'node',
        'script.js',
        '--email=clark@example.com',
      ]);
      expect(result).toEqual({ email: 'clark@example.com' });
    });

    it('should parse --all flag', () => {
      const result = parseCliArgs(['node', 'script.js', '--all']);
      expect(result).toEqual({ all: true });
    });

    it('should throw an error if neither username, email, nor --all is specified', () => {
      expect(() => parseCliArgs(['node', 'script.js'])).toThrow(
        /Please specify a user using --username=<name>, --email=<email>, or --all/,
      );
    });
  });

  describe('findUserForCoaching', () => {
    const mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      journal: {
        create: vi.fn(),
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should find user by username if exists and credentials are present', async () => {
      const fakeUser = {
        id: 'user-123',
        username: 'clark',
        email: 'clark@example.com',
        nightscoutUrl: 'https://cgm.example.com',
        nightscoutToken: 'enc_token',
      };
      mockPrisma.user.findFirst.mockResolvedValue(fakeUser);

      const result = await findUserForCoaching(
        { username: 'clark' },
        mockPrisma as unknown as PrismaClientLike,
      );

      expect(result).toEqual(fakeUser);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ name: 'clark' }, { email: 'clark' }, { id: 'clark' }],
        },
      });
    });

    it('should throw error if user is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        findUserForCoaching(
          { username: 'unknown' },
          mockPrisma as unknown as PrismaClientLike,
        ),
      ).rejects.toThrow("User matching 'unknown' not found.");
    });

    it('should throw error if user missing Nightscout credentials', async () => {
      const invalidUser = {
        id: 'user-123',
        username: 'clark',
        email: 'clark@example.com',
        nightscoutUrl: null,
        nightscoutToken: null,
      };
      mockPrisma.user.findFirst.mockResolvedValue(invalidUser);

      await expect(
        findUserForCoaching(
          { username: 'clark' },
          mockPrisma as unknown as PrismaClientLike,
        ),
      ).rejects.toThrow(
        "User 'clark' does not have valid Nightscout credentials configured.",
      );
    });
  });

  describe('triggerCoachingForUser', () => {
    const mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      journal: {
        create: vi.fn(),
      },
    };

    const mockQueue = {
      add: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should create a 7-day journal and enqueue job into BullMQ queue', async () => {
      const fakeUser = {
        id: 'user-789',
        username: 'clark',
        email: 'clark@example.com',
        nightscoutUrl: 'https://cgm.example.com',
        nightscoutToken: 'enc_token',
      };
      mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
      mockPrisma.journal.create.mockResolvedValue({
        id: 'journal-456',
        userId: 'user-789',
        status: 'PENDING',
      });
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      const result = await triggerCoachingForUser(
        { username: 'clark' },
        {
          prismaClient: mockPrisma as unknown as PrismaClientLike,
          queue: mockQueue as unknown as QueueLike,
        },
      );

      expect(result).toEqual({
        journalId: 'journal-456',
        userId: 'user-789',
      });
      expect(mockPrisma.journal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-789',
          status: 'PENDING',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      });
      expect(mockQueue.add).toHaveBeenCalledWith('process-journal', {
        journalId: 'journal-456',
      });
    });
  });

  describe('findAllUsersForCoaching', () => {
    const mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      journal: {
        create: vi.fn(),
      },
    };

    it('should query all users with non-null nightscoutUrl and nightscoutToken', async () => {
      const users = [
        { id: 'u1', nightscoutUrl: 'http://ns1.com', nightscoutToken: 't1' },
        { id: 'u2', nightscoutUrl: 'http://ns2.com', nightscoutToken: 't2' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await findAllUsersForCoaching(
        mockPrisma as unknown as PrismaClientLike,
      );
      expect(result).toEqual(users);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          nightscoutUrl: { not: null },
          nightscoutToken: { not: null },
        },
      });
    });
  });

  describe('triggerCoachingForAllUsers', () => {
    const mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      journal: {
        create: vi.fn(),
      },
    };

    const mockQueue = {
      add: vi.fn(),
    };

    it('should create journals and enqueue jobs for all valid users', async () => {
      const users = [
        { id: 'u1', nightscoutUrl: 'http://ns1.com', nightscoutToken: 't1' },
        { id: 'u2', nightscoutUrl: 'http://ns2.com', nightscoutToken: 't2' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.journal.create
        .mockResolvedValueOnce({ id: 'j1', userId: 'u1' })
        .mockResolvedValueOnce({ id: 'j2', userId: 'u2' });
      mockQueue.add.mockResolvedValue({ id: 'job' });

      const results = await triggerCoachingForAllUsers({
        prismaClient: mockPrisma as unknown as PrismaClientLike,
        queue: mockQueue as unknown as QueueLike,
      });

      expect(results).toEqual([
        { journalId: 'j1', userId: 'u1' },
        { journalId: 'j2', userId: 'u2' },
      ]);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });
  });
});
