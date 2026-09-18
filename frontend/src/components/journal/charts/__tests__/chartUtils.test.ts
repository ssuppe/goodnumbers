import { describe, it, expect } from "vitest";
import type { GlycemicCluster } from "@goodnumbers/types";
import {
  calculateCommonDomain,
  getBoundaryHour,
  getLocalWallClockDate,
  formatAxisLabel,
} from "../chartUtils";

describe("calculateCommonDomain", () => {
  it("calculates domain for disjoint ranges with padding", () => {
    const series = [
      { data: [{ value: [100, 0] }, { value: [200, 0] }] },
      { data: [{ value: [300, 0] }, { value: [400, 0] }] },
    ];
    // 30 mins padding = 1,800,000 ms
    const result = calculateCommonDomain(series, 30);
    expect(result).toEqual({ min: 100 - 1800000, max: 400 + 1800000 });
  });

  it("calculates domain for overlapping ranges", () => {
    const series = [
      { data: [{ value: [100, 0] }, { value: [300, 0] }] },
      { data: [{ value: [200, 0] }, { value: [400, 0] }] },
    ];
    const result = calculateCommonDomain(series, 30);
    expect(result).toEqual({ min: 100 - 1800000, max: 400 + 1800000 });
  });

  it("calculates domain for subset ranges", () => {
    const series = [
      { data: [{ value: [100, 0] }, { value: [400, 0] }] },
      { data: [{ value: [200, 0] }, { value: [300, 0] }] },
    ];
    const result = calculateCommonDomain(series, 30);
    expect(result).toEqual({ min: 100 - 1800000, max: 400 + 1800000 });
  });

  it("calculates domain for single series", () => {
    const series = [
      { data: [{ value: [100, 0] }, { value: [200, 0] }] },
      { data: [] },
    ];
    const result = calculateCommonDomain(series, 30);
    expect(result).toEqual({ min: 100 - 1800000, max: 200 + 1800000 });
  });

  it("handles empty series gracefully", () => {
    const series = [{ data: [] }];
    const result = calculateCommonDomain(series);
    expect(result).toBeNull();
  });
});

describe("getBoundaryHour", () => {
  // Helper to create a minimal cluster
  const createCluster = (timestamps: string[]): GlycemicCluster =>
    ({
      id: "test",
      events: [
        {
          id: "e1",
          startTime: timestamps[0],
          endTime: timestamps[timestamps.length - 1],
          readings: timestamps.map((ts) => ({ timestamp: ts, value: 100 })),
        },
      ],
    }) as unknown as GlycemicCluster;

  it("defaults to 0 (midnight) when data is bunched in the middle of the day", () => {
    // 09:00 and 15:00. Largest gap is overnight (18h). Midpoint of overnight is 00:00.
    const cluster = createCluster([
      "2023-01-01T09:00:00Z",
      "2023-01-01T15:00:00Z",
    ]);
    const boundary = getBoundaryHour(cluster);
    expect(boundary).toBe(0);
  });

  it("shifts boundary when additional timestamps (treatments) bridge the gap", () => {
    // Glucose: 09:00 and 15:00.
    // Treatment: 23:00.
    // Gaps: 09->15 (6h), 15->23 (8h), 23->09 (10h).
    // Largest gap is 23->09 (10h). Midpoint is 23 + 5h = 04:00.
    const cluster = createCluster([
      "2023-01-01T09:00:00Z",
      "2023-01-01T15:00:00Z",
    ]);
    const treatmentTime = "2023-01-01T23:00:00Z";

    const boundary = getBoundaryHour(cluster, [treatmentTime]);
    expect(boundary).toBe(0);
  });

  it("ignores additional timestamps if they are empty", () => {
    const cluster = createCluster([
      "2023-01-01T09:00:00Z",
      "2023-01-01T15:00:00Z",
    ]);
    const boundary = getBoundaryHour(cluster, []);
    expect(boundary).toBe(0);
  });

  it("returns 0 when cluster has no events or readings", () => {
    const emptyCluster = {
      id: "empty",
      events: [],
    } as unknown as GlycemicCluster;
    expect(getBoundaryHour(emptyCluster)).toBe(0);
  });

  it("calculates boundary hour when wrap gap is smaller than intermediate gap", () => {
    // Readings at 01:00 and 12:00.
    // Minutes: 60, 720.
    // Gap 1: 720 - 60 = 660 mins (11 hours). Midpoint = 60 + 330 = 390 min -> 6:30 AM -> hour 6.
    // Wrap gap: 1440 - 720 + 60 = 780 mins (13 hours). Wrap gap is larger, so returns 0.
    // Now let's place points at 06:00, 18:00, 20:00:
    // Sorted: 360, 1080, 1200.
    // Gaps: 1080 - 360 = 720 mins (12 hrs, gapStart = 360).
    // 1200 - 1080 = 120 mins.
    // Wrap gap: 1440 - 1200 + 360 = 600 mins (10 hrs).
    // maxGap = 720 > wrapGap (600).
    // Midpoint: 360 + 360 = 720 mins -> 12:00 -> returns 12.
    const cluster = createCluster([
      "2023-01-01T06:00:00Z",
      "2023-01-01T18:00:00Z",
      "2023-01-01T20:00:00Z",
    ]);
    const boundary = getBoundaryHour(cluster);
    expect(boundary).toBe(12);
  });
});

describe("getLocalWallClockDate", () => {
  it("parses ISO timestamp components directly ignoring time zone shifts", () => {
    const d = getLocalWallClockDate("2026-09-15T14:30:45Z");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September is 8
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(45);
  });

  it("falls back gracefully for non-string or non-matching inputs", () => {
    const now = new Date(2026, 8, 15, 12, 0, 0);
    expect(getLocalWallClockDate(now).getTime()).toBe(now.getTime());
    expect(getLocalWallClockDate(12345678).getTime()).toBe(12345678);
    expect(getLocalWallClockDate("invalid-iso-format")).toBeInstanceOf(Date);
  });
});

describe("formatAxisLabel", () => {
  it("formats morning, afternoon, noon, and midnight hours with or without minutes", () => {
    const d1 = new Date(2000, 0, 1, 9, 0, 0).getTime();
    expect(formatAxisLabel(d1)).toBe("9am");

    const d2 = new Date(2000, 0, 1, 12, 0, 0).getTime();
    expect(formatAxisLabel(d2)).toBe("12pm");

    const d3 = new Date(2000, 0, 1, 15, 30, 0).getTime();
    expect(formatAxisLabel(d3)).toBe("3:30pm");

    const d4 = new Date(2000, 0, 1, 0, 15, 0).getTime();
    expect(formatAxisLabel(d4)).toBe("12:15am");
  });
});
