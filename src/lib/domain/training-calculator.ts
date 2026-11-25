import type { ChallengeTrackingFormat } from "@/lib/domain/types";

/**
 * Calculates the canonical single numeric metric value from primary and optional secondary scores.
 */
export function calculateMetricValue(
  trackingFormat: ChallengeTrackingFormat,
  scorePrimary: number,
  scoreSecondary?: number | null,
): number {
  if (trackingFormat === "accuracy") {
    if (scoreSecondary === undefined || scoreSecondary === null || scoreSecondary <= 0) {
      return Math.max(0, Math.min(100, scorePrimary));
    }
    const ratio = Math.max(0, Math.min(1, scorePrimary / scoreSecondary));
    return Math.round(ratio * 1000) / 10; // e.g. 75.5%
  }
  return scorePrimary;
}

/**
 * Determines whether candidateMetric represents an improvement over baselineMetric.
 */
export function isBetterMetric(
  candidateMetric: number,
  baselineMetric: number,
  higherIsBetter: boolean = true,
): boolean {
  if (higherIsBetter) {
    return candidateMetric > baselineMetric;
  }
  return candidateMetric < baselineMetric;
}

/**
 * Formats a metric for user display based on its tracking format and units.
 */
export function formatMetricDisplay({
  trackingFormat,
  metricValue,
  scoreUnit,
  scorePrimary,
  scoreSecondary,
}: {
  trackingFormat: ChallengeTrackingFormat;
  metricValue: number;
  scoreUnit: string;
  scorePrimary?: number | null;
  scoreSecondary?: number | null;
}): string {
  if (trackingFormat === "accuracy") {
    if (scorePrimary !== undefined && scorePrimary !== null && scoreSecondary) {
      return `${scorePrimary}/${scoreSecondary} (${metricValue}%)`;
    }
    return `${metricValue}%`;
  }
  if (trackingFormat === "timed") {
    return `${metricValue}s`;
  }
  if (trackingFormat === "wins") {
    return `${scorePrimary ?? metricValue} ${metricValue === 1 ? "win" : "wins"}`;
  }
  return `${scorePrimary ?? metricValue} ${scoreUnit}`;
}

/**
 * Calculates improvement and participation points for gamified progress.
 * Focuses on consistency and personal improvement rather than raw skill ratings.
 */
export function calculateAttemptPoints({
  isPersonalBest,
  metTargetBenchmark,
  isFirstAttemptToday,
}: {
  isPersonalBest: boolean;
  metTargetBenchmark: boolean;
  isFirstAttemptToday: boolean;
}): number {
  let points = 10; // Base participation XP
  if (isFirstAttemptToday) {
    points += 5; // Daily consistency bonus
  }
  if (metTargetBenchmark) {
    points += 15; // Hit target benchmark bonus
  }
  if (isPersonalBest) {
    points += 25; // PB smash bonus
  }
  return points;
}

/**
 * Calculates the Sunday date starting the week for a given (year, weekNumber).
 */
export function getSundayFromYearWeek(year: number, weekNumber: number): Date {
  const targetDate = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const sunday = new Date(targetDate);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return sunday;
}

/**
 * Returns the [start, end) instant range covered by a Sunday-start training week.
 * Use this instead of database week functions (which use Monday-start ISO weeks)
 * so stored results line up with the weeks shown in the app.
 */
export function getWeekRange(year: number, weekNumber: number): { start: Date; end: Date } {
  const start = getSundayFromYearWeek(year, weekNumber);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/**
 * Calculates (year, weekNumber) from a date.
 */
export function getWeekNumberFromDate(d: Date = new Date()): { year: number; weekNumber: number } {
  const date = new Date(d);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  // Whole calendar days since Jan 1 (UTC math avoids DST and time-of-day drift;
  // a fractional day would push Saturdays into the following week).
  const pastDaysOfYear = Math.round(
    (Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 1)) / 86400000,
  );
  const weekNumber = Math.floor((pastDaysOfYear + startOfYear.getDay()) / 7) + 1;
  return { year, weekNumber };
}

/**
 * Formats a week for user display as "Nov 22, 2026" or "Nov 22".
 */
export function formatWeekOf(year: number, weekNumber: number, includeYear = true): string {
  const sunday = getSundayFromYearWeek(year, weekNumber);
  const monthName = sunday.toLocaleDateString("en-US", { month: "short" });
  const day = sunday.getDate();
  const currentYear = new Date().getFullYear();
  if (includeYear || year !== currentYear) {
    return `${monthName} ${day}, ${sunday.getFullYear()}`;
  }
  return `${monthName} ${day}`;
}

