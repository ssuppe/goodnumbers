import { describe, it, expect } from "vitest";
import {
  minutesToTimeString,
  getColloquialEventName,
} from "./EventClusterCard";

describe("EventClusterCard Utils", () => {
  describe("minutesToTimeString", () => {
    it("formats exact hours correctly", () => {
      expect(minutesToTimeString(600)).toBe("10:00"); // 10:00 AM
      expect(minutesToTimeString(840)).toBe("14:00"); // 2:00 PM
    });

    it("rounds to the nearest 15 minutes", () => {
      expect(minutesToTimeString(604)).toBe("10:00"); // 10:04 -> 10:00
      expect(minutesToTimeString(608)).toBe("10:15"); // 10:08 -> 10:15
      expect(minutesToTimeString(622)).toBe("10:15"); // 10:22 -> 10:15
      expect(minutesToTimeString(623)).toBe("10:30"); // 10:23 -> 10:30
    });

    it("handles midnight wraparound correctly", () => {
      expect(minutesToTimeString(1439)).toBe("00:00"); // 23:59 -> 00:00 (next day)
      expect(minutesToTimeString(0)).toBe("00:00");
    });
  });

  describe("getColloquialEventName", () => {
    it("converts HYPER types to 'high blood sugar'", () => {
      expect(getColloquialEventName("HYPER")).toBe("high blood sugar");
      expect(getColloquialEventName("HIGH")).toBe("high blood sugar");
      expect(getColloquialEventName("VERY_HIGH")).toBe("high blood sugar");
    });

    it("converts HYPO types to 'low blood sugar'", () => {
      expect(getColloquialEventName("HYPO")).toBe("low blood sugar");
      expect(getColloquialEventName("HYPOGLYCEMIA")).toBe("low blood sugar");
      expect(getColloquialEventName("LOW")).toBe("low blood sugar");
    });

    it("returns original type for unknown values", () => {
      expect(getColloquialEventName("RAPID_RISE")).toBe("RAPID_RISE");
    });
  });
});
