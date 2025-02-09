'use server';

// import { fetch } from 'next/server';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { decompress, Compressed } from 'compress-json';
import {
  AssessmentData,
  AssessmentInsight,
  filterCriticalInsights,
  GlucoseUnits,
  insightsToNotes,
  NightscoutData,
  PodcastGenerateResult,
} from '~/types/nightscout';
import { ATProfileSettings, findMostActiveProfile, transformNightscoutProfileToAutotune } from './nightscoutProfile';
import dotenv from 'dotenv';
import { AutotunePreppedData, gn_autotune_prep } from '../../oref0-autotune/gn-autotune-prep';
import { checkDawnPhenomenon, getDawnPhenomenonNotes } from '../../oref0-autotune/gn-dawn-phenom';
import { getPatientsRange, getWeekOverview, PatientRange } from '../../oref0-autotune/gn-overview';
import {
  generatePodcastAudio,
  generatePodcastDescription,
  generatePodcastText,
  getAssessment,
} from '~/gemini/geminiActions';
import { FullAnalysisResult, analyzeTimeOfDay, AnalysisResult } from '../../oref0-autotune/gn-meal-analysis';
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
    logger.error(`Error in ${step}: ${error}`);
    throw error;
  }
}

export async function generateAssessments(
  cEntries: Compressed,
  cTreatments: Compressed,
  cProfiles: Compressed,
  id: string,
  preferred_units: GlucoseUnits,
): Promise<AssessmentData | null> {
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
    ///////////////////////////////////////////////////////////////////////////
    // Meal analysis
    ///////////////////////////////////////////////////////////////////////////
    const firstDate = new Date(nsData.entries[0].date).toISOString().split('T')[0];
    const endDate = new Date(nsData.entries[nsData.entries.length - 1].date).toISOString().split('T')[0];
    const numDays = Math.round((new Date(endDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24));
    const all_prepped_glucose = gn_autotune_prep(nsData.entries, nsData.treatments, profile_data, pumpprofile_data);

    var notes = '';
    notes += `# Patient notes: ${firstDate} to ${endDate}\n`;
    notes += `Please note: The patient's preferred blood glucose units are ${preferred_units}.\n`;
    notes += '\n';

    const full_analysis: FullAnalysisResult = analyzeTimeOfDay(all_prepped_glucose);
    const patient_range: PatientRange = getPatientsRange(full_analysis.overall);

    notes += '## Weekly overview\n\n';

    let overview_insights: AssessmentInsight[] = getWeekOverview(
      full_analysis.overall,
      numDays,
      preferred_units,
      patient_range,
    );

    let critical_insights: AssessmentInsight[] | null = filterCriticalInsights(overview_insights);
    ///////////////////////////////
    // If there are critical insights at this phase, this app shouldn't be used
    // For now, we will return those critical insights (which also state they
    // need to see a medical professional), and the podcast will tell them so.
    ///////////////////////////////
    if (critical_insights) {
      notes += insightsToNotes(critical_insights);
      var assessment2: AssessmentData = {
        valid: true,
        notes: notes,
        assessment1: '',
        assessment2: '',
        id: id,
        preferred_units,
      };
    } else {
      notes += insightsToNotes(overview_insights);

      ///////////////////////////////////////////////////////////////////////////
      // Dawn phenomenom
      ///////////////////////////////////////////////////////////////////////////
      notes += '\n\n';
      notes += '# Dawn phenomenon analysis\n';
      const dawn_phenom_data = checkDawnPhenomenon(all_prepped_glucose);

      notes += getDawnPhenomenonNotes(dawn_phenom_data, notes, numDays, preferred_units);

      var assessment1: AssessmentData = await getAssessment({
        valid: true,
        notes: notes,
        template_num: 1,
        id: id,
        preferred_units,
      });

      var assessment2: AssessmentData = await getAssessment({
        valid: true,
        notes: notes,
        assessment1: assessment1.assessment1,
        template_num: 2,
        id: id,
        preferred_units,
      });
    }

    let podcast_info: AssessmentData = await generatePodcastText(assessment2);

    podcast_info
      .ssml_dialog!.replace('mg/dl', '')
      .replace('mmol/l', '')
      .replace('TIR', 'time in range')
      .replace('TTIR', 'time in tight range')
      .replace('TAR', 'time above range')
      .replace('TBR', 'time below range');

    // Step 5: Generate title and description
    let podcast_infodesc: AssessmentData = await generatePodcastDescription(podcast_info);
    logger.debug(podcast_infodesc);

    // Step 6: Start generation of audio
    const podcastResult: PodcastGenerateResult = await generatePodcastAudio(podcast_infodesc);

    podcast_info.podcastResult = podcastResult;

    return podcast_info;
  } catch (error) {
    logger.error('Failed to generate assessments: ${error}');
    throw new Error(`Failed to generate assessments: ${error}`);
  }
}
