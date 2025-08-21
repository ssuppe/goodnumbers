// goodnumbers/src/lib/schemas.ts
import { z } from 'zod';

export const PREFERRED_UNITS = ['MGDL', 'MMOL'] as const;

/**
 * Zod schema for validating the user settings update payload.
 * It validates the request body.
 */
export const userSettingsSchema = z.object({
  body: z.object({
    // The Nightscout URL must be a valid URL string.
    nightscoutUrl: z
      .string()
      .url({ message: 'Invalid Nightscout URL format.' }),

    // The token must be a non-empty string.
    nightscoutToken: z
      .string()
      .min(1, { message: 'Nightscout token cannot be empty.' }),

    // The preferred units must be one of the two allowed values.
    preferredUnits: z.enum(PREFERRED_UNITS, {
      errorMap: () => ({
        message: 'Preferred units must be either MGDL or MMOL.',
      }),
    }),
  }),
});

/**
 * Zod schema for validating CUIDs in route parameters.
 */
export const cuidSchema = z.object({
  params: z.object({
    id: z.string().cuid2({ message: 'Invalid ID format' }),
  }),
});
