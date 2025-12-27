import { describe, it, expect } from "vitest";
import { getBoundaryHour, normalizeTime, formatAxisLabel } from "../chartUtils";
import type { GlycemicCluster } from "@goodnumbers/types";

// Mock helper to create a minimal cluster with events at specific times
// Times should be UTC ISO strings
function createCluster(times: string[]): GlycemicCluster {
  return {
    id: "test-cluster",
    journalId: "journal-1",
    events: times.map((t, i) => ({
      id: `evt-${i}`,
      startTime: t,
      endTime: t, // minimal mock, duration doesn't matter for this logic
      eventType: "HIGH",
      readings: [
        {
          timestamp: t,
          value: 200,
          date: t,
        },
      ],
    })),
    clusterDataJson: {},
    meanTimeMinutes: 0,
    eventType: "HIGH",
    eventCount: times.length,
  };
}

describe("Chart Utils", () => {
  describe("getBoundaryHour", () => {
    it("should return 0 for a standard day cluster (e.g., 2 PM)", () => {
      // 14:00 UTC
      const cluster = createCluster([
        "2023-01-01T14:00:00Z",
        "2023-01-01T15:00:00Z",
      ]);
      // Largest gap is from 15:00 -> 14:00 next day (23 hours). Wrap gap.
      // Expect standard boundary 0.
      expect(getBoundaryHour(cluster)).toBe(0);
    });

    it("should return ~12 for a midnight crossing cluster (23:00 and 01:00)", () => {
      // 23:00 and 01:00
      const cluster = createCluster([
        "2023-01-01T23:00:00Z",
        "2023-01-02T01:00:00Z",
      ]);
      // Gaps:
      // 23:00 -> 01:00 = 2 hours
      // 01:00 -> 23:00 = 22 hours (Largest!)
      // Midpoint of 01:00 (1:00) and 23:00 (23:00) is 12:00.
      expect(getBoundaryHour(cluster)).toBe(12);
    });

    it("should handle empty cluster gracefully", () => {
      const cluster = createCluster([]);
      expect(getBoundaryHour(cluster)).toBe(0);
    });
  });

  describe("normalizeTime", () => {
    it("should keep times on Day 1 if boundary is 0", () => {
      // 14:00
      const time = "2023-01-01T14:00:00Z";
      const normalized = normalizeTime(time, 0);
      const d = new Date(normalized);
      expect(d.getUTCFullYear()).toBe(2000);
      expect(d.getUTCMonth()).toBe(0);
      expect(d.getUTCDate()).toBe(1);
      expect(d.getUTCHours()).toBe(14);
    });

    it("should shift early times to Day 2 if boundary is 12", () => {
      // 01:00 (should move to next day)
      const time = "2023-01-02T01:00:00Z";
      const normalized = normalizeTime(time, 12);
      const d = new Date(normalized);
      expect(d.getUTCDate()).toBe(2);
      expect(d.getUTCHours()).toBe(1);
    });

    it("should keep late times on Day 1 if boundary is 12", () => {
      // 23:00 (should stay on day 1)
      const time = "2023-01-01T23:00:00Z";
      const normalized = normalizeTime(time, 12);
      const d = new Date(normalized);
      expect(d.getUTCDate()).toBe(1);
      expect(d.getUTCHours()).toBe(23);
    });
  });

  describe("formatAxisLabel", () => {
    it("formats morning hours correctly (UTC)", () => {
      // 06:00 UTC
      const time = new Date("2000-01-01T06:00:00Z").getTime();
      expect(formatAxisLabel(time)).toBe("6am");
    });

    it("formats noon correctly (UTC)", () => {
      // 12:00 UTC
      const time = new Date("2000-01-01T12:00:00Z").getTime();
      expect(formatAxisLabel(time)).toBe("12pm");
    });

    it("formats half-hour correctly (UTC)", () => {
      // 06:30 UTC
      const time = new Date("2000-01-01T06:30:00Z").getTime();
      expect(formatAxisLabel(time)).toBe("6:30am");
    });

    it("formats evening hours correctly (UTC)", () => {
      // 18:00 UTC
      const time = new Date("2000-01-01T18:00:00Z").getTime();
      expect(formatAxisLabel(time)).toBe("6pm");
    });

    it("formats midnight correctly (UTC)", () => {
      // 00:00 UTC
      const time = new Date("2000-01-01T00:00:00Z").getTime();
      expect(formatAxisLabel(time)).toBe("12am");
    });
  });
});
