export type Interval = { startMs: number; endMs: number };

/** Union only: parallel/nested spans must not be added as disjoint elapsed time. */
export function intervalUnionMs(intervals: Interval[], start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("Invalid clipping interval");
  const clipped = intervals.map(interval => {
    if (!Number.isFinite(interval.startMs) || !Number.isFinite(interval.endMs) || interval.endMs < interval.startMs) throw new Error("Incomplete or reversed interval");
    return { startMs: Math.max(start, interval.startMs), endMs: Math.min(end, interval.endMs) };
  }).filter(interval => interval.endMs > interval.startMs).sort((a, b) => a.startMs - b.startMs);
  let total = 0;
  let previousEnd = start;
  for (const interval of clipped) {
    total += Math.max(0, interval.endMs - Math.max(previousEnd, interval.startMs));
    previousEnd = Math.max(previousEnd, interval.endMs);
  }
  return total;
}

export function summarizeSamples(values: number[]) {
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error("All observations must have finite nonnegative timings");
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const medianMs = ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  return { count: ordered.length, medianMs, minMs: ordered[0], maxMs: ordered.at(-1)!, maxToMedian: ordered.at(-1)! / medianMs };
}

export function compareSamples(best: number[], candidate: number[]) {
  const before = summarizeSamples(best);
  const after = summarizeSamples(candidate);
  const savedMs = before.medianMs - after.medianMs;
  const improvementPercent = savedMs / before.medianMs * 100;
  const overlap = after.minMs <= before.maxMs && before.minMs <= after.maxMs;
  const conclusion = Math.abs(improvementPercent) < 5 || overlap ? "INCONCLUSIVE" : improvementPercent > 0 ? "IMPROVEMENT" : "REGRESSION";
  return { before, after, savedMs, improvementPercent, overlap, conclusion };
}
