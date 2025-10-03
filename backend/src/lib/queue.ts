// file: src/lib/queue.ts

import { Queue } from 'bullmq';
// FIX: Use a namespace import to safely access the default export.
import { Redis } from 'ioredis';

let queueInstance: Queue | null = null;

export const JOURNAL_QUEUE_NAME =
  process.env.QUEUE_NAME || 'journal-processing';

/**
 * A singleton factory function to get the journal queue instance.
 * It creates the connection and queue only on the first call.
 */
export function getJournalQueue(): Queue {
  if (!queueInstance) {
    // FIX: Access the constructor via the namespace's .default property. This is type-safe.
    const connection = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT!, 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    queueInstance = new Queue(JOURNAL_QUEUE_NAME, {
      connection,
    });
  }
  return queueInstance;
}
