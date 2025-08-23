// file: goodnumbers-workspace/goodnumbers/src/lib/queue.ts
import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const JOURNAL_QUEUE_NAME =
  process.env.QUEUE_NAME || 'journal-generation';

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  console.error('[FATAL] Redis connection error:', err);
});

// Log which queue is being used. This is very helpful for debugging tests.
console.log(
  `[QUEUE_SETUP] BullMQ is connecting to queue: '${JOURNAL_QUEUE_NAME}'`,
);

export const journalQueue = new Queue(JOURNAL_QUEUE_NAME, { connection });
