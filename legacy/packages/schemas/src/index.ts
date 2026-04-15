import { z } from "zod";
import { GlucoseUnit } from "@goodnumbers/types";

export const userSettingsSchema = z.object({
  nightscoutUrl: z.string().url().optional().nullable(),
  nightscoutToken: z.string().min(1).optional().nullable(),
  nightscoutTokenLast3: z.string().optional().nullable(),
  preferredUnits: z.nativeEnum(GlucoseUnit).optional(),
  agreementsSigned: z.boolean().optional(),
});

export const journalIdParamSchema = z.object({
  id: z.string().cuid({ message: "Invalid journal ID format." }),
});

export const journalUpdateSchema = z.object({
  weeklyVibe: z.string().optional().nullable(),
  influencingFactors: z.array(z.string()).optional().nullable(),
  goalsForNextWeek: z.string().optional().nullable(),
  clusterNotes: z.record(z.string(), z.string()).optional(),
});

export const ScoreCardTrendSchema = z.object({
  value: z.number(),
  isPositive: z.boolean(), // Kept for legacy compatibility if needed, but we primarily use signed value now
});

export const ScoreCardDataSchema = z.object({
  avgGlucose: z.number(),
  stability: z.number(),
  timeInRange: z.number(),
  timeInTightRange: z.number(),
  trends: z
    .object({
      avgGlucose: z.number(), // Signed delta
      stability: z.number(),
      timeInRange: z.number(),
      timeInTightRange: z.number(),
    })
    .nullable()
    .optional(),
});

export type ScoreCardData = z.infer<typeof ScoreCardDataSchema>;

// --- Hotspot Engine Schemas ---

export const GlucoseReadingSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number(),
});

export const GlycemicEventSchema = z.object({
  id: z.string(),
  type: z.enum(["hyper", "hypo"]),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  startMinuteOfDay: z.number().min(0).max(1439),
  durationMinutes: z.number().positive(),
  readings: z.array(GlucoseReadingSchema),
});

export const GlycemicClusterSchema = z
  .object({
    id: z.string(),
    type: z.enum(["hyper", "hypo"]),
    avgStartMinute: z.number().min(0).max(1439),
    avgDurationMinutes: z.number().positive(),
    eventCount: z.number().int().positive(),
    activeDays: z.array(z.number().min(1).max(7)), // 1=Mon, 7=Sun
    events: z.array(GlycemicEventSchema),
  })
  .strict();

// --- Insights Schemas ---
export * from "./insights.js";
