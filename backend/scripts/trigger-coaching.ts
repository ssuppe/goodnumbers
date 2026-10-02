#!/usr/bin/env node
import '../src/lib/env.js';
import { prisma } from '../src/lib/prisma.js';
import { getJournalQueue } from '../src/lib/queue.js';
import {
  parseCliArgs,
  triggerCoachingForUser,
  triggerCoachingForAllUsers,
} from '../src/lib/cli/triggerCoaching.js';

async function main() {
  try {
    const identifier = parseCliArgs(process.argv);
    console.log(`[CLI] Locating user(s) for Quick Coach generation...`);

    const queue = getJournalQueue();
    let journalIds: string[] = [];

    if (identifier.all) {
      const results = await triggerCoachingForAllUsers({
        prismaClient: prisma,
        queue,
      });
      journalIds = results.map((r) => r.journalId);
      console.log(
        `[CLI] Successfully created ${results.length} journals and enqueued processing jobs.`,
      );
    } else {
      const result = await triggerCoachingForUser(identifier, {
        prismaClient: prisma,
        queue,
      });
      journalIds = [result.journalId];
      console.log(
        `[CLI] Successfully created Journal ${result.journalId} and enqueued processing job.`,
      );
    }

    if (journalIds.length === 0) {
      console.log('[CLI] No active users with Nightscout credentials found.');
      process.exit(0);
    }

    const primaryJournalId = journalIds[0];
    console.log(`[CLI] Monitoring processing progress...`);

    let baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl && process.env.BETTER_AUTH_URL) {
      try {
        baseUrl = new URL(process.env.BETTER_AUTH_URL).origin;
      } catch {
        baseUrl = process.env.BETTER_AUTH_URL.replace(/\/api\/auth\/?$/, '');
      }
    }
    if (!baseUrl) {
      baseUrl = 'http://localhost:5173';
    }

    const magicLink = `${baseUrl.replace(/\/$/, '')}/coach/${primaryJournalId}`;

    // Poll status until complete or failed (max wait 5 minutes for AI processing)
    const checkInterval = 2000;
    const maxWaitMs = 300000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const journal = await prisma.journal.findUnique({
        where: { id: primaryJournalId },
        select: { status: true, progress: true, statusMessage: true },
      });

      if (!journal) {
        throw new Error('Journal disappeared during processing.');
      }

      console.log(
        `[CLI] Status: ${journal.status} (${journal.progress ?? 0}%) - ${journal.statusMessage || ''}`,
      );

      if (journal.status === 'COMPLETE') {
        console.log('\n==================================================');
        console.log('⚡ Quick Coach pipeline finished successfully!');
        console.log(`Magic Link: ${magicLink}`);
        console.log('==================================================\n');
        process.exit(0);
      }

      if (journal.status === 'FAILED') {
        console.error(`\n❌ Quick Coach generation failed.`);
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    console.warn(
      `\n⚠️ Timed out waiting for job completion. Check worker logs.`,
    );
    console.log(`Magic Link will be: ${magicLink}`);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ CLI Error: ${message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
