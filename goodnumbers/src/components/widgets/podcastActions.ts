'use server';

// import { fetch } from 'next/server';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { compress, decompress, Compressed } from 'compress-json';
import { AssessmentData, PodcastGenerateResult } from '~/types/nightscout';
import { config } from '~/utils/env';

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

interface AssessmentError extends Error {
  step?: string;
  details?: any;
}

async function handleFetchError(response: Response): Promise<string> {
  let errorBody;
  try {
    errorBody = await response.text();
  } catch {
    errorBody = 'Unable to get error body';
  }
  return `Status: ${response.status}, Body: ${errorBody}`;
}

async function fetchWithErrorHandling(url: string, options: RequestInit, step: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes in milliseconds

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(await handleFetchError(response));
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    const err = error as AssessmentError;
    err.step = step;
    err.details = error instanceof Error ? error.message : String(error);
    logger.error(`Error in ${step}:`, { error: err });
    throw err;
  }
}

async function readLocalJson(filePath: string): Promise<any> {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const data = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error reading local file: ${filePath}`, { error });
    throw new Error(`Failed to read local file: ${filePath}`);
  }
}

export async function generateAssessments(
  csgvData: Compressed,
  ccarbsData: Compressed,
  id: string,
): Promise<AssessmentData> {
  const apiUrl = config.backendUrl;
  if (!apiUrl || apiUrl == '') {
    logger.error('NEXT_PUBLIC_BACKEND_URL environment variable is not set');
    throw new Error('NEXT_PUBLIC_BACKEND_URL environment variable is not set');
  } else {
    logger.info('NEXT_PUBLIC_BACKEND_URL: ' + apiUrl);
  }

  try {
    // Store the current timestamp
    const now = new Date();
    const timestamp = now
      .toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(/\//g, '-');

    // Step 1: Generate Notes
    logger.info('Step 1');
    logger.info('sgvData: ' + (csgvData == null));
    logger.info('Sending to ' + `${apiUrl}/api/get_notes`);
    const notes = await fetchWithErrorHandling(
      `${apiUrl}/api/get_notes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: csgvData, treatments: ccarbsData }),
      },
      'Generating Notes',
    );

    // Step 2: Generate Assessment 1
    const assessment1Data = await fetchWithErrorHandling(
      `${apiUrl}/api/get_assessment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: true, notes: notes, template_num: 1, id: id }),
      },
      'Generating Assessment 1',
    );
    const assessment1 = assessment1Data.response;

    // Step 3: Generate Assessment 2
    const assessment2Data = await fetchWithErrorHandling(
      `${apiUrl}/api/get_assessment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: true, notes: notes, assessment1: assessment1, template_num: 2, id: id }),
      },
      'Generating Assessment 2',
    );
    const assessment2 = assessment2Data.response;

    // Step 4: Generate Dialog
    let podcast_info: AssessmentData = await fetchWithErrorHandling(
      `${apiUrl}/api/gen_podcast_text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: true, notes: notes, assessment1: assessment1, assessment2: assessment2, id: id }),
      },
      'Generating Dialog',
    );

    // Step 5: Generate title and description
    podcast_info = await fetchWithErrorHandling(
      `${apiUrl}/api/gen_podcast_description`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(podcast_info),
      },
      'Generating title and description',
    );

    // Step 6: Start generation of audio
    const podcastResult: PodcastGenerateResult = await fetchWithErrorHandling(
      `${apiUrl}/api/gen_podcast`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(podcast_info),
      },
      'Generating Dialog',
    );

    podcast_info.podcastResult = podcastResult;

    return podcast_info;
  } catch (error) {
    const err = error as AssessmentError;
    logger.error('Failed to generate assessments:', { error: err });
    throw new Error(`Failed to generate assessments: ${err.step || 'Unknown step'} - ${err.message}`);
  }
}
