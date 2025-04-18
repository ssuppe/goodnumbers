'use server';

import winston from 'winston';
import { decompress, Compressed, compress } from 'compress-json';

import { getBestProfile } from '@/utils/nightscoutProfile';
import { AutotunePreppedData, gn_autotune_prep } from '@/lib/oref0-autotune/gn-autotune-prep';
import { getPatientsRange, getWeekOverview, PatientRange } from '@/lib/oref0-autotune/gn-overview';
import { FullAnalysisResult, analyzeTimeOfDay, AnalysisResult } from '@/lib/oref0-autotune/gn-meal-analysis';
import { generateAgpData } from '@/components/charts/AgpWeeklyChart-data';
import {
  AssessmentData,
  AssessmentInsight,
  ATProfileSettings,
  GlucoseUnits,
  NightscoutData,
  PodcastGenerateResult,
  ReportItem,
  ReportType,
} from '@/types/nightscout.d';
import { filterCriticalInsights, hasCriticalInsights, insightsToNotes } from './nightscoutActions';
import { AgpDataPoint } from '@/components/charts/AgpChart';
import { detectGlycemicEvents } from '@/lib/events/detect_events';
import { clusterGlycemicEvents, minutesToTimeString, TimeCluster } from '@/lib/events/time_clustering/time_clustering';
import { classifyEvents, DEFAULT_CLASSIFICATION_CONFIG } from '@/lib/events/classification/event_classifier';
import { createMealRelatedHighsInsight } from '@/lib/insights/generators/meal-related-highs.generator';
import { getAssessment } from './gemini/services/assessmentService';
import {
  generatePodcastAudio,
  generatePodcastDescription,
  generatePodcastText,
} from './gemini/services/podcastService';
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
  // 1. INITIALIZATION: Create a complete initial state object with all required fields
  // This ensures we have a well-formed object throughout the entire process
  const initialAssessmentData: AssessmentData = {
    valid: true,
    notes: '',
    assessment1: '',
    assessment2: '',
    title: '',
    description: '',
    ssml_dialog: '',
    id: id,
    preferred_units: preferred_units,
    report_items: [],
    patient_range: null,
    podcastResult: null,
  };

  // 2. DATA PREPARATION: Decompress and prepare Nightscout data
  const nsData: NightscoutData = {
    entries: decompress(cEntries),
    treatments: decompress(cTreatments),
    profiles: decompress(cProfiles),
  };

  // Sort nsData entries and treatments
  nsData.entries.sort((a, b) => a.date - b.date);
  nsData.treatments.sort((a, b) => a.date - b.date);

  try {
    // 3. ANALYSIS PHASE: Gather all insights and prepare report data
    logger.info('Step 1: Generate notes');

    // Extract date range information
    const firstDate = new Date(nsData.entries[0].date).toISOString().split('T')[0];
    const endDate = new Date(nsData.entries[nsData.entries.length - 1].date).toISOString().split('T')[0];
    const numDays = Math.round((new Date(endDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24));

    // Get profile data
    let at_profileData: ATProfileSettings[] | null = getBestProfile(nsData.profiles);
    let profile_data: ATProfileSettings = at_profileData![0];
    let pumpprofile_data: ATProfileSettings = at_profileData![1];

    // Prepare glucose data for analysis
    const all_prepped_glucose: AutotunePreppedData = gn_autotune_prep(
      nsData.entries,
      nsData.treatments,
      profile_data,
      pumpprofile_data,
    );

    // Generate AI notes for the report
    var ai_notes = '';
    ai_notes += `# Patient notes: ${firstDate} to ${endDate}\n`;
    ai_notes += `Please note: The patient's preferred blood glucose units are ${preferred_units}.\n`;
    ai_notes += '\n';

    // Weekly overview section
    ai_notes += '## Weekly overview\n\n';
    var weekly_overview_report: ReportItem = {
      type: ReportType.AGP,
      insights: [],
      data: [],
    };

    // Get insights from the weekly overview
    // Analyze the data
    // TODO: This analyzeTimeOfDay seems like overkill now (hourly analysis)
    const full_analysis: FullAnalysisResult = analyzeTimeOfDay(all_prepped_glucose);
    const patient_range: PatientRange = getPatientsRange(full_analysis.overall);
    let { ai_insights, user_insights } = await getWeekOverview(full_analysis.overall, preferred_units, patient_range);
    let weekly_overview_data: AgpDataPoint[] = await generateAgpData(all_prepped_glucose, preferred_units);
    weekly_overview_report.data = weekly_overview_data;

    // 4. BUILD BASE STATE: Update initialAssessmentData with analysis results
    let currentAssessmentData: AssessmentData = {
      ...initialAssessmentData,
      notes: ai_notes,
      report_items: [weekly_overview_report],
      patient_range: patient_range,
    };

    // 5. CRITICAL PATH CHECK: Handle critical insights separately
    if (await hasCriticalInsights(ai_insights)) {
      logger.info('Critical insights detected - using simplified assessment path');
      let critical_insights: AssessmentInsight[] | null = await filterCriticalInsights(ai_insights);

      // Update assessment data with critical insights
      weekly_overview_report.insights = critical_insights;
      const criticalNotes = await insightsToNotes(critical_insights);

      // Return final assessment with critical insights
      return {
        ...currentAssessmentData,
        notes: currentAssessmentData.notes + criticalNotes,
        report_items: [weekly_overview_report],
      };
    }

    // STANDARD PATH: No critical insights detected
    // Add user insights to the report
    ai_notes += await insightsToNotes(ai_insights);
    weekly_overview_report.insights = user_insights;

    // OTHER INSIGHTS
    // First, let's find high and low clusters
    var events = detectGlycemicEvents(all_prepped_glucose, patient_range);
    // Classify the events with our enhanced classification system
    var classifiedEvents = classifyEvents(events, nsData.treatments, DEFAULT_CLASSIFICATION_CONFIG);
    // Cluster the classified events by time
    var clusters: TimeCluster[] = clusterGlycemicEvents(classifiedEvents, 60);

    ///////////////// Create Reports from Clusters ///////////////////
    // Initialize array to store all unique cluster reports
    const allClusterReports: ReportItem[] = [];

    // Check if we have any clusters to analyze
    if (clusters.length > 0) {
      // Create a Map to ensure we only process each unique cluster once
      // We use a combination of eventType and meanTime as the unique identifier
      const uniqueClusters = new Map();

      // First pass: Identify all unique clusters
      for (const cluster of clusters) {
        // Create a unique identifier for this cluster
        const clusterId = `${cluster.eventType}_${cluster.meanTime}`;

        // Only add to our Map if this is a new unique cluster
        if (!uniqueClusters.has(clusterId)) {
          uniqueClusters.set(clusterId, cluster);
        }
      }

      // Prepare the significant clusters section if needed
      // Filter out clusters with only one event for pattern analysis section
      const significantClusters = Array.from(uniqueClusters.values())
        .filter((cluster) => cluster.count >= 2)
        .sort((a, b) => {
          // Primary sort: by count in descending order
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          // Secondary sort: by meanTime in ascending order
          return a.meanTime - b.meanTime;
        });

      // Add header for glycemic patterns section if we have significant clusters
      if (significantClusters.length > 0) {
        ai_notes += '\n\n## Glycemic Pattern Analysis\n\n';
      }

      // Second pass: Process each unique cluster exactly once
      // Process all clusters for meal insights, but only add pattern notes for significant ones
      let patternCounter = 1;

      try {
        // Process each unique cluster
        for (const cluster of significantClusters) {
          // 1. Create a meal-related insight generator specific to this cluster
          const clusterMealHighsGenerator = createMealRelatedHighsInsight([cluster]);

          // 2. Add AI insights to notes
          ai_notes += await insightsToNotes([clusterMealHighsGenerator.getAIInsight()]);

          // 3. Create the insights array for this cluster's report
          // Start with the meal-related insight
          const clusterInsights = [clusterMealHighsGenerator.getUserInsight()];

          // 4. Compress the cluster data for storage efficiency
          const compressedCluster = compress(cluster);

          // 5. Create a compressed data package for this cluster
          const clusterAnalysisData = {
            compressedCluster: compressedCluster,
            // Store meanTime separately outside the compressed data for easier sorting
            meanTimeMinutes: cluster.meanTime,
            // Reference to tell the client which entries to use
            dataReference: {
              type: 'nightscout-entries',
              id: id, // The hash ID used for storage
            },
          };

          // 6. Create a report item for this cluster - ONE report per unique cluster
          const clusterAnalysisReport: ReportItem = {
            type: ReportType.CLUSTER_LINE,
            insights: clusterInsights,
            data: [clusterAnalysisData],
          };

          // 7. Add this cluster's report item to the collection
          allClusterReports.push(clusterAnalysisReport);

          // 8. Add pattern notes for significant clusters (2+ events)
          if (cluster.count >= 2) {
            ai_notes += `Pattern ${patternCounter}: ${cluster.count} ${cluster.eventType.toLowerCase()} events detected `;
            ai_notes += `typically occurring around ${minutesToTimeString(cluster.meanTime)}.\n`;
            patternCounter++;
          }
        }
      } catch (error) {
        // Log any errors during cluster processing but continue execution
        logger.error(`Error processing clusters: ${error}`);
        console.error('Error processing clusters:', error);
      }

      // Update current state with full notes and all report items
      // Combine weekly overview and the unified cluster reports
      currentAssessmentData = {
        ...currentAssessmentData,
        notes: ai_notes,
        report_items: [weekly_overview_report, ...allClusterReports],
      };
    } else {
      // No clusters found - update with just the weekly report
      currentAssessmentData = {
        ...currentAssessmentData,
        notes: ai_notes,
        report_items: [weekly_overview_report],
      };
    }

    // 6. TRANSFORMATION CHAIN: Apply transformations while explicitly preserving state
    logger.info('Step 2: Generate assessment 1');
    // Pass 1: Get first assessment (preserving all fields)
    const assessmentWithPass1 = await getAssessment({
      ...currentAssessmentData,
      template_num: 1,
    });

    logger.info('Step 3: Generate assessment 2');
    // Pass 2: Get second assessment (preserving all fields)
    const assessmentWithPass2 = await getAssessment({
      ...assessmentWithPass1,
      template_num: 2,
    });

    logger.info('Step 4: Generate podcast text');
    // Generate podcast text (preserving all fields)
    const assessmentWithPodcastText = await generatePodcastText(assessmentWithPass2);

    // Clean up the SSML with explicit state preservation
    const assessmentWithCleanSsml = {
      ...assessmentWithPodcastText,
      ssml_dialog: assessmentWithPodcastText
        .ssml_dialog!.replace('mg/dl', '')
        .replace('mmol/l', '')
        .replace('mmol/L', '')
        .replace('TIR', 'time in range')
        .replace('TTIR', 'time in tight range')
        .replace('TAR', 'time above range')
        .replace('TBR', 'time below range')
        .replace('ISF', 'insulin sensitivity ratio')
        .replace('I:C', 'insulin to carb ratio'),
      // Ensure report_items is preserved (in case it was lost)
      report_items: assessmentWithPodcastText.report_items || [weekly_overview_report],
    };

    logger.info('Step 5: Generate podcast description');
    // Generate podcast description (preserving all fields)
    const assessmentWithDescription = await generatePodcastDescription(assessmentWithCleanSsml);

    logger.info('Step 6: Generate podcast audio');
    // Generate audio
    const podcastResult: PodcastGenerateResult = await generatePodcastAudio(assessmentWithDescription);

    // 7. FINAL STATE ASSEMBLY: Create the final return object with all required fields
    const finalAssessmentData: AssessmentData = {
      ...assessmentWithDescription, // Base: include all fields from previous state
      podcastResult: podcastResult, // Add: new podcast result
      // Explicitly list critical fields to ensure they're present
      report_items: assessmentWithDescription.report_items || assessmentWithCleanSsml.report_items,
      ssml_dialog: assessmentWithDescription.ssml_dialog || assessmentWithCleanSsml.ssml_dialog,
      preferred_units: preferred_units,
      patient_range: patient_range,
    };

    return finalAssessmentData;
  } catch (error) {
    // Improved error message with template literals fixed
    logger.error(`Failed to generate assessments: ${error}`);
    throw new Error(`Failed to generate assessments: ${error}`);
  }
}
