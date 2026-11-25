import { describe, expect, it } from "vitest";
import {
  calculateMetricValue,
  isBetterMetric,
  formatMetricDisplay,
  calculateAttemptPoints,
  getSundayFromYearWeek,
  getWeekNumberFromDate,
  formatWeekOf,
  getWeekRange,
} from "@/lib/domain/training-calculator";

describe("Training Calculator", () => {
  describe("calculateMetricValue", () => {
    it("calculates accuracy percentage accurately", () => {
      expect(calculateMetricValue("accuracy", 15, 20)).toBe(75);
      expect(calculateMetricValue("accuracy", 1, 3)).toBe(33.3);
      expect(calculateMetricValue("accuracy", 20, 20)).toBe(100);
      expect(calculateMetricValue("accuracy", 0, 20)).toBe(0);
    });

    it("clamps accuracy to 0-100", () => {
      expect(calculateMetricValue("accuracy", 25, 20)).toBe(100);
      expect(calculateMetricValue("accuracy", -5, 20)).toBe(0);
    });

    it("handles non-accuracy formats by returning raw primary score", () => {
      expect(calculateMetricValue("highest_score", 42)).toBe(42);
      expect(calculateMetricValue("wins", 5)).toBe(5);
      expect(calculateMetricValue("completion", 100)).toBe(100);
      expect(calculateMetricValue("timed", 24.5)).toBe(24.5);
    });
  });

  describe("isBetterMetric", () => {
    it("handles higher-is-better metrics (streaks, accuracy, wins, reps)", () => {
      expect(isBetterMetric(80, 75, true)).toBe(true);
      expect(isBetterMetric(70, 75, true)).toBe(false);
      expect(isBetterMetric(75, 75, true)).toBe(false);
    });

    it("handles lower-is-better metrics (sprint times, agility courses)", () => {
      expect(isBetterMetric(28.4, 31.2, false)).toBe(true);
      expect(isBetterMetric(35.0, 31.2, false)).toBe(false);
      expect(isBetterMetric(31.2, 31.2, false)).toBe(false);
    });
  });

  describe("formatMetricDisplay", () => {
    it("formats accuracy with fraction and percentage", () => {
      expect(
        formatMetricDisplay({
          trackingFormat: "accuracy",
          metricValue: 75,
          scoreUnit: "drops",
          scorePrimary: 15,
          scoreSecondary: 20,
        }),
      ).toBe("15/20 (75%)");
    });

    it("formats timed duration in seconds", () => {
      expect(
        formatMetricDisplay({
          trackingFormat: "timed",
          metricValue: 28.5,
          scoreUnit: "seconds",
        }),
      ).toBe("28.5s");
    });

    it("formats wins with proper pluralization", () => {
      expect(
        formatMetricDisplay({
          trackingFormat: "wins",
          metricValue: 1,
          scoreUnit: "games",
        }),
      ).toBe("1 win");
      expect(
        formatMetricDisplay({
          trackingFormat: "wins",
          metricValue: 4,
          scoreUnit: "games",
        }),
      ).toBe("4 wins");
    });

    it("formats highest score with custom score unit", () => {
      expect(
        formatMetricDisplay({
          trackingFormat: "highest_score",
          metricValue: 84,
          scoreUnit: "dinks",
        }),
      ).toBe("84 dinks");
    });
  });

  describe("calculateAttemptPoints", () => {
    it("awards base participation points", () => {
      expect(
        calculateAttemptPoints({
          isPersonalBest: false,
          metTargetBenchmark: false,
          isFirstAttemptToday: false,
        }),
      ).toBe(10);
    });

    it("adds daily consistency bonus for first attempt today", () => {
      expect(
        calculateAttemptPoints({
          isPersonalBest: false,
          metTargetBenchmark: false,
          isFirstAttemptToday: true,
        }),
      ).toBe(15);
    });

    it("adds benchmark and personal best bonuses", () => {
      expect(
        calculateAttemptPoints({
          isPersonalBest: true,
          metTargetBenchmark: true,
          isFirstAttemptToday: true,
        }),
      ).toBe(55); // 10 base + 5 consistency + 15 benchmark + 25 PB
    });
  });

  describe("Sunday Week Calculations", () => {
    it("calculates the Sunday date of a given week correctly", () => {
      // 2026 week 48 corresponds to week of Sunday Nov 22, 2026
      const sunday = getSundayFromYearWeek(2026, 48);
      expect(sunday.getDay()).toBe(0); // Sunday
      expect(sunday.getFullYear()).toBe(2026);
      expect(sunday.getMonth()).toBe(10); // Nov (0-indexed)
      expect(sunday.getDate()).toBe(22);
    });

    it("calculates week number from date consistently", () => {
      const date = new Date(2026, 10, 22); // Nov 22, 2026 (Sunday)
      const { year, weekNumber } = getWeekNumberFromDate(date);
      expect(year).toBe(2026);
      expect(weekNumber).toBe(48);
    });

    it("returns a Sunday-to-Sunday range that contains every day of the week", () => {
      const { start, end } = getWeekRange(2026, 48);
      expect(start).toEqual(new Date(2026, 10, 22));
      expect(end).toEqual(new Date(2026, 10, 29));

      // Sunday (start of the app's week) and Saturday night both fall in week 48,
      // matching getWeekNumberFromDate.
      for (const day of [new Date(2026, 10, 22, 9), new Date(2026, 10, 28, 23, 30)]) {
        expect(getWeekNumberFromDate(day)).toEqual({ year: 2026, weekNumber: 48 });
        expect(day >= start && day < end).toBe(true);
      }
      expect(new Date(2026, 10, 29, 0, 0) < end).toBe(false);
    });

    it("formats week for display as Nov 22, 2026", () => {
      const formatted = formatWeekOf(2026, 48);
      expect(formatted).toBe("Nov 22, 2026");
    });
  });
});

