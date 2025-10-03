import { z } from 'zod';

export const userSettingsSchema = z.object({
  nightscoutUrl: z.string().url().optional().nullable(),
  nightscoutToken: z.string().min(1).optional().nullable(),
  preferredUnits: z.enum(['MGDL', 'MMOL']).optional(),
  agreementsSigned: z.boolean().optional(),
});

export const journalIdParamSchema = z.object({
  id: z.string().cuid({ message: 'Invalid journal ID format.' }),
});
