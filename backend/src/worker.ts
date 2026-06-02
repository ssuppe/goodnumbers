// file: src/worker.ts

import './lib/env.js';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { DateTime } from 'luxon';
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
    const TREATMENT_BUFFER_HOURS = 3;
    let fetchStart: Date;
    let fetchEnd: Date;
    let lookbackDays: number;

    if (journal.startDate && journal.endDate) {
      // Custom range: use provided dates
      fetchStart = new Date(journal.startDate);
      fetchEnd = new Date(journal.endDate);
      
      // Calculate lookbackDays for the fetchEntries call
      const diffTime = Math.abs(fetchEnd.getTime() - fetchStart.getTime());
      lookbackDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Apply buffer to fetchTreatments only
      fetchStart.setHours(fetchStart.getHours() - TREATMENT_BUFFER_HOURS);
      fetchEnd.setHours(fetchEnd.getHours() + TREATMENT_BUFFER_HOURS);
      
      console.log(`[Worker] Using custom range: ${journal.startDate.toISOString()} to ${journal.endDate.toISOString()} (${lookbackDays} days)`);
    } else {
      // Default: Last 7 days
      const now = new Date();
      lookbackDays = 7;
      
      fetchStart = new Date(now);
      fetchStart.setDate(fetchStart.getDate() - lookbackDays);
      fetchStart.setHours(fetchStart.getHours() - TREATMENT_BUFFER_HOURS);

      fetchEnd = new Date(now);
      fetchEnd.setHours(fetchEnd.getHours() + TREATMENT_BUFFER_HOURS);
      
      console.log(`[Worker] Using default 7-day lookback.`);
    }

    // Fetch all data in parallel for efficiency
    const [entries, rawTreatments, profiles] = await Promise.all([
      client.fetchEntries(fetchStart, fetchEnd),
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

      // Etc/GMT offsets are sign-reversed relative to UTC.
      // UTC-4 (New York) is Etc/GMT+4
      // UTC+8 (Singapore) is Etc/GMT-8
      const gmtOffset = -offsetHours;
      const sign = gmtOffset >= 0 ? '+' : '';
      userTimezone = `Etc/GMT${sign}${gmtOffset}`;

      console.log(
        `[Worker] Inferred valid IANA timezone from data: ${userTimezone} (original offset: ${offsetMinutes} mins)`,
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
    const glucoseEntries = entries.map((e) => {
      // Reconstruct the LOCAL wall-clock time using the offset provided by Nightscout.
      // This ensures we analyze patterns based on the time the user actually saw on their device.
      // Note: Etc/GMT is sign-reversed in IANA (UTC-4 is Etc/GMT+4).
      const gmtOffset = -(e.utcOffset / 60);
      const zone = `Etc/GMT${gmtOffset >= 0 ? '+' : ''}${gmtOffset}`;
      const localDate = DateTime.fromMillis(e.date).setZone(zone);

      return {
        sgv: e.sgv,
        date: e.date,
        dateString: localDate.toISO() || new Date(e.date).toISOString(),
      };
    });

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
        journal.weeklyVibe,
        journal.influencingFactors as string[] | null,
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
        aiInsight: aiAssessment as unknown as Prisma.InputJsonValue,
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
// This guard prevents the worker from starting during tests unless explicitly requested.
if (
  process.env.NODE_ENV !== 'test' ||
  process.env.RUN_WORKER_IN_TESTS === 'true'
) {
  console.log('[Worker] Starting up...');

  const redisOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };

  console.log(
    `[Worker] Connecting to Redis at ${redisOptions.host}:${redisOptions.port}`,
  );
  const connection = new Redis(redisOptions);

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
