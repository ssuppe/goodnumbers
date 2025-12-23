import { z } from "zod";

export const userSettingsSchema = z.object({
  nightscoutUrl: z.string().url().optional().nullable(),
  nightscoutToken: z.string().min(1).optional().nullable(),
  nightscoutTokenLast3: z.string().optional().nullable(),
  preferredUnits: z.enum(["MGDL", "MMOL"]).optional(),
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
