// file: src/worker.ts

import './lib/env.js';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { JOURNAL_QUEUE_NAME } from './lib/queue.js';
import { prisma, Prisma } from './lib/prisma.js';
import { NightscoutClient } from './lib/nightscout/client.js';
import { decrypt } from './lib/encryption.js';
import { calculateAgp } from './lib/agp/calculateAgp.js';
import { calculateMetrics, calculateTrends } from './lib/scorecard.js';
import { ScoreCardDataSchema } from '@goodnumbers/schemas';

export async function processJournalJob(job: Job) {
  const { journalId } = job.data;
  console.log(`[Worker] Processing job ${job.id} (Journal ID: ${journalId})`);

  try {
    // 1. Fetch the Journal and associated User credentials
    const journal = await prisma.journal.findUnique({
      where: { id: journalId },
      include: {
        user: {
          select: {
            nightscoutUrl: true,
            nightscoutToken: true,
          },
        },
      },
    });

    if (!journal || !journal.user) {
      throw new Error('Journal or User not found');
    }

    if (!journal.user.nightscoutUrl || !journal.user.nightscoutToken) {
      throw new Error('User Nightscout credentials are missing');
    }

    // 2. Decrypt the token
    const token = decrypt(journal.user.nightscoutToken);

    // 3. Initialize the Nightscout Client
    const client = new NightscoutClient(journal.user.nightscoutUrl, token);

    // Stage 1: Fetching Data
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'ANALYZING_DATA',
        progress: 20,
        statusMessage:
          'Gathering your blood glucose, insulin, and meal data from Nightscout...',
      },
    });

    // Fetch all data in parallel for efficiency
    const [entries, treatments, profiles] = await Promise.all([
      client.fetchEntries(7),
      client.fetchTreatments(7),
      client.fetchProfile(),
    ]);

    console.log(
      `[Worker] Fetched ${entries.length} entries, ${treatments.length} treatments, and ${profiles.length} profiles.`,
    );

    // Stage 2: AGP Chart Data Generation
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'CALCULATING_AGP',
        progress: 50,
        statusMessage:
          'Calculating Ambulatory Glucose Profile (AGP) percentiles...',
      },
    });

    // Use the timezone from the fetched profile data (default to London if missing)
    const defaultProfileName = profiles[0]?.defaultProfile;
    let userTimezone =
      defaultProfileName && profiles[0]?.store?.[defaultProfileName]?.timezone;

    // Fallback: If profile timezone is missing, infer from the most recent entry's utcOffset
    if (
      !userTimezone &&
      entries.length > 0 &&
      entries[0].utcOffset !== undefined
    ) {
      const offsetMinutes = entries[0].utcOffset;
      const offsetHours = offsetMinutes / 60;
      // Format as 'UTC+X' or 'UTC-X'
      const sign = offsetHours >= 0 ? '+' : '';
      userTimezone = `UTC${sign}${offsetHours}`;
      console.log(
        `[Worker] Inferred timezone from data: ${userTimezone} (offset: ${offsetMinutes})`,
      );
    }

    // Final fallback
    if (!userTimezone) {
      throw new Error('Incorrect timezone information, check Nightscout.');
    }

    const agpData = calculateAgp(entries, userTimezone);

    // --- Voyager Scorecards Calculation ---

    // 1. Calculate base metrics securely
    let scoreCardMetrics;
    try {
      // Map NightscoutEntry to GlucoseEntry (ensure date is number)
      const glucoseEntries = entries.map((e) => ({
        sgv: e.sgv,
        date: e.date,
        dateString: new Date(e.date).toISOString(),
      }));
      scoreCardMetrics = calculateMetrics(glucoseEntries);
    } catch (error) {
      console.error(
        `Failed to calculate metrics for Journal ${journalId}. Error: ${(error as Error).message}`,
      );
      // Fallback to zeros on error
      scoreCardMetrics = {
        avgGlucose: 0,
        stability: 0,
        timeInRange: 0,
        timeInTightRange: 0,
      };
    }

    // 2. Fetch Previous Journal for Trends
    const previousJournal = await prisma.journal.findFirst({
      where: {
        userId: journal.userId,
        status: 'COMPLETE',
        createdAt: { lt: journal.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    let trends = null;

    if (previousJournal && previousJournal.scoreCardData) {
      // 3. Validate Previous Data with Zod (Safety Check)
      const parseResult = ScoreCardDataSchema.safeParse(
        previousJournal.scoreCardData,
      );

      if (parseResult.success) {
        const prevData = parseResult.data;
        const fourteenDaysAgo = new Date(
          journal.createdAt.getTime() - 14 * 24 * 60 * 60 * 1000,
        );

        if (previousJournal.createdAt >= fourteenDaysAgo) {
          trends = calculateTrends(scoreCardMetrics, prevData);
        }
      } else {
        console.warn(
          `Invalid ScoreCardData in previous journal ${previousJournal.id}. Skipping trends.`,
        );
      }
    }

    const scoreCardData = { ...scoreCardMetrics, trends };

    // The worker will save the AGP data directly to the database.
    const finalPayload = {
      agpChartData: agpData,
      scoreCardData: scoreCardData,
    };

    // Final Stage: Complete
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'COMPLETE',
        progress: 100,
        statusMessage: 'Your journal is ready.',
        // Save the newly calculated AGP chart data array
        agpChartData:
          finalPayload.agpChartData as unknown as Prisma.InputJsonValue,
        scoreCardData:
          finalPayload.scoreCardData as unknown as Prisma.InputJsonValue,
      },
    });

    console.log(`[Worker] Finished job ${job.id}`);
    return { status: 'done' };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[Worker] Job ${job.id} failed for journal ${journalId}:`,
      errorMessage,
    );

    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'FAILED',
        statusMessage: `Generation failed: ${errorMessage}`,
      },
    });
    throw error;
  }
}

// --- Worker Setup ---
// This guard prevents the worker from starting during tests.
if (process.env.NODE_ENV !== 'test') {
  console.log('[Worker] Starting up...');
  const connection = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(JOURNAL_QUEUE_NAME, processJournalJob, {
    connection,
  });

  worker.on('completed', (job) =>
    console.log(`[Worker] Job ${job.id} has completed.`),
  );
  worker.on('failed', (job, err) =>
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`),
  );

  console.log(`[Worker] Listening for jobs on "${JOURNAL_QUEUE_NAME}"...`);
}
