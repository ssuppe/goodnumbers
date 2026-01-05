import { describe, it, expect } from "vitest";
import { GlucoseUnit } from "@goodnumbers/types";
import { userSettingsSchema } from "@goodnumbers/schemas";

describe("Common Package Integration", () => {
  it("should integrate types and schemas", () => {
    expect(GlucoseUnit).toBeDefined();
    expect(userSettingsSchema).toBeDefined();
  });
});
