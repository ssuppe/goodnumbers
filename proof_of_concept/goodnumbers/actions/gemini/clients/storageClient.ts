'use server';

import { Storage, Bucket } from '@google-cloud/storage';
import { DEFAULT_AUDIO_PATH, DEFAULT_BUCKET_NAME } from './geminiClient.types.d';

// Helper function for logging with timestamps
function logWithTimestamp(level: 'log' | 'warn' | 'error', message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  if (level === 'log') {
    console.log(logMessage, ...args);
  } else if (level === 'warn') {
    console.warn(logMessage, ...args);
  } else if (level === 'error') {
    console.error(logMessage, ...args);
  }
}

/**
 * Creates a Google Cloud Storage client with the specified credentials.
 * @param projectId Optional project ID. Defaults to 'goodnumbers-446416'.
 * @returns A configured Storage client instance.
 */
function createStorageClient(projectId: string = 'goodnumbers-446416'): Storage {
  logWithTimestamp('log', `GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    logWithTimestamp('error', 'GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
  }

  return new Storage({
    projectId,
    keyFilename: credentialsPath,
  });
}

/**
 * Gets a reference to a Google Cloud Storage bucket.
 * @param bucketName Name of the bucket to access. Defaults to 'goodnumbersmain'.
 * @returns A Bucket instance for the specified bucket.
 */
function getBucket(bucketName: string = DEFAULT_BUCKET_NAME): Bucket {
  const storage = createStorageClient();
  return storage.bucket(bucketName);
}

/**
 * Generates a unique GCS path for podcast audio files.
 * @param id Unique identifier for the podcast.
 * @returns Object containing path information.
 */
function generateAudioPath(id: string) {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
  const fileName = `podcast_${timestamp}.wav`;
  const gcsPath = `${DEFAULT_AUDIO_PATH}/${id}/${fileName}`;
  const outputGcsUri = `gs://${DEFAULT_BUCKET_NAME}/${gcsPath}`;
  const publicUrl = `https://storage.googleapis.com/${DEFAULT_BUCKET_NAME}/${gcsPath}`;

  return {
    fileName,
    gcsPath,
    outputGcsUri,
    publicUrl,
    bucketName: DEFAULT_BUCKET_NAME,
  };
}

export { createStorageClient, getBucket, generateAudioPath };
