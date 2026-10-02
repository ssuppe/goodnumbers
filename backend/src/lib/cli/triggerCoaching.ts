// file: src/lib/cli/triggerCoaching.ts

export interface UserIdentifier {
  username?: string;
  email?: string;
  all?: boolean;
}

export function parseCliArgs(args: string[]): UserIdentifier {
  let username: string | undefined;
  let email: string | undefined;
  let all = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--all') {
      all = true;
    } else if (arg.startsWith('--username=')) {
      username = arg.split('=')[1]?.trim();
    } else if (arg === '--username' && i + 1 < args.length) {
      username = args[i + 1]?.trim();
      i++;
    } else if (arg.startsWith('--email=')) {
      email = arg.split('=')[1]?.trim();
    } else if (arg === '--email' && i + 1 < args.length) {
      email = args[i + 1]?.trim();
      i++;
    }
  }

  if (!username && !email && !all) {
    throw new Error(
      'Please specify a user using --username=<name>, --email=<email>, or --all',
    );
  }

  return { username, email, ...(all ? { all: true } : {}) };
}

export interface UserRecord {
  id: string;
  name?: string | null;
  email?: string | null;
  nightscoutUrl?: string | null;
  nightscoutToken?: string | null;
}

export interface JournalRecord {
  id: string;
  userId: string;
}

export interface PrismaClientLike {
  user: {
    findFirst: (args: Record<string, unknown>) => Promise<UserRecord | null>;
    findMany: (args: Record<string, unknown>) => Promise<UserRecord[]>;
  };
  journal: {
    create: (args: Record<string, unknown>) => Promise<JournalRecord>;
  };
}

export interface QueueLike {
  add: (name: string, data: Record<string, unknown>) => Promise<unknown>;
}

export async function findUserForCoaching(
  identifier: UserIdentifier,
  prismaClient: PrismaClientLike,
) {
  const searchTerm = identifier.username || identifier.email;

  const user = await prismaClient.user.findFirst({
    where: {
      OR: [
        ...(identifier.email ? [{ email: identifier.email }] : []),
        ...(identifier.username
          ? [{ name: identifier.username }, { email: identifier.username }]
          : []),
        ...(searchTerm ? [{ id: searchTerm }] : []),
      ],
    },
  });

  if (!user) {
    throw new Error(`User matching '${searchTerm}' not found.`);
  }

  if (!user.nightscoutUrl || !user.nightscoutToken) {
    throw new Error(
      `User '${searchTerm}' does not have valid Nightscout credentials configured.`,
    );
  }

  return user;
}

export async function findAllUsersForCoaching(prismaClient: PrismaClientLike) {
  return prismaClient.user.findMany({
    where: {
      nightscoutUrl: { not: null },
      nightscoutToken: { not: null },
    },
  });
}

export async function triggerCoachingForUser(
  identifier: UserIdentifier,
  { prismaClient, queue }: { prismaClient: PrismaClientLike; queue: QueueLike },
) {
  const user = await findUserForCoaching(identifier, prismaClient);

  const now = new Date();
  const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const journal = await prismaClient.journal.create({
    data: {
      userId: user.id,
      status: 'PENDING',
      startDate,
      endDate: now,
    },
  });

  await queue.add('process-journal', { journalId: journal.id });

  return {
    journalId: journal.id,
    userId: user.id,
  };
}

export async function triggerCoachingForAllUsers({
  prismaClient,
  queue,
}: {
  prismaClient: PrismaClientLike;
  queue: QueueLike;
}) {
  const users = await findAllUsersForCoaching(prismaClient);
  const results = [];

  for (const user of users) {
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const journal = await prismaClient.journal.create({
      data: {
        userId: user.id,
        status: 'PENDING',
        startDate,
        endDate: now,
      },
    });

    await queue.add('process-journal', { journalId: journal.id });
    results.push({ journalId: journal.id, userId: user.id });
  }

  return results;
}
