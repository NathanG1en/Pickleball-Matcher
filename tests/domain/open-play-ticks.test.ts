import { describe, expect, it } from "vitest";
import { RATING_TICKS } from "@/app/g/[groupId]/sessions/[sessionId]/open-play-manager-client";

describe("Open Play Guest Rating Slider Ticks", () => {
  it("contains exactly 17 steps from 2.0 to 6.0 in 0.25 increments", () => {
    expect(RATING_TICKS).toHaveLength(17);
    expect(RATING_TICKS[0].value).toBe(2.0);
    expect(RATING_TICKS[RATING_TICKS.length - 1].value).toBe(6.0);

    const values = RATING_TICKS.map((t) => t.value);
    const expected = [
      2.0, 2.25, 2.5, 2.75,
      3.0, 3.25, 3.5, 3.75,
      4.0, 4.25, 4.5, 4.75,
      5.0, 5.25, 5.5, 5.75,
      6.0,
    ];
    expect(values).toEqual(expected);
  });

  it("assigns major tick type (larger ticks) to whole numbers: 2, 3, 4, 5, 6", () => {
    const majorTicks = RATING_TICKS.filter((t) => t.type === "major");
    expect(majorTicks.map((t) => t.value)).toEqual([2.0, 3.0, 4.0, 5.0, 6.0]);
  });

  it("assigns medium tick type (slightly larger ticks) to half values: 2.5, 3.5, 4.5, 5.5", () => {
    const mediumTicks = RATING_TICKS.filter((t) => t.type === "medium");
    expect(mediumTicks.map((t) => t.value)).toEqual([2.5, 3.5, 4.5, 5.5]);
  });

  it("assigns minor tick type (smallest ticks) to .25 and .75 values", () => {
    const minorTicks = RATING_TICKS.filter((t) => t.type === "minor");
    expect(minorTicks.map((t) => t.value)).toEqual([
      2.25, 2.75,
      3.25, 3.75,
      4.25, 4.75,
      5.25, 5.75,
    ]);
  });

  it("calculates exact percentage positions across 2-6 range", () => {
    expect(RATING_TICKS.find((t) => t.value === 2.0)?.percent).toBe(0);
    expect(RATING_TICKS.find((t) => t.value === 3.0)?.percent).toBe(25);
    expect(RATING_TICKS.find((t) => t.value === 4.0)?.percent).toBe(50);
    expect(RATING_TICKS.find((t) => t.value === 5.0)?.percent).toBe(75);
    expect(RATING_TICKS.find((t) => t.value === 6.0)?.percent).toBe(100);
    expect(RATING_TICKS.find((t) => t.value === 3.5)?.percent).toBe(37.5);
  });

  it("maps ratings to appropriate skill tier names and descriptions", async () => {
    const { getSkillTier } = await import("@/lib/domain/rating-display");
    expect(getSkillTier(2.0).name).toBe("Beginner");
    expect(getSkillTier(3.0).name).toBe("Intermediate");
    expect(getSkillTier(3.5).name).toBe("Advanced Intermediate");
    expect(getSkillTier(4.0).name).toBe("Competitive");
    expect(getSkillTier(5.0).name).toBe("Expert");
    expect(getSkillTier(6.0).name).toBe("World-Class Professional");
  });
});

