"use server";

// import { fetch } from 'next/server';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { compress, decompress, Compressed } from 'compress-json';



// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
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

export interface PodcastGenerateResult {
  status: string;
  operation_id: string;
  gcs_path: string;
  bucket_name: string;
  message?: string; // Optional field using '?'
}

async function getV3JWTToken(nightscout_url : string, token : string): Promise<string> {
  // https://soopaloop.bbs.io/api/v2/authorization/request/autotune-ca4f6201c17a55b0
  const response = await fetchWithErrorHandling(`${nightscout_url}/api/v2/authorization/request/${token}`, {
    method: 'GET',
    // headers: { 'Content-Type': 'application/json' },
    // body: JSON.stringify({ treatments: sgvData, carbs: treatmentsData }),
  }, "Getting Nightscout v3access token");
  let res = await response.text();
  let t = JSON.parse(res);
  return t.token;
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
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(await handleFetchError(response));
    }
    return await response.json();
  } catch (error) {
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

export async function generateAssessments(csgvData: Compressed, ctreatmentsData: Compressed, useLocalData: boolean) {

  const apiUrl = process.env.FASTAPI_URL;
  if (!apiUrl || apiUrl == "") {
    logger.error('FASTAPI_URL environment variable is not set');
    throw new Error('FASTAPI_URL environment variable is not set');
  }
  else {
    logger.info("FASTAPI_URL: " + apiUrl);
  }

  if (useLocalData) {
    try {
      let sgvData = await readLocalJson('/data/24Sept.30d/Nightscout.entries.24Sept.30d.json');
      sgvData = compress(sgvData);
      let treatmentsData = await readLocalJson('/data/24Sept.30d/Nightscout.treatments.24Sept.30d.json');
      treatmentsData = compress(treatmentsData);
      logger.info("Local data loaded successfully");
    } catch (error) {
      logger.error("Failed to load local data:", { error });
      throw new Error(`Failed to load local data: ${(error as Error).message}`);
    }
  }

  try {
    // Step 1: Generate Notes
    logger.info("Step 1");
    logger.info("sgvData: " + (csgvData == null));
    logger.info("Sending to " + `${apiUrl}/pyapi/get_notes`);
    const notes = await fetchWithErrorHandling(`${apiUrl}/pyapi/get_notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treatments: csgvData, carbs: ctreatmentsData }),
    }, "Generating Notes");

    // Step 2: Generate Assessment 1
    const assessment1Data = await fetchWithErrorHandling(`${apiUrl}/pyapi/get_assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, template_num: 1 }),
    }, "Generating Assessment 1");
    const assessment1 = assessment1Data.response;

    // Step 3: Generate Assessment 2
    const assessment2Data = await fetchWithErrorHandling(`${apiUrl}/pyapi/get_assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, assessment1, template_num: 2 }),
    }, "Generating Assessment 2");
    const assessment2 = assessment2Data.response;

    // Step 4: Generate Dialog
    const dialogData = await fetchWithErrorHandling(`${apiUrl}/pyapi/get_assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, assessment1, assessment2, template_num: 3 }),
    }, "Generating Dialog");
    const dialog = dialogData.response;

    // Step 5: Start generation of audio
     const podcastData = await fetchWithErrorHandling(`${apiUrl}/pyapi/gen_podcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dialog }),
    }, "Generating Dialog");
    const podcast_result : PodcastGenerateResult = podcastData;

    return { notes, assessment1, assessment2, dialog, podcast_result };
  } catch (error) {
    const err = error as AssessmentError;
    logger.error("Failed to generate assessments:", { error: err });
    throw new Error(`Failed to generate assessments: ${err.step || 'Unknown step'} - ${err.message}`);
  }
}
