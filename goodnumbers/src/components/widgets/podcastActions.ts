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
  ReportItem,
} from '~/types/nightscout';
import { ATProfileSettings, getBestProfile, transformNightscoutProfileToAutotune } from './nightscoutProfile';
import dotenv from 'dotenv';
import { AutotunePreppedData, gn_autotune_prep } from '../../oref0-autotune/gn-autotune-prep';
import { getPatientsRange, getWeekOverview, PatientRange } from '../../oref0-autotune/gn-overview';
import {
  generatePodcastAudio,
  generatePodcastDescription,
  generatePodcastText,
  getAssessment,
} from '~/gemini/geminiActions';
import { FullAnalysisResult, analyzeTimeOfDay, AnalysisResult } from '../../oref0-autotune/gn-meal-analysis';
import { profile } from 'console';
import { analyzeMorningRises } from '~/oref0-autotune/gn-dawn-phenom/gn-dawn-phenom-analysis';
import { getDawnPhenomenonNotes } from '~/oref0-autotune/gn-dawn-phenom/gn-dawn-phenom';
import { generateAgpData } from '../charts/AgpWeeklyChart-data';
import { AgpDataPoint } from '../charts/AgpWeeklyChart';
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

  try {
    // Step 1: Generate Notes
    ///////////////////////////////////////////////////////////////////////////
    // Meal analysis
    ///////////////////////////////////////////////////////////////////////////
    const firstDate = new Date(nsData.entries[0].date).toISOString().split('T')[0];
    const endDate = new Date(nsData.entries[nsData.entries.length - 1].date).toISOString().split('T')[0];
    const numDays = Math.round((new Date(endDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24));

    let at_profileData: ATProfileSettings[] | null = getBestProfile(nsData.profiles);
    let profile_data: ATProfileSettings = at_profileData![0];
    let pumpprofile_data: ATProfileSettings = at_profileData![1];

    const all_prepped_glucose: AutotunePreppedData = gn_autotune_prep(
      nsData.entries,
      nsData.treatments,
      profile_data,
      pumpprofile_data,
    );

    logger.info('Step 1: Generate notes');
    var ai_notes = '';
    ai_notes += `# Patient notes: ${firstDate} to ${endDate}\n`;
    ai_notes += `Please note: The patient's preferred blood glucose units are ${preferred_units}.\n`;
    ai_notes += '\n';

    const full_analysis: FullAnalysisResult = analyzeTimeOfDay(all_prepped_glucose);
    const patient_range: PatientRange = getPatientsRange(full_analysis.overall);

    ai_notes += '## Weekly overview\n\n';
    var weekly_overview_report: ReportItem = {
      insights: [],
      data: [],
    };
    let { ai_insights, user_insights } = getWeekOverview(full_analysis.overall, preferred_units, patient_range);

    let weekly_overview_data: AgpDataPoint[] = generateAgpData(all_prepped_glucose, preferred_units);

    weekly_overview_report.data = weekly_overview_data;

    let critical_insights: AssessmentInsight[] | null = filterCriticalInsights(ai_insights);
    ///////////////////////////////
    // If there are critical insights at this phase, this app shouldn't be used
    // For now, we will return those critical insights (which also state they
    // need to see a medical professional), and the podcast will tell them so.
    ///////////////////////////////
    if (critical_insights) {
      weekly_overview_report.insights = critical_insights;
      ai_notes += insightsToNotes(critical_insights);
      var assessment2: AssessmentData = {
        valid: true,
        notes: ai_notes,
        assessment1: '',
        assessment2: '',
        id: id,
        preferred_units: preferred_units,
        report_items: [weekly_overview_report],
      };
    } else {
      ai_notes += insightsToNotes(ai_insights);
      ///////////////////////////////////////////////////////////////////////////
      // Dawn phenomenom
      ///////////////////////////////////////////////////////////////////////////
      // notes += '\n\n';
      // notes += '# Dawn phenomenon analysis\n';
      // // const dawn_phenom_data = checkDawnPhenomenon(all_prepped_glucose, patient_range, profile_data);
      // const morningRiseAnalysis = analyzeMorningRises(all_prepped_glucose, patient_range);

      // if (morningRiseAnalysis.cleanRises.length > 0) {
      //   let dawn_insights = getDawnPhenomenonNotes(morningRiseAnalysis, numDays, preferred_units, patient_range);

      //   notes += insightsToNotes(dawn_insights);
      // }

      var assessment1: AssessmentData = await getAssessment({
        valid: true,
        notes: ai_notes,
        template_num: 1,
        id: id,
        preferred_units: preferred_units,
        report_items: [weekly_overview_report],
      });

      var assessment2: AssessmentData = await getAssessment({
        valid: true,
        notes: ai_notes,
        assessment1: assessment1.assessment1,
        template_num: 2,
        id: id,
        preferred_units: preferred_units,
        report_items: [weekly_overview_report],
      });
    }

    let podcast_info: AssessmentData = await generatePodcastText(assessment2);
    podcast_info.report_items = [weekly_overview_report];

    podcast_info
      .ssml_dialog!.replace('mg/dl', '')
      .replace('mmol/l', '')
      .replace('mmol/L', '')
      .replace('TIR', 'time in range')
      .replace('TTIR', 'time in tight range')
      .replace('TAR', 'time above range')
      .replace('TBR', 'time below range')
      .replace('ISF', 'insulin sensitivity ratio')
      .replace('I:C', 'insulin to carb ratio');

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
