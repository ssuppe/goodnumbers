// goodnumbers/src/lib/schemas.ts
import { z } from 'zod';

export const testValidationSchema = z.object({
  name: z.string({
    required_error: 'Name is required',
  }),
  value: z.number().min(1),
});
