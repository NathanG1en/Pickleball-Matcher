import { describe, expect, it } from "vitest";
import type { ChallengeTemplateRecord, TrainingResultRecord } from "@/lib/domain/types";
import {
  PRACTICE_SKILLS,
  computePracticeProfile,
  getPracticeProfileState,
  isScorableDrill,
  targetRatio,
} from "@/lib/domain/practice-profile";

function drill(
  id: string,
  skillCategory: ChallengeTemplateRecord["skillCategory"],
  extra: Partial<ChallengeTemplateRecord> = {},
): ChallengeTemplateRecord {
  return {
    id,
    scope: "system",
    slug: id,
    title: id,
    description: "",
    instructions: "",
    skillCategory,
    participantFormat: "individual",
    trackingFormat: "highest_score",
    scoreUnit: "reps",
    higherIsBetter: true,
    defaultTargetGoal: 20,
    isActive: true,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...extra,
  };
}

let seq = 0;
function result(challengeId: string, metricValue: number, recordedAt: Date): TrainingResultRecord {
  seq += 1;
  return { id: `r${seq}`, challengeId, scorePrimary: metricValue, metricValue, completed: true, recordedAt, version: 1 };
}

const now = new Date(2026, 10, 25, 12);
const daysAgo = (n: number) => new Date(2026, 10, 25 - n, 10);

describe("practice profile", () => {
  const challenges = [
    drill("dink_a", "dinking"),
    drill("dink_b", "dinking", { trackingFormat: "accuracy", defaultTargetGoal: 80 }),
    drill("reset_timed", "resets", { trackingFormat: "timed", higherIsBetter: false, defaultTargetGoal: 30 }),
    drill("serve_wins", "serving", { trackingFormat: "wins", defaultTargetGoal: 3 }),
    drill("volley_no_target", "volleys", { defaultTargetGoal: null }),
  ];

  it("only scores drills with a target that measure the player's own result", () => {
    expect(isScorableDrill(challenges[0])).toBe(true);
    expect(isScorableDrill(challenges[3])).toBe(false); // wins depend on the opponent
    expect(isScorableDrill(challenges[4])).toBe(false); // no target
    expect(isScorableDrill(drill("c", "strategy", { trackingFormat: "completion" }))).toBe(false);
  });

  it("compares results to the target and caps at 100%", () => {
    expect(targetRatio(10, challenges[0])).toBe(0.5);
    expect(targetRatio(40, challenges[0])).toBe(1);
    expect(targetRatio(60, challenges[2])).toBe(0.5); // timed: 60s vs 30s target
    expect(targetRatio(25, challenges[2])).toBe(1);
  });

  it("averages each drill's best recent result per skill and leaves untested skills null", () => {
    const profile = computePracticeProfile({
      challenges,
      now,
      lastPracticedAt: daysAgo(2),
      results: [
        result("dink_a", 10, daysAgo(10)),
        result("dink_a", 15, daysAgo(2)), // best: 15/20 = 0.75
        result("dink_b", 40, daysAgo(5)), // 40/80 = 0.5
        result("reset_timed", 60, daysAgo(3)), // 0.5, single attempt
        result("serve_wins", 3, daysAgo(1)), // ignored
        result("dink_a", 20, daysAgo(90)), // outside the 60-day window
      ],
    });

    expect(profile.skills.map((s) => s.key)).toEqual(PRACTICE_SKILLS.map((s) => s.key));
    const byKey = Object.fromEntries(profile.skills.map((s) => [s.key, s]));
    expect(byKey.dinking.score).toBeCloseTo(0.625);
    expect(byKey.dinking.drillsTried).toBe(2);
    expect(byKey.dinking.attempts).toBe(3);
    expect(byKey.dinking.lowConfidence).toBe(false);
    expect(byKey.resets.score).toBe(0.5);
    expect(byKey.resets.lowConfidence).toBe(true);
    expect(byKey.serving.score).toBeNull();
    expect(byKey.volleys.score).toBeNull();
    expect(profile.testedCount).toBe(2);
    expect(profile.weakest?.key).toBe("resets");
    expect(profile.daysSinceLastPractice).toBe(2);
  });

  it("returns an all-untested profile with no data", () => {
    const profile = computePracticeProfile({ challenges, results: [], now });
    expect(profile.testedCount).toBe(0);
    expect(profile.weakest).toBeNull();
    expect(profile.daysSinceLastPractice).toBeNull();
    expect(profile.skills.every((s) => s.score === null)).toBe(true);
  });

  it("tells apart never practiced, stale, unscored, and scored profiles", () => {
    expect(getPracticeProfileState({ testedCount: 0, daysSinceLastPractice: null })).toBe("never");
    expect(getPracticeProfileState({ testedCount: 0, daysSinceLastPractice: 74 })).toBe("stale");
    expect(getPracticeProfileState({ testedCount: 0, daysSinceLastPractice: 60 })).toBe("stale");
    expect(getPracticeProfileState({ testedCount: 0, daysSinceLastPractice: 59 })).toBe("unscored");
    expect(getPracticeProfileState({ testedCount: 0, daysSinceLastPractice: 2 })).toBe("unscored");
    expect(getPracticeProfileState({ testedCount: 1, daysSinceLastPractice: 2 })).toBe("scored");
  });

  it("is stale when the only scorable results fall outside the window", () => {
    const profile = computePracticeProfile({
      challenges,
      now,
      lastPracticedAt: daysAgo(74),
      results: [result("dink_a", 20, daysAgo(74))],
    });
    expect(getPracticeProfileState(profile)).toBe("stale");
  });

  it("is unscored when recent practice is only win-based drills", () => {
    const profile = computePracticeProfile({
      challenges,
      now,
      lastPracticedAt: daysAgo(1),
      results: [result("serve_wins", 3, daysAgo(1))],
    });
    expect(getPracticeProfileState(profile)).toBe("unscored");
  });
});
