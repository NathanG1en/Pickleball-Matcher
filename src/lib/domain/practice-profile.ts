import type { ChallengeSkillCategory, ChallengeTemplateRecord, TrainingResultRecord } from "@/lib/domain/types";
import { calendarDaysBetween } from "@/lib/domain/training-history";

/** Skills shown on the practice profile, in hexagon order (soft-game skills sit next to each other). */
export const PRACTICE_SKILLS: readonly { readonly key: ChallengeSkillCategory; readonly label: string }[] = [
  { key: "dinking", label: "Dinking" },
  { key: "third_shot", label: "Third Shot" },
  { key: "resets", label: "Resets" },
  { key: "volleys", label: "Volleys" },
  { key: "serving", label: "Serving" },
  { key: "strategy", label: "Strategy" },
];

export const PRACTICE_PROFILE_WINDOW_DAYS = 60;

export interface PracticeSkillScore {
  readonly key: ChallengeSkillCategory;
  readonly label: string;
  /** 0–1: average of (best recent result ÷ drill target), each capped at the target. Null when untested. */
  readonly score: number | null;
  readonly drillsTried: number;
  readonly attempts: number;
  /** True when the score rests on a single attempt. */
  readonly lowConfidence: boolean;
}

export interface PracticeProfile {
  readonly skills: readonly PracticeSkillScore[];
  readonly testedCount: number;
  /** Lowest-scoring tested skill, suggested as the next focus. */
  readonly weakest: PracticeSkillScore | null;
  readonly daysSinceLastPractice: number | null;
}

/** True when a drill's result can be compared against its target as a measure of the player's own skill. */
export function isScorableDrill(challenge: Pick<ChallengeTemplateRecord, "trackingFormat" | "defaultTargetGoal">): boolean {
  // Wins depend on the opponent and completion is binary, so neither measures the player's skill.
  if (challenge.trackingFormat === "wins" || challenge.trackingFormat === "completion") return false;
  return typeof challenge.defaultTargetGoal === "number" && challenge.defaultTargetGoal > 0;
}

/** How close a result is to the drill's target, from 0 to 1 (capped at the target). */
export function targetRatio(
  value: number,
  challenge: Pick<ChallengeTemplateRecord, "higherIsBetter" | "defaultTargetGoal">,
): number {
  const target = challenge.defaultTargetGoal ?? 0;
  if (target <= 0) return 0;
  const ratio = challenge.higherIsBetter ? value / target : value > 0 ? target / value : 0;
  return Math.max(0, Math.min(1, ratio));
}

/**
 * Scores each skill by comparing the player's best result on each drill within the window to
 * that drill's target. Skills with no scorable attempts are untested (null), never zero.
 */
export function computePracticeProfile({
  results,
  challenges,
  lastPracticedAt = null,
  now = new Date(),
  windowDays = PRACTICE_PROFILE_WINDOW_DAYS,
}: {
  readonly results: readonly TrainingResultRecord[];
  readonly challenges: readonly ChallengeTemplateRecord[];
  /** Most recent result of any kind, for the "last practiced" line (may be older than the window). */
  readonly lastPracticedAt?: Date | null;
  readonly now?: Date;
  readonly windowDays?: number;
}): PracticeProfile {
  const challengeById = new Map(challenges.map((c) => [c.id, c]));
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - (windowDays - 1));

  const perDrill = new Map<string, { challenge: ChallengeTemplateRecord; best: number; attempts: number }>();
  for (const r of results) {
    if (r.recordedAt < windowStart) continue;
    const challenge = challengeById.get(r.challengeId);
    if (!challenge || !isScorableDrill(challenge)) continue;
    const existing = perDrill.get(challenge.id);
    if (!existing) {
      perDrill.set(challenge.id, { challenge, best: r.metricValue, attempts: 1 });
      continue;
    }
    const better = challenge.higherIsBetter ? r.metricValue > existing.best : r.metricValue < existing.best;
    perDrill.set(challenge.id, {
      challenge,
      best: better ? r.metricValue : existing.best,
      attempts: existing.attempts + 1,
    });
  }

  const skills: PracticeSkillScore[] = PRACTICE_SKILLS.map(({ key, label }) => {
    const drills = [...perDrill.values()].filter((d) => d.challenge.skillCategory === key);
    if (drills.length === 0) {
      return { key, label, score: null, drillsTried: 0, attempts: 0, lowConfidence: false };
    }
    const score = drills.reduce((sum, d) => sum + targetRatio(d.best, d.challenge), 0) / drills.length;
    const attempts = drills.reduce((sum, d) => sum + d.attempts, 0);
    return { key, label, score, drillsTried: drills.length, attempts, lowConfidence: attempts === 1 };
  });

  const tested = skills.filter((s) => s.score !== null);
  const weakest = tested.length > 0
    ? tested.reduce((low, s) => ((s.score ?? 1) < (low.score ?? 1) ? s : low))
    : null;

  return {
    skills,
    testedCount: tested.length,
    weakest,
    daysSinceLastPractice: lastPracticedAt ? Math.max(0, calendarDaysBetween(lastPracticedAt, now)) : null,
  };
}

/** Percent of target for display, e.g. 0.724 → 72. */
export function toPercentOfTarget(score: number): number {
  return Math.round(score * 100);
}
