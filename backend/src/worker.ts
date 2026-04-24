// file: src/worker.ts

import './lib/env.js';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { JOURNAL_QUEUE_NAME } from './lib/queue.js';
import { prisma, Prisma } from './lib/prisma.js';
import { NightscoutClient } from './lib/nightscout/client.js';
import { decrypt } from './lib/encryption.js';
import { calculateAgp } from './lib/agp/calculateAgp.js';
import { calculateMetrics, calculateTrends } from './lib/scorecard.js';
import { ScoreCardDataSchema, type ScoreCardData } from '@goodnumbers/schemas';
import { HotspotDetector } from './lib/analysis/HotspotDetector.js';
import { z } from 'zod';
import { NightscoutTreatment } from './lib/nightscout/types.js';
import { generateAggregateInsights } from './lib/insights/aggregate.js';
import { generateClusterInsights } from './lib/insights/cluster.js';
import {
  generateClusterAIInsight,
  generateExecutiveSummary,
} from './lib/ai/gemini.js';
import { InsightArraySchema } from '@goodnumbers/schemas';
import { GlucoseUnit, GlycemicCluster } from '@goodnumbers/types';

// --- Sanitization Logic ---
const StoredTreatmentSchema = z.object({
  id: z.string(),
  date: z.number(),
  carbs: z.number(), // Strict number (no null)
  insulin: z.number(), // Strict number (no null)
  eventType: z
    .string()
    .max(50)
    .transform((val) => val || 'Unknown'),
});

function normalizeTreatment(t: NightscoutTreatment) {
  const parseValue = (val: unknown): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(num) ? null : num;
  };

  const carbs = parseValue(t.carbs);
  const insulin = parseValue(t.insulin);

  // Data Minimization: Drop empty records
  if (!carbs && !insulin) return null;

  const rawObj = {
    id: t._id,
    date: t.date || new Date(t.created_at).getTime(),
    carbs: carbs || 0,
    insulin: insulin || 0,
    eventType: t.eventType,
  };

  // Validate against Zod
  const result = StoredTreatmentSchema.safeParse(rawObj);
  return result.success ? result.data : null;
}

export async function processJournalJob(job: Job) {
  const { journalId } = job.data;
  console.log(`[Worker] Processing job ${job.id} (Journal ID: ${journalId})`);

  try {
    // 1. Fetch the Journal and associated User credentials
    const journal = await prisma.journal.findUnique({
      where: { id: journalId },
      include: {
        user: {
          select: {
            nightscoutUrl: true,
            nightscoutToken: true,
            preferredUnits: true,
          },
        },
      },
    });

    if (!journal || !journal.user) {
      throw new Error('Journal or User not found');
    }

    if (!journal.user.nightscoutUrl || !journal.user.nightscoutToken) {
      throw new Error('User Nightscout credentials are missing');
    }

    // 2. Decrypt the token
    const token = decrypt(journal.user.nightscoutToken);

    // 3. Initialize the Nightscout Client
    const client = new NightscoutClient(journal.user.nightscoutUrl, token);

    // Stage 1: Fetching Data
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'ANALYZING_DATA',
        progress: 20,
        statusMessage:
          'Gathering your blood glucose, insulin, and meal data from Nightscout...',
      },
    });

    // Calculate windows
    const now = new Date();
    const FETCH_DAYS = 7;
    const TREATMENT_BUFFER_HOURS = 3;

    // Fetch start: 7 days ago - 3 hours
    const fetchStart = new Date(now);
    fetchStart.setDate(fetchStart.getDate() - FETCH_DAYS);
    fetchStart.setHours(fetchStart.getHours() - TREATMENT_BUFFER_HOURS);

    // Fetch end: now + 3 hours
    const fetchEnd = new Date(now);
    fetchEnd.setHours(fetchEnd.getHours() + TREATMENT_BUFFER_HOURS);

    // Fetch all data in parallel for efficiency
    const [entries, rawTreatments, profiles] = await Promise.all([
      client.fetchEntries(FETCH_DAYS),
      client.fetchTreatments(fetchStart, fetchEnd),
      client.fetchProfile(),
    ]);

    // Sanitize Treatments
    const treatments = rawTreatments
      .map(normalizeTreatment)
      .filter((t): t is z.infer<typeof StoredTreatmentSchema> => t !== null);

    console.log(
      `[Worker] Fetched ${entries.length} entries, ${rawTreatments.length} raw treatments (${treatments.length} valid), and ${profiles.length} profiles.`,
    );

    // Stage 2: AGP Chart Data Generation
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'CALCULATING_AGP',
        progress: 50,
        statusMessage:
          'Calculating Ambulatory Glucose Profile (AGP) percentiles...',
      },
    });

    // Use the timezone from the fetched profile data (default to London if missing)
    const defaultProfileName = profiles[0]?.defaultProfile;
    let userTimezone =
      defaultProfileName && profiles[0]?.store?.[defaultProfileName]?.timezone;

    // Fallback: If profile timezone is missing, infer from the most recent entry's utcOffset
    if (
      !userTimezone &&
      entries.length > 0 &&
      entries[0].utcOffset !== undefined
    ) {
      const offsetMinutes = entries[0].utcOffset;
      const offsetHours = offsetMinutes / 60;
      // Format as 'UTC+X' or 'UTC-X'
      const sign = offsetHours >= 0 ? '+' : '';
      userTimezone = `UTC${sign}${offsetHours}`;
      console.log(
        `[Worker] Inferred timezone from data: ${userTimezone} (offset: ${offsetMinutes})`,
      );
    }

    // Final fallback
    if (!userTimezone) {
      throw new Error('Incorrect timezone information, check Nightscout.');
    }

    const agpData = calculateAgp(entries, userTimezone);

    // --- Voyager Scorecards Calculation ---

    // 1. Calculate base metrics securely
    let scoreCardMetrics;
    try {
      // Map NightscoutEntry to GlucoseEntry (ensure date is number)
      const glucoseEntries = entries.map((e) => ({
        sgv: e.sgv,
        date: e.date,
        dateString: new Date(e.date).toISOString(),
      }));
      scoreCardMetrics = calculateMetrics(glucoseEntries);
    } catch (error) {
      console.error(
        `Failed to calculate metrics for Journal ${journalId}. Error: ${(error as Error).message}`,
      );
      // Fallback to zeros on error
      scoreCardMetrics = {
        avgGlucose: 0,
        stability: 0,
        timeInRange: 0,
        timeInTightRange: 0,
      };
    }

    // 2. Fetch Previous Journal for Trends
    const previousJournal = await prisma.journal.findFirst({
      where: {
        userId: journal.userId,
        status: 'COMPLETE',
        createdAt: { lt: journal.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    let trends = null;

    if (previousJournal && previousJournal.scoreCardData) {
      // 3. Validate Previous Data with Zod (Safety Check)
      const parseResult = ScoreCardDataSchema.safeParse(
        previousJournal.scoreCardData,
      );

      if (parseResult.success) {
        const prevData = parseResult.data;
        const fourteenDaysAgo = new Date(
          journal.createdAt.getTime() - 14 * 24 * 60 * 60 * 1000,
        );

        if (previousJournal.createdAt >= fourteenDaysAgo) {
          trends = calculateTrends(scoreCardMetrics, prevData);
        }
      } else {
        console.warn(
          `Invalid ScoreCardData in previous journal ${previousJournal.id}. Skipping trends.`,
        );
      }
    }

    const scoreCardData = { ...scoreCardMetrics, trends };

    // --- Executive Summary Generation ---
    console.log(
      `[Worker] Generating Executive Summary for Journal ${journalId}...`,
    );
    const executiveSummary = await generateExecutiveSummary(
      {
        avgGlucose: scoreCardMetrics.avgGlucose,
        timeInRange: scoreCardMetrics.timeInRange,
        stability: scoreCardMetrics.stability,
        lowPercentage:
          entries.length > 0
            ? (entries.filter((e) => e.sgv < 70).length / entries.length) * 100
            : 0,
      },
      previousJournal?.scoreCardData as unknown as ScoreCardData,
      journal.user.preferredUnits as GlucoseUnit,
    );

    // --- Hotspot Engine Execution ---
    console.log(
      `[Worker] Starting Hotspot Detection for Journal ${journalId}...`,
    );

    // 1. Initialize Detector with user's timezone
    const detector = new HotspotDetector(userTimezone);

    // 2. Map Nightscout entries to GlucoseEntry format
    const glucoseEntries = entries.map((e) => ({
      sgv: e.sgv,
      date: e.date,
      dateString: new Date(e.date).toISOString(),
    }));

    // 3. Detect Events
    const hyperEvents = detector.detectEvents(glucoseEntries, 'hyper', 180);
    const hypoEvents = detector.detectEvents(glucoseEntries, 'hypo', 70);

    console.log(
      `[Worker] Detected ${hyperEvents.length} hyper events and ${hypoEvents.length} hypo events.`,
    );

    // 4. Find Clusters
    const hyperClusters = detector.findClusters(hyperEvents);
    const hypoClusters = detector.findClusters(hypoEvents);
    const allClusters = [...hyperClusters, ...hypoClusters];

    console.log(
      `[Worker] Identified ${allClusters.length} recurring clusters. Timezone: ${userTimezone}`,
    );

    // --- Insights Generation ---

    // 1. Aggregate Insights
    const rawAnalysisInsights = generateAggregateInsights(
      glucoseEntries,
      journal.user.preferredUnits as GlucoseUnit,
    );
    // SECURITY: Validate
    const analysisInsights = InsightArraySchema.parse(rawAnalysisInsights);

    // 2. Cluster Insights (Deterministic + AI)
    // Optimization: Sort treatments once
    treatments.sort((a, b) => a.date - b.date);

    console.log(
      `[Worker] Generating AI insights for ${allClusters.length} clusters...`,
    );

    // Fetch existing clusters to preserve userNotes if they exist
    const existingClusters = await prisma.glycemicEventCluster.findMany({
      where: { journalId },
    });
    const existingNotesMap = new Map(
      existingClusters
        .filter((c) => c.userNotes)
        .map((c) => [`${c.eventType}-${c.meanTimeMinutes}`, c.userNotes]),
    );

    const clusterData = [];
    let currentIdx = 0;

    for (const c of allClusters) {
      currentIdx++;
      const progress = Math.min(
        60 + (currentIdx / allClusters.length) * 30,
        95,
      );

      await prisma.journal.update({
        where: { id: journalId },
        data: {
          progress: Math.floor(progress),
          statusMessage: `AI Analysis: Deep-diving into pattern ${currentIdx} of ${allClusters.length}...`,
        },
      });

      // Step A: Deterministic Heuristics (Ground Truth)
      const deterministicInsights = generateClusterInsights(
        c,
        treatments,
        userTimezone,
      );

      // Step B: AI Clinical Assessment (Pro Model)
      const aiAssessment = await generateClusterAIInsight(
        c as unknown as GlycemicCluster,
        deterministicInsights,
        journal.user.preferredUnits as GlucoseUnit,
        treatments, // Pass raw treatments for better context
        userTimezone, // Pass timezone for accurate evidence formatting
      );

      // SECURITY: Validate deterministic insights before DB write
      const safeInsights = InsightArraySchema.safeParse(deterministicInsights);
      if (!safeInsights.success) {
        console.error(`[Worker] Insight validation failed for cluster ${c.id}`);
      }

      // Attempt to match existing note based on event signature (Type + Time)
      const signature = `${c.type}-${c.avgStartMinute}`;
      const preservedNote = existingNotesMap.get(signature) || null;

      clusterData.push({
        journalId,
        eventType: c.type,
        eventCount: c.eventCount,
        meanTimeMinutes: c.avgStartMinute,
        clusterDataJson: c as unknown as Prisma.InputJsonValue,
        insights: safeInsights.success
          ? (safeInsights.data as unknown as Prisma.InputJsonValue)
          : [],
        aiInsight: aiAssessment.assessment,
        quickLogSuggestions:
          aiAssessment.quickLogSuggestions as unknown as Prisma.InputJsonValue,
        userNotes: preservedNote,
      });
    }

    // 5. Atomic Persistence (Delete Old + Save New)
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        progress: 95,
        statusMessage: 'Saving your weekly report...',
      },
    });

    await prisma.$transaction([
      prisma.glycemicEventCluster.deleteMany({ where: { journalId } }),
      prisma.glycemicEventCluster.createMany({
        data: clusterData,
      }),
    ]);

    // The worker will save the AGP data directly to the database.
    const finalPayload = {
      agpChartData: agpData,
      scoreCardData: scoreCardData,
    };

    // Final Stage: Complete
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'COMPLETE',
        progress: 100,
        statusMessage: 'Your journal is ready.',
        // Save the newly calculated AGP chart data array
        agpChartData:
          finalPayload.agpChartData as unknown as Prisma.InputJsonValue,
        scoreCardData:
          finalPayload.scoreCardData as unknown as Prisma.InputJsonValue,
        executiveSummary: executiveSummary as unknown as Prisma.InputJsonValue,
        treatments: treatments as unknown as Prisma.InputJsonValue,
        analysisInsights: analysisInsights as unknown as Prisma.InputJsonValue,
      },
    });

    console.log(`[Worker] Finished job ${job.id}`);
    return { status: 'done' };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[Worker] Job ${job.id} failed for journal ${journalId}:`,
      errorMessage,
    );

    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: 'FAILED',
        statusMessage: `Generation failed: ${errorMessage}`,
      },
    });
    throw error;
  }
}

// --- Worker Setup ---
// This guard prevents the worker from starting during tests.
if (process.env.NODE_ENV !== 'test') {
  console.log('[Worker] Starting up...');
  const connection = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(JOURNAL_QUEUE_NAME, processJournalJob, {
    connection,
  });

  worker.on('completed', (job) =>
    console.log(`[Worker] Job ${job.id} has completed.`),
  );
  worker.on('failed', (job, err) =>
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`),
  );

  console.log(`[Worker] Listening for jobs on "${JOURNAL_QUEUE_NAME}"...`);
}
