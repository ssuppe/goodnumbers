'use server';

// import { fetch } from 'next/server';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { decompress, Compressed } from 'compress-json';
import { AssessmentData, NightscoutData, PodcastGenerateResult } from '~/types/nightscout';
import { config } from '~/utils/env';
import { ATProfileSettings, findMostActiveProfile, transformNightscoutProfileToAutotune } from './nightscoutProfile';
import dotenv from 'dotenv';
import { AutotunePreppedData, gn_autotune_prep } from '../oref0-autotune/gn-autotune-prep';
import { checkDawnPhenomenon, getDawnPhenomenonNotes } from '../oref0-autotune/gn-dawn-phenom';
import { getWeekOverview } from '../oref0-autotune/gn-overview';
import {
  generatePodcastAudio,
  generatePodcastDescription,
  generatePodcastText,
  getAssessment,
} from '~/gemini/geminiActions';
var _ = require('lodash');

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
  cEntries: Compressed,
  cTreatments: Compressed,
  cProfiles: Compressed,
  id: string,
): Promise<AssessmentData | null> {
  const apiUrl = config.backendUrl;
  if (!apiUrl || apiUrl == '') {
    logger.error('NEXT_PUBLIC_BACKEND_URL environment variable is not set');
    throw new Error('NEXT_PUBLIC_BACKEND_URL environment variable is not set');
  } else {
    logger.info('NEXT_PUBLIC_BACKEND_URL: ' + apiUrl);
  }

  const nsData: NightscoutData = {
    entries: decompress(cEntries),
    treatments: decompress(cTreatments),
    profiles: decompress(cProfiles),
  };

  //////////////////////////////////////////////////////////////////////////////
  // Sort nsData entries and treatments
  nsData.entries.sort((a, b) => a.date - b.date);
  nsData.treatments.sort((a, b) => a.date - b.date);

  //////////////////////////////////////////////////////////////////////////////
  // PROFILE: Autotune only uses a single profile over all days, so I will replicate here
  /////////////////////////////////////////////////////////////////////////////

  const { profile, daysActive, activeProfileSettings } = findMostActiveProfile(nsData.profiles);
  const activeATProfileSettings: ATProfileSettings = transformNightscoutProfileToAutotune(activeProfileSettings);
  // Simple assignment of activeSettings to both variables, to allow the regular
  // autotune code to work without modifications
  const profile_data: ATProfileSettings = _.cloneDeep(activeATProfileSettings);
  const pumpprofile_data: ATProfileSettings = _.cloneDeep(activeATProfileSettings);

  // disallow impossibly low carbRatios due to bad decoding
  // GN: Goodnumbers version of this only looks at
  if (typeof profile_data.carb_ratio === 'undefined' || profile_data.carb_ratio < 2) {
    if (typeof pumpprofile_data.carb_ratio === 'undefined' || pumpprofile_data.carb_ratio < 2) {
      console.log(
        '{ "carbs": 0, "mealCOB": 0, "reason": "carb_ratios ' +
          profile_data.carb_ratio +
          ' and ' +
          pumpprofile_data.carb_ratio +
          ' out of bounds" }',
      );
      console.error(
        'Error: carb_ratios ' + profile_data.carb_ratio + ' and ' + pumpprofile_data.carb_ratio + ' out of bounds',
      );
      return null;
    } else {
      profile_data.carb_ratio = pumpprofile_data.carb_ratio;
    }
  }

  try {
    // Step 1: Generate Notes
    logger.info('Step 1');
    logger.info('Sending to ' + `${apiUrl}/api/get_notes`);
    ///////////////////////////////////////////////////////////////////////////
    // Meal analysis
    ///////////////////////////////////////////////////////////////////////////
    const firstDate = new Date(nsData.entries[0].date).toISOString().split('T')[0];
    const endDate = new Date(nsData.entries[nsData.entries.length - 1].date).toISOString().split('T')[0];
    const numDays = Math.round((new Date(endDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24));
    const all_prepped_glucose = gn_autotune_prep(nsData.entries, nsData.treatments, profile_data, pumpprofile_data);

    var notes = getWeekOverview(all_prepped_glucose, firstDate, endDate, numDays);

    ///////////////////////////////////////////////////////////////////////////
    // Dawn phenomenom
    ///////////////////////////////////////////////////////////////////////////
    notes += '\n\n';
    notes += '# Dawn phenomenon analysis\n';
    const dawn_phenom_data = checkDawnPhenomenon(all_prepped_glucose);

    notes += getDawnPhenomenonNotes(dawn_phenom_data, notes, numDays);

    const assessment1: AssessmentData = await getAssessment({
      valid: true,
      notes: notes,
      template_num: 1,
      id: id,
    });

    const assessment2: AssessmentData = await getAssessment({
      valid: true,
      notes: notes,
      assessment1: assessment1.assessment1,
      template_num: 2,
      id: id,
    });

    // Step 4: Generate Dialog
    // let podcast_info: AssessmentData = await fetchWithErrorHandling(
    //   `${apiUrl}/api/gen_podcast_text`,
    //   {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ valid: true, notes: notes, assessment1: assessment1, assessment2: assessment2, id: id }),
    //   },
    //   'Generating Dialog',
    // );

    let podcast_info: AssessmentData = await generatePodcastText(assessment2);
    // Step 5: Generate title and description
    let podcast_infodesc: AssessmentData = await generatePodcastDescription(podcast_info);
    logger.debug(podcast_infodesc);

    // Step 6: Start generation of audio
    const podcastResult: PodcastGenerateResult = await generatePodcastAudio(podcast_infodesc);

    podcast_info.podcastResult = podcastResult;

    return podcast_info;
  } catch (error) {
    const err = error as AssessmentError;
    logger.error('Failed to generate assessments:', { error: err });
    throw new Error(`Failed to generate assessments: ${err.step || 'Unknown step'} - ${err.message}`);
  }
}
