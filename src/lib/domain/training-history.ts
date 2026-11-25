import type { ChallengeTemplateRecord, ChallengeTrackingFormat, TrainingResultRecord } from "@/lib/domain/types";
import { formatMetricDisplay } from "@/lib/domain/training-calculator";

/** Serializable snapshot of a player's most recent result for a drill, shown beside a new entry. */
export interface LastResultSummary {
  readonly scorePrimary: number;
  readonly scoreSecondary: number | null;
  readonly metricValue: number;
  /** "Today", "Yesterday", or a short date such as "Nov 18" (computed on the server). */
  readonly dateLabel: string;
}

/** One point on a drill's trend: the best result logged on a calendar day. */
export interface DailyBestPoint {
  readonly dayKey: string;
  readonly date: Date;
  readonly value: number;
  readonly attemptCount: number;
}

export type TrendDirection = "improved" | "declined" | "unchanged";

export interface DrillTrendSummary {
  readonly attemptCount: number;
  readonly dayCount: number;
  readonly latest: TrainingResultRecord | null;
  readonly best: number | null;
  readonly daysSinceLast: number | null;
  readonly direction: TrendDirection | null;
  /** Plain-language headline, e.g. "Up 15 percentage points since Nov 3 (65% → 80%)." */
  readonly headline: string;
}

function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole calendar days between two instants (local time), ignoring time of day. */
export function calendarDaysBetween(earlier: Date, later: Date): number {
  const a = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b - a) / 86400000);
}

export function formatShortDate(date: Date, now: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** "Today", "Yesterday", or a short date. */
export function formatRelativeDay(date: Date, now: Date = new Date()): string {
  const days = calendarDaysBetween(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return formatShortDate(date, now);
}

/** "today", "yesterday", or "9 days ago". */
export function formatDaysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function toLastResultSummary(result: TrainingResultRecord, now: Date = new Date()): LastResultSummary {
  return {
    scorePrimary: result.scorePrimary,
    scoreSecondary: result.scoreSecondary ?? null,
    metricValue: result.metricValue,
    dateLabel: formatRelativeDay(result.recordedAt, now),
  };
}

export function formatLastResultValue(
  challenge: Pick<ChallengeTemplateRecord, "trackingFormat" | "scoreUnit">,
  last: Pick<LastResultSummary, "scorePrimary" | "scoreSecondary" | "metricValue">,
): string {
  return formatMetricDisplay({
    trackingFormat: challenge.trackingFormat,
    metricValue: last.metricValue,
    scoreUnit: challenge.scoreUnit,
    scorePrimary: last.scorePrimary,
    scoreSecondary: last.scoreSecondary,
  });
}

/** Formats a metric value on its own (no shots-in/attempts breakdown), e.g. "80%", "27.8s", "25 dinks". */
export function formatMetricValue(
  challenge: Pick<ChallengeTemplateRecord, "trackingFormat" | "scoreUnit">,
  value: number,
): string {
  return formatMetricDisplay({
    trackingFormat: challenge.trackingFormat,
    metricValue: roundForDisplay(value),
    scoreUnit: challenge.scoreUnit,
  });
}

function roundForDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Collapses results into one point per calendar day (the day's best), oldest first,
 * so a day with many attempts doesn't dominate the trend.
 */
export function buildDailyBestSeries(
  results: readonly TrainingResultRecord[],
  higherIsBetter: boolean,
): DailyBestPoint[] {
  const byDay = new Map<string, { date: Date; value: number; attemptCount: number }>();
  for (const r of results) {
    const key = localDayKey(r.recordedAt);
    const existing = byDay.get(key);
    if (!existing) {
      byDay.set(key, { date: r.recordedAt, value: r.metricValue, attemptCount: 1 });
      continue;
    }
    const better = higherIsBetter ? r.metricValue > existing.value : r.metricValue < existing.value;
    byDay.set(key, {
      date: existing.date,
      value: better ? r.metricValue : existing.value,
      attemptCount: existing.attemptCount + 1,
    });
  }
  return [...byDay.entries()]
    .map(([dayKey, v]) => ({ dayKey, ...v }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

function describeChange(
  trackingFormat: ChallengeTrackingFormat,
  scoreUnit: string,
  delta: number,
  higherIsBetter: boolean,
): string {
  const magnitude = roundForDisplay(Math.abs(delta));
  if (trackingFormat === "accuracy") {
    const unit = magnitude === 1 ? "percentage point" : "percentage points";
    return `${delta > 0 ? "Up" : "Down"} ${magnitude} ${unit}`;
  }
  if (trackingFormat === "timed") {
    const faster = higherIsBetter ? delta > 0 : delta < 0;
    return `${magnitude}s ${higherIsBetter ? (faster ? "longer" : "shorter") : faster ? "faster" : "slower"}`;
  }
  const unit = trackingFormat === "wins" ? (magnitude === 1 ? "win" : "wins") : scoreUnit;
  return `${delta > 0 ? "Up" : "Down"} ${magnitude} ${unit}`;
}

/**
 * Summarizes a player's results for one drill. The trend compares the best result on the
 * first logged day with the best on the most recent day, using the drill's own metric and units.
 */
export function summarizeDrillTrend(
  results: readonly TrainingResultRecord[],
  challenge: Pick<ChallengeTemplateRecord, "trackingFormat" | "scoreUnit" | "higherIsBetter">,
  now: Date = new Date(),
): DrillTrendSummary {
  if (results.length === 0) {
    return {
      attemptCount: 0,
      dayCount: 0,
      latest: null,
      best: null,
      daysSinceLast: null,
      direction: null,
      headline: "No attempts logged yet.",
    };
  }

  const latest = results.reduce((a, b) => (b.recordedAt.getTime() >= a.recordedAt.getTime() ? b : a));
  const series = buildDailyBestSeries(results, challenge.higherIsBetter);
  const best = series.reduce(
    (acc, p) => (challenge.higherIsBetter ? Math.max(acc, p.value) : Math.min(acc, p.value)),
    series[0].value,
  );
  const daysSinceLast = Math.max(0, calendarDaysBetween(latest.recordedAt, now));
  const first = series[0];
  const last = series[series.length - 1];

  if (series.length === 1) {
    return {
      attemptCount: results.length,
      dayCount: 1,
      latest,
      best,
      daysSinceLast,
      direction: null,
      headline: `Starting point: ${formatMetricValue(challenge, first.value)} on ${formatShortDate(first.date, now)}.`,
    };
  }

  const delta = last.value - first.value;
  const range = `(${formatMetricValue(challenge, first.value)} → ${formatMetricValue(challenge, last.value)})`;
  const since = formatShortDate(first.date, now);
  let direction: TrendDirection;
  let headline: string;
  if (roundForDisplay(delta) === 0) {
    direction = "unchanged";
    headline = `Same as ${since} (${formatMetricValue(challenge, last.value)}).`;
  } else {
    const better = challenge.higherIsBetter ? delta > 0 : delta < 0;
    direction = better ? "improved" : "declined";
    headline = `${describeChange(challenge.trackingFormat, challenge.scoreUnit, delta, challenge.higherIsBetter)} since ${since} ${range}.`;
  }

  return {
    attemptCount: results.length,
    dayCount: series.length,
    latest,
    best,
    daysSinceLast,
    direction,
    headline,
  };
}

/** Converts a repository map of latest results into a serializable record for client components. */
export function toLastResultRecord(
  latest: ReadonlyMap<string, TrainingResultRecord>,
  now: Date = new Date(),
): Record<string, LastResultSummary> {
  const record: Record<string, LastResultSummary> = {};
  for (const [challengeId, result] of latest) {
    record[challengeId] = toLastResultSummary(result, now);
  }
  return record;
}

/**
 * A player's best results for one drill, best first. Ties keep the earlier attempt ahead,
 * since it reached that result first.
 */
export function rankPersonalBests(
  results: readonly TrainingResultRecord[],
  higherIsBetter: boolean,
  limit = 3,
): TrainingResultRecord[] {
  return [...results]
    .sort((a, b) => {
      if (a.metricValue !== b.metricValue) {
        return higherIsBetter ? b.metricValue - a.metricValue : a.metricValue - b.metricValue;
      }
      return a.recordedAt.getTime() - b.recordedAt.getTime();
    })
    .slice(0, limit);
}

/**
 * Splits a result into a headline value and a supporting line, like "20:04" over "4:01 /km":
 * accuracy → "80%" / "16 of 20 drops", timed → "27.8s" / "seconds", counts → "42" / "dinks".
 */
export function formatResultHeadline(
  challenge: Pick<ChallengeTemplateRecord, "trackingFormat" | "scoreUnit">,
  result: Pick<TrainingResultRecord, "scorePrimary" | "scoreSecondary" | "metricValue">,
): { readonly value: string; readonly detail: string } {
  const metric = Math.round(result.metricValue * 10) / 10;
  switch (challenge.trackingFormat) {
    case "accuracy":
      return {
        value: `${metric}%`,
        detail: result.scoreSecondary
          ? `${result.scorePrimary} of ${result.scoreSecondary} ${challenge.scoreUnit}`
          : challenge.scoreUnit,
      };
    case "timed":
      return { value: `${metric}s`, detail: "seconds" };
    case "wins":
      return { value: `${result.scorePrimary}`, detail: result.scorePrimary === 1 ? "win" : "wins" };
    default:
      return { value: `${result.scorePrimary}`, detail: challenge.scoreUnit };
  }
}
