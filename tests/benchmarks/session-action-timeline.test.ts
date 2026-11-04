import { describe, expect, it } from "vitest";
import { intervalUnionMs, compareSamples, summarizeSamples } from "../../scripts/benchmarks/session-actions/timeline";

describe("session action timing analysis", () => {
  it("counts overlapping and nested query intervals once and clips at the DOM boundary", () => {
    expect(intervalUnionMs([{ startMs: 10, endMs: 60 }, { startMs: 20, endMs: 40 }, { startMs: 50, endMs: 100 }, { startMs: 120, endMs: 200 }], 0, 150)).toBe(120);
    expect(intervalUnionMs([{ startMs: 10, endMs: 60 }], 20, 40)).toBe(20);
    expect(intervalUnionMs([], 0, 100)).toBe(0);
  });

  it("does not infer an improvement from overlapping ranges or a difference below five percent", () => {
    expect(compareSamples([100, 110], [90, 105]).conclusion).toBe("INCONCLUSIVE");
    expect(compareSamples([100, 101], [97, 98]).conclusion).toBe("INCONCLUSIVE");
    expect(compareSamples([100, 110], [80, 90]).conclusion).toBe("IMPROVEMENT");
    expect(compareSamples([100, 110], [120, 130]).conclusion).toBe("REGRESSION");
  });

  it("retains every observation and calculates the even-sample median and sample maximum ratio", () => {
    const samples = [1597, 1138, 1174, 1190, 1210, 1201, 1188, 1275, 1225, 1300];
    const original = [...samples];
    expect(summarizeSamples(samples)).toEqual({ count: 10, medianMs: 1205.5, minMs: 1138, maxMs: 1597, maxToMedian: 1597 / 1205.5 });
    expect(samples).toEqual(original);
  });

  it("rejects missing, non-finite or negative timings instead of silently excluding them", () => {
    expect(() => summarizeSamples([])).toThrow();
    expect(() => summarizeSamples([1, NaN])).toThrow();
    expect(() => summarizeSamples([-1, 2])).toThrow();
    expect(() => intervalUnionMs([{ startMs: 2, endMs: 1 }], 0, 10)).toThrow();
  });
});
