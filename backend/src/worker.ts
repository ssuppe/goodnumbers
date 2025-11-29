// file: src/worker.ts

import './lib/env.js';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { JOURNAL_QUEUE_NAME } from './lib/queue.js';
import { prisma } from './lib/prisma.js';

// --- Exported Job Logic for Testability ---
// Helper function for async delays
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processJournalJob(job: Job) {
  const { journalId } = job.data;
  console.log(
    `[Worker] FAKE Processing job ${job.id} (Journal ID: ${journalId})`,
  );

  try {
    // Stage 1: Fetching Data
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'ANALYZING_DATA',
        progress: 20,
        statusMessage:
          'Gathering your blood glucose, insulin, and meal data...',
      },
    });
    await sleep(5000); // 5-second delay

    // Stage 2: Statistical Analysis
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'DRAFTING_INSIGHTS',
        progress: 40,
        statusMessage: 'Running analysis to find trends and hotspots...',
      },
    });
    await sleep(5000);

    // Stage 3: AI Scripting
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'GENERATING_AUDIO',
        progress: 60,
        statusMessage:
          'Writing the script for your personalized audio summary...',
      },
    });
    await sleep(5000);

    // Stage 4: Audio Generation
    await prisma.journal.update({
      where: { id: journalId },
      data: { progress: 80, statusMessage: 'Recording your podcast...' },
    });
    await sleep(5000);

    // Final Stage: Complete
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'COMPLETE',
        progress: 100,
        statusMessage: 'Your journal is ready.',
      },
    });

    console.log(`[Worker] FAKE Finished job ${job.id}`);
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
        statusMessage: `Simulation failed: ${errorMessage}`,
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
