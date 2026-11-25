import { describe, expect, it } from "vitest";
import type { TrainingResultRecord } from "@/lib/domain/types";
import {
  buildDailyBestSeries,
  calendarDaysBetween,
  formatDaysAgo,
  formatLastResultValue,
  formatRelativeDay,
  formatResultHeadline,
  rankPersonalBests,
  summarizeDrillTrend,
  toLastResultRecord,
} from "@/lib/domain/training-history";

let seq = 0;
function result(recordedAt: Date, metricValue: number, extra: Partial<TrainingResultRecord> = {}): TrainingResultRecord {
  seq += 1;
  return {
    id: `tr_${seq}`,
    challengeId: "ch_1",
    scorePrimary: metricValue,
    metricValue,
    completed: true,
    recordedAt,
    version: 1,
    ...extra,
  };
}

const now = new Date(2026, 10, 24, 18, 0);
const accuracy = { trackingFormat: "accuracy" as const, scoreUnit: "drops", higherIsBetter: true };
const timed = { trackingFormat: "timed" as const, scoreUnit: "seconds", higherIsBetter: false };
const streak = { trackingFormat: "highest_score" as const, scoreUnit: "dinks", higherIsBetter: true };

describe("training history", () => {
  it("formats relative days in calendar terms, not 24-hour blocks", () => {
    expect(calendarDaysBetween(new Date(2026, 10, 23, 23, 50), new Date(2026, 10, 24, 0, 10))).toBe(1);
    expect(formatRelativeDay(new Date(2026, 10, 24, 7), now)).toBe("Today");
    expect(formatRelativeDay(new Date(2026, 10, 23, 7), now)).toBe("Yesterday");
    expect(formatRelativeDay(new Date(2026, 10, 18, 7), now)).toBe("Nov 18");
    expect(formatRelativeDay(new Date(2025, 10, 18, 7), now)).toBe("Nov 18, 2025");
    expect(formatDaysAgo(0)).toBe("today");
    expect(formatDaysAgo(1)).toBe("yesterday");
    expect(formatDaysAgo(9)).toBe("9 days ago");
  });

  it("formats the last result with the full accuracy breakdown", () => {
    expect(formatLastResultValue(accuracy, { scorePrimary: 16, scoreSecondary: 20, metricValue: 80 })).toBe("16/20 (80%)");
    expect(formatLastResultValue(streak, { scorePrimary: 25, scoreSecondary: null, metricValue: 25 })).toBe("25 dinks");
  });

  it("keeps the best result per day, oldest day first", () => {
    const series = buildDailyBestSeries(
      [
        result(new Date(2026, 10, 20, 18), 60),
        result(new Date(2026, 10, 18, 9), 50),
        result(new Date(2026, 10, 20, 9), 75),
      ],
      true,
    );
    expect(series.map((p) => [p.dayKey, p.value, p.attemptCount])).toEqual([
      ["2026-11-18", 50, 1],
      ["2026-11-20", 75, 2],
    ]);

    const lowerIsBetter = buildDailyBestSeries(
      [result(new Date(2026, 10, 20, 9), 31), result(new Date(2026, 10, 20, 10), 28.5)],
      false,
    );
    expect(lowerIsBetter[0].value).toBe(28.5);
  });

  it("describes no data, a starting point, and a trend", () => {
    expect(summarizeDrillTrend([], accuracy, now).headline).toBe("No attempts logged yet.");

    const single = summarizeDrillTrend([result(new Date(2026, 10, 15, 9), 65)], accuracy, now);
    expect(single.headline).toBe("Starting point: 65% on Nov 15.");
    expect(single.direction).toBeNull();
    expect(single.daysSinceLast).toBe(9);

    const improved = summarizeDrillTrend(
      [result(new Date(2026, 10, 3, 9), 65), result(new Date(2026, 10, 24, 9), 80), result(new Date(2026, 10, 24, 10), 70)],
      accuracy,
      now,
    );
    expect(improved.direction).toBe("improved");
    expect(improved.headline).toBe("Up 15 percentage points since Nov 3 (65% → 80%).");
    expect(improved.attemptCount).toBe(3);
    expect(improved.dayCount).toBe(2);
    expect(improved.best).toBe(80);
    expect(improved.daysSinceLast).toBe(0);
  });

  it("treats a lower time as an improvement for timed drills", () => {
    const summary = summarizeDrillTrend(
      [result(new Date(2026, 10, 10, 9), 31), result(new Date(2026, 10, 20, 9), 27.8)],
      timed,
      now,
    );
    expect(summary.direction).toBe("improved");
    expect(summary.headline).toBe("3.2s faster since Nov 10 (31s → 27.8s).");
    expect(summary.best).toBe(27.8);
  });

  it("reports declines and unchanged results neutrally", () => {
    const declined = summarizeDrillTrend(
      [result(new Date(2026, 10, 10, 9), 30), result(new Date(2026, 10, 20, 9), 25)],
      streak,
      now,
    );
    expect(declined.direction).toBe("declined");
    expect(declined.headline).toBe("Down 5 dinks since Nov 10 (30 dinks → 25 dinks).");

    const same = summarizeDrillTrend(
      [result(new Date(2026, 10, 10, 9), 25), result(new Date(2026, 10, 20, 9), 25)],
      streak,
      now,
    );
    expect(same.direction).toBe("unchanged");
    expect(same.headline).toBe("Same as Nov 10 (25 dinks).");
  });

  it("serializes latest results with server-computed date labels", () => {
    const latest = new Map([["ch_1", result(new Date(2026, 10, 23, 9), 16, { scoreSecondary: 20 })]]);
    expect(toLastResultRecord(latest, now)).toEqual({
      ch_1: { scorePrimary: 16, scoreSecondary: 20, metricValue: 16, dateLabel: "Yesterday" },
    });
  });

  it("ranks the top results best first, with ties going to the earlier attempt", () => {
    const early = result(new Date(2026, 10, 1, 9), 40);
    const late = result(new Date(2026, 10, 9, 9), 40);
    const top = result(new Date(2026, 10, 5, 9), 45);
    const low = result(new Date(2026, 10, 6, 9), 10);
    expect(rankPersonalBests([late, low, top, early], true).map((r) => r.id)).toEqual([top.id, early.id, late.id]);
    // Lower is better for timed drills
    const fast = result(new Date(2026, 10, 2, 9), 27.8);
    const slow = result(new Date(2026, 10, 3, 9), 31);
    expect(rankPersonalBests([slow, fast], false).map((r) => r.id)).toEqual([fast.id, slow.id]);
  });

  it("splits a result into a headline value and supporting line", () => {
    expect(formatResultHeadline(accuracy, { scorePrimary: 16, scoreSecondary: 20, metricValue: 80 })).toEqual({ value: "80%", detail: "16 of 20 drops" });
    expect(formatResultHeadline(timed, { scorePrimary: 27.8, metricValue: 27.8 })).toEqual({ value: "27.8s", detail: "seconds" });
    expect(formatResultHeadline(streak, { scorePrimary: 42, metricValue: 42 })).toEqual({ value: "42", detail: "dinks" });
    expect(formatResultHeadline({ trackingFormat: "wins", scoreUnit: "games" }, { scorePrimary: 1, metricValue: 1 })).toEqual({ value: "1", detail: "win" });
  });
});
