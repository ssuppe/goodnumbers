// file: src/worker.ts

import './lib/env.js';
import { Worker, Job } from 'bullmq';
// FIX: Use a namespace import to safely access the default export.
import { Redis } from 'ioredis';
import { JOURNAL_QUEUE_NAME } from './lib/queue.js';
import { prisma } from './lib/prisma.js';

// --- Exported Job Logic for Testability ---
export async function processJournalJob(job: Job) {
  const { journalId } = job.data;
  console.log(`[Worker] Processing job ${job.id} (Journal ID: ${journalId})`);

  try {
    await prisma.journal.update({
      where: { id: journalId },
      data: { status: 'COMPLETE' },
    });
    console.log(`[Worker] Finished job ${job.id}`);
    return { status: 'done' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Worker] Job ${job.id} failed for journal ${journalId}:`, errorMessage);

    await prisma.journal.update({
      where: { id: journalId },
      data: { status: 'FAILED', statusMessage: errorMessage },
    });
    throw error;
  }
}

// --- Worker Setup ---
if (process.env.NODE_ENV !== 'test') {
  console.log('[Worker] Starting up...');
  // FIX: Access the constructor via the namespace's .default property. This is type-safe.
  const connection = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(JOURNAL_QUEUE_NAME, processJournalJob, {
    connection,
  });

  worker.on('completed', (job) => console.log(`[Worker] Job ${job.id} has completed.`));
  worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed: ${err.message}`));

  console.log(`[Worker] Listening for jobs on "${JOURNAL_QUEUE_NAME}"...`);
}