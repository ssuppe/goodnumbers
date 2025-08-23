// file: goodnumbers-workspace/goodnumbers/src/worker.ts
import 'dotenv/config'; // Make sure to load environment variables first
import { Worker } from 'bullmq';
import Redis from 'ioredis';

// Import the queue name to ensure consistency with the API server.
import { JOURNAL_QUEUE_NAME } from './lib/queue.js';

// The worker needs its own connection to Redis.
const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

console.log(
  `[WORKER_STARTUP] Worker process started, connected to Redis on ${process.env.REDIS_HOST}. Listening for jobs on queue: '${JOURNAL_QUEUE_NAME}'`,
);

// Create a new Worker instance.
// The first argument is the queue name it should listen to.
// The second argument is the "processor" function that will be called for each job.
const worker = new Worker(
  JOURNAL_QUEUE_NAME,
  async (job) => {
    // This is where the actual work happens.
    // For this task, we just log the job data to confirm it was received.
    // In future tasks, this is where we will fetch Nightscout data and call the AI.
    console.log(
      `[WORKER_JOB_PROCESSING] Processing job #${job.id} with name '${job.name}' for journal: ${job.data.journalId}`,
    );

    // Simulate some work, like a long-running API call.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(`[WORKER_JOB_COMPLETED] Finished processing job #${job.id}`);

    // The return value can be used to store a result for the job.
    return { status: 'Complete', journalId: job.data.journalId };
  },
  { connection },
);

// Listen to events emitted by the worker. This is great for logging and monitoring.
worker.on('completed', (job, result) => {
  console.log(
    `[WORKER_EVENT] Job ${job.id} has completed successfully! Result:`,
    result,
  );
});

worker.on('failed', (job, err) => {
  console.error(
    `[WORKER_EVENT] Job ${job?.id} has failed with error: ${err.message}`,
    err,
  );
});

worker.on('error', (err) => {
  console.error('[WORKER_EVENT] A worker error occurred:', err);
});

// --- BEST PRACTICE: Graceful Shutdown ---
// This is critical for a background worker. If the process is killed suddenly
// (e.g., during a deployment or by pressing Ctrl+C), we want to allow any
// currently running job to finish before the process exits. Otherwise, we could
// leave a journal in a half-processed, corrupted state. BullMQ's `worker.close()`
// handles this for us: it waits for the current job to complete before resolving.
const gracefulShutdown = async (signal: string) => {
  console.log(
    `[WORKER_SHUTDOWN] Received ${signal}, shutting down gracefully...`,
  );
  await worker.close();
  console.log(
    '[WORKER_SHUTDOWN] All active jobs processed. Closing Redis connection.',
  );
  await connection.quit();
  process.exit(0);
};

// Listen for termination signals from the OS
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // `kill` command
