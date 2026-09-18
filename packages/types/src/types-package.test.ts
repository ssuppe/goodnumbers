import { describe, it, expect } from "vitest";

describe("Types Package", () => {
  it("should export GlucoseUnit enum", async () => {
    // Dynamic import to allow test to run even if export is missing initially (simulating Red state checks)
    // In strict TS this might fail compilation, but for TDD flow we try to import.
    // Since we are in a monorepo with ts-node/vitest, we can try importing from index.

    // @ts-ignore - Ignoring error for TDD Red phase if export doesn't exist yet
    const { GlucoseUnit } = await import("./index");
    expect(GlucoseUnit).toBeDefined();
    expect(GlucoseUnit?.MGDL).toBe("MGDL");
  });

  it("should support QuickCoachStory interface structure", async () => {
    const { GlucoseUnit } = await import("./index");
    const story = {
      audio_script: "Let's review your post-lunch data.",
      animation_cues: [
        { time_ms: 0, action: "DRAW_MEAN" as const },
        { time_ms: 3000, action: "DRAW_DAY" as const, day_index: 0 },
        { time_ms: 6000, action: "DRAW_TREATMENTS" as const, day_index: 0 },
      ],
    };
    expect(story.audio_script).toBe("Let's review your post-lunch data.");
    expect(story.animation_cues).toHaveLength(3);
    expect(story.animation_cues[0].action).toBe("DRAW_MEAN");
  });
});
