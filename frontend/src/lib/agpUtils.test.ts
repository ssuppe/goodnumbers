import { describe, it, expect } from "vitest";
import { getClinicalThresholds, normalizeAgpData } from "./agpUtils";

// Mock data matching the shape of raw backend data
const RAW_ENTRY = {
  time: "00:00",
  p5: 100,
  p25: 110,
  median: 120,
  mean: 125,
  p75: 140,
  p95: 160,
  // PII / Metadata fields that should be stripped
  pumpSerial: "SECRET_123",
  identifier: "uuid-123",
  created_at: "2023-01-01",
};

describe("agpUtils", () => {
  describe("getClinicalThresholds", () => {
    it("returns correct values for mg/dL", () => {
      expect(getClinicalThresholds("MGDL")).toEqual({ low: 70, high: 180 });
    });

    it("returns correct values for mmol/L", () => {
      expect(getClinicalThresholds("MMOL")).toEqual({ low: 3.9, high: 10.0 });
    });
  });

  describe("normalizeAgpData", () => {
    it("strips PII fields", () => {
      const result = normalizeAgpData([RAW_ENTRY], "MGDL");
      const point = result[0];
      expect(point).toHaveProperty("median");
      expect(point).not.toHaveProperty("pumpSerial");
      expect(point).not.toHaveProperty("identifier");
      expect(point).not.toHaveProperty("created_at");
    });

    it("converts units to mmol/L correctly", () => {
      // 120 mg/dL / 18.0182 ~= 6.66
      const result = normalizeAgpData([RAW_ENTRY], "MMOL");
      expect(result[0].median).toBeCloseTo(6.66, 1);
      expect(result[0].p5).toBeCloseTo(5.55, 1);
    });

    it("handles null values correctly", () => {
      const entryWithNulls = { ...RAW_ENTRY, p5: null, median: null };
      const result = normalizeAgpData([entryWithNulls], "MMOL");
      expect(result[0].p5).toBeNull();
      expect(result[0].median).toBeNull();
    });

    it("safety guard: rejects impossible high values", () => {
      // 2000 mg/dL is physically impossible (likely error code)
      const badEntry = { ...RAW_ENTRY, median: 2000 };
      const result = normalizeAgpData([badEntry], "MGDL");
      expect(result[0].median).toBeNull();
    });

    it("safety guard: rejects impossible low values", () => {
      // Negative values are impossible
      const badEntry = { ...RAW_ENTRY, median: -5 };
      const result = normalizeAgpData([badEntry], "MGDL");
      expect(result[0].median).toBeNull();
    });
  });
});
