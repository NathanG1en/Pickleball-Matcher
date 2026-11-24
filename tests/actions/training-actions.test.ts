import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  recordTrainingResultAction,
  publishWeeklyPlanAction,
  savePersonalWeeklyPlanAction,
  addDrillToPersonalPlanAction,
  addDrillToGroupPlanAction,
} from "@/app/actions/training";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { setActionRepository } from "@/app/actions/action-context";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock player auth cookies
vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActivePlayerAccountId: vi.fn(async () => "acc-1"),
    requireOrganizer: vi.fn(async (groupId: string) => {
      if (groupId === "group-unauthorized") {
        throw new Error("Unauthorized");
      }
      return null;
    }),
  };
});

describe("Training Server Actions", () => {
  let repository: InMemoryRepositories;

  beforeEach(() => {
    repository = new InMemoryRepositories({
      groups: [
        {
          id: "group-1",
          name: "Tuesday Picklers",
          organizerPinHash: "hash",
          createdAt: new Date(),
        },
      ],
      playerAccounts: [
        {
          id: "acc-1",
          username: "dinker",
          name: "Dan Dinker",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      players: [
        {
          id: "p1",
          groupId: "group-1",
          name: "Dan Dinker",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
          accountId: "acc-1",
        },
        {
          id: "p2",
          groupId: "group-1",
          name: "Sally Softgame",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
          accountId: "acc-2",
        },
      ],
      challengeTemplates: [
        {
          id: "ch_wall_streak",
          scope: "system",
          title: "Wall Dink Streak",
          slug: "wall-dink-streak",
          description: "Wall practice",
          instructions: "Hit against wall",
          skillCategory: "dinking",
          participantFormat: "individual",
          trackingFormat: "highest_score",
          scoreUnit: "dinks",
          higherIsBetter: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "ch_drop_accuracy",
          scope: "system",
          title: "Drop Target Test",
          slug: "drop-target-test",
          description: "Hit 20 drops",
          instructions: "Drop test",
          skillCategory: "third_shot",
          participantFormat: "partner",
          trackingFormat: "accuracy",
          scoreUnit: "drops",
          higherIsBetter: true,
          defaultTargetGoal: 70,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "ch_seven_shot",
          scope: "system",
          title: "Seven-Shot Patience",
          slug: "seven-shot-patience",
          description: "Group drill",
          instructions: "Play 7 shots",
          skillCategory: "strategy",
          participantFormat: "group",
          trackingFormat: "completion",
          scoreUnit: "rallies",
          higherIsBetter: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);
  });

  it("records a solo individual attempt and sets personal best", async () => {
    const res = await recordTrainingResultAction({
      challengeId: "ch_wall_streak",
      scorePrimary: 35,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.metricValue).toBe(35);
      expect(res.data.isPersonalBest).toBe(true);
      expect(res.data.pointsEarned).toBeGreaterThanOrEqual(10);
    }

    const pbs = await repository.getPlayerPersonalBests("acc-1");
    expect(pbs.get("ch_wall_streak")).toBe(35);
  });

  it("records accuracy attempt and calculates percentage", async () => {
    const res = await recordTrainingResultAction({
      challengeId: "ch_drop_accuracy",
      scorePrimary: 16,
      scoreSecondary: 20,
      groupId: "group-1",
      participantPlayerIds: ["p2"],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.metricValue).toBe(80); // 16/20 = 80%
      expect(res.data.isPersonalBest).toBe(true);
    }

    // Verify exactly 1 result row was created, with 2 participant entries
    expect(repository.state.trainingResults).toHaveLength(1);
    expect(repository.state.trainingParticipants).toHaveLength(2);
    expect(repository.state.trainingParticipants.some((p) => p.playerId === "p2")).toBe(true);
  });

  it("updates personal best only when a higher score is achieved", async () => {
    // Attempt 1: 40 streak
    await recordTrainingResultAction({
      challengeId: "ch_wall_streak",
      scorePrimary: 40,
    });

    // Attempt 2: 25 streak (lower, not a PB)
    const lowerRes = await recordTrainingResultAction({
      challengeId: "ch_wall_streak",
      scorePrimary: 25,
    });
    expect(lowerRes.ok).toBe(true);
    if (lowerRes.ok) {
      expect(lowerRes.data.isPersonalBest).toBe(false);
    }

    // Attempt 3: 55 streak (higher, is a PB)
    const higherRes = await recordTrainingResultAction({
      challengeId: "ch_wall_streak",
      scorePrimary: 55,
    });
    expect(higherRes.ok).toBe(true);
    if (higherRes.ok) {
      expect(higherRes.data.isPersonalBest).toBe(true);
    }

    const pbs = await repository.getPlayerPersonalBests("acc-1");
    expect(pbs.get("ch_wall_streak")).toBe(55);
  });

  it("allows organizers to publish a weekly training plan with group and partner drills", async () => {
    const res = await publishWeeklyPlanAction({
      groupId: "group-1",
      year: 2026,
      weekNumber: 47,
      title: "Week 47 Focus",
      focusNotes: "Keep paddle high",
      challengeIds: ["ch_seven_shot", "ch_drop_accuracy"],
    });

    expect(res.ok).toBe(true);
    const planData = await repository.getWeeklyTrainingPlan("group-1", 2026, 47);
    expect(planData).not.toBeNull();
    expect(planData?.plan.title).toBe("Week 47 Focus");
    expect(planData?.items).toHaveLength(2);
  });

  it("rejects group weekly plan if an individual drill is included", async () => {
    const res = await publishWeeklyPlanAction({
      groupId: "group-1",
      year: 2026,
      weekNumber: 47,
      title: "Week 47 Focus",
      challengeIds: ["ch_wall_streak"],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Individual drills cannot be added to a group plan.");
    }
  });

  it("rejects weekly plan creation if user is not organizer", async () => {
    const res = await publishWeeklyPlanAction({
      groupId: "group-unauthorized",
      year: 2026,
      weekNumber: 47,
      title: "Unauthorized Plan",
      challengeIds: ["ch_seven_shot"],
    });

    expect(res.ok).toBe(false);
  });

  it("allows players to construct and update their personal weekly training plan", async () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
    const currentWeekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

    const res = await savePersonalWeeklyPlanAction({
      year: now.getFullYear(),
      weekNumber: currentWeekNumber,
      title: "My Personal Drop & Dink Goals",
      focusNotes: "Stay relaxed on resets",
      challengeIds: ["ch_wall_streak", "ch_drop_accuracy"],
      customGoals: { ch_drop_accuracy: "Hit 15/20 drops" },
    });

    expect(res.ok).toBe(true);
    const planData = await repository.getPersonalWeeklyTrainingPlan("acc-1", now.getFullYear(), currentWeekNumber);
    expect(planData).not.toBeNull();
    expect(planData?.plan.title).toBe("My Personal Drop & Dink Goals");
    expect(planData?.items).toHaveLength(2);
    expect(planData?.items[1].customGoalDescription).toBe("Hit 15/20 drops");

    // Record an attempt for one of the challenges in the plan
    await recordTrainingResultAction({
      challengeId: "ch_wall_streak",
      scorePrimary: 30,
    });

    const completedResults = await repository.listTrainingResultsForPersonalPlan(planData!.plan.id);
    expect(completedResults).toHaveLength(1);
    expect(completedResults[0].challengeId).toBe("ch_wall_streak");
  });

  it("rejects personal weekly plan if a group drill is included", async () => {
    const res = await savePersonalWeeklyPlanAction({
      year: 2026,
      weekNumber: 48,
      title: "Invalid Personal Plan",
      challengeIds: ["ch_seven_shot"],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Group drills cannot be added to an individual plan.");
    }
  });

  it("allows adding a drill from the library directly into a personal plan and rejects group drills", async () => {
    // Adding a group drill to a personal plan is rejected
    const groupRes = await addDrillToPersonalPlanAction("ch_seven_shot");
    expect(groupRes.ok).toBe(false);
    if (!groupRes.ok) {
      expect(groupRes.error).toBe("Group drills cannot be added to an individual plan.");
    }

    // Add individual drill when no plan exists yet (creates plan with drill)
    const res1 = await addDrillToPersonalPlanAction("ch_wall_streak");
    expect(res1.ok).toBe(true);

    // Add another partner drill from the library
    const res2 = await addDrillToPersonalPlanAction("ch_drop_accuracy");
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.data.alreadyPresent).toBe(false);
    }

    // Adding same drill again indicates alreadyPresent: true
    const res3 = await addDrillToPersonalPlanAction("ch_drop_accuracy");
    expect(res3.ok).toBe(true);
    if (res3.ok) {
      expect(res3.data.alreadyPresent).toBe(true);
    }
  });

  it("allows organizers to add group and partner drills to a group weekly plan and rejects individual drills", async () => {
    // Adding an individual drill to a group plan is rejected
    const indivRes = await addDrillToGroupPlanAction("group-1", "ch_wall_streak");
    expect(indivRes.ok).toBe(false);
    if (!indivRes.ok) {
      expect(indivRes.error).toBe("Individual drills cannot be added to a group plan.");
    }

    // Adding group drill succeeds
    const res1 = await addDrillToGroupPlanAction("group-1", "ch_seven_shot");
    expect(res1.ok).toBe(true);

    // Adding partner drill succeeds
    const res2 = await addDrillToGroupPlanAction("group-1", "ch_drop_accuracy");
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.data.alreadyPresent).toBe(false);
    }
  });
});

