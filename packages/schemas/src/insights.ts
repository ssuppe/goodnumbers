import { z } from "zod";
import { InsightPriority } from "@goodnumbers/types";

export const InsightSchema = z.object({
  priority: z.nativeEnum(InsightPriority),
  // SECURITY: Prevent HTML injection at the validation layer
  note: z
    .string()
    .max(500)
    .refine((val) => !/[<>]/.test(val), {
      message: "Insight notes cannot contain HTML characters",
    }),
});

export const InsightArraySchema = z.array(InsightSchema);
