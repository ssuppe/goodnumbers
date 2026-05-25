import { describe, it, expect } from "vitest";
import { calculateCommonDomain, getBoundaryHour } from "../chartUtils";
import type { GlycemicCluster } from "@goodnumbers/types";

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
    const treatmentTime = new Date("2023-01-01T23:00:00Z").getTime();

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
});
