import { describe, it, expect } from "vitest";
import { GlucoseUnit } from "@goodnumbers/types";
import { userSettingsSchema } from "./index";

describe("Schemas Package", () => {
  it("should validate using Types enum", () => {
    const valid = { preferredUnits: GlucoseUnit.MGDL };
    const result = userSettingsSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
