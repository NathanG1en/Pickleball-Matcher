import { describe, expect, it } from "vitest";
import { getCourtRebalanceChoices } from "@/lib/matchmaking/court-rebalance";

describe("getCourtRebalanceChoices", () => {
  it("returns empty array when fewer than 2 players are present", () => {
    expect(getCourtRebalanceChoices(0)).toEqual([]);
    expect(getCourtRebalanceChoices(1)).toEqual([]);
  });

  it("handles 4 players with a single doubles court choice", () => {
    const choices = getCourtRebalanceChoices(4, 2);
    expect(choices.length).toBe(1);
    expect(choices[0]?.courtCount).toBe(1);
    expect(choices[0]?.courts).toEqual([4]);
    expect(choices[0]?.sitting).toBe(0);
  });

  it("handles 5 players with 1 court (rotate) vs 2 courts (cutthroat + singles)", () => {
    const choices = getCourtRebalanceChoices(5, 2);
    expect(choices.length).toBe(2);

    // Choice 1: 1 court of 4, 1 sitting
    expect(choices[0]?.courtCount).toBe(1);
    expect(choices[0]?.courts).toEqual([4]);
    expect(choices[0]?.sitting).toBe(1);

    // Choice 2: 2 courts (3 + 2), 0 sitting
    expect(choices[1]?.courtCount).toBe(2);
    expect(choices[1]?.courts).toEqual([3, 2]);
    expect(choices[1]?.sitting).toBe(0);
  });

  it("handles 6 players with 1 court (2 rotate) vs 2 courts (doubles + singles)", () => {
    const choices = getCourtRebalanceChoices(6, 2);
    expect(choices.length).toBe(2);

    // Choice 1: 1 court of 4, 2 sitting
    expect(choices[0]?.courtCount).toBe(1);
    expect(choices[0]?.courts).toEqual([4]);
    expect(choices[0]?.sitting).toBe(2);

    // Choice 2: 2 courts (4 + 2), 0 sitting
    expect(choices[1]?.courtCount).toBe(2);
    expect(choices[1]?.courts).toEqual([4, 2]);
    expect(choices[1]?.sitting).toBe(0);
  });

  it("handles 7 players with 1 court (rotate) vs 2 courts (doubles + cutthroat)", () => {
    const choices = getCourtRebalanceChoices(7, 2);
    expect(choices.length).toBe(2);

    // Choice 1: 1 court of 4, 3 sitting
    expect(choices[0]?.courtCount).toBe(1);
    expect(choices[0]?.courts).toEqual([4]);
    expect(choices[0]?.sitting).toBe(3);

    // Choice 2: 2 courts (4 + 3), 0 sitting
    expect(choices[1]?.courtCount).toBe(2);
    expect(choices[1]?.courts).toEqual([4, 3]);
    expect(choices[1]?.sitting).toBe(0);
  });

  it("handles 8 players with 2 full doubles courts (0 sitting)", () => {
    const choices = getCourtRebalanceChoices(8, 2);
    expect(choices.length).toBe(1);
    expect(choices[0]?.courtCount).toBe(2);
    expect(choices[0]?.courts).toEqual([4, 4]);
    expect(choices[0]?.sitting).toBe(0);
  });

  it("handles 2 players (singles)", () => {
    const choices = getCourtRebalanceChoices(2, 1);
    expect(choices.length).toBe(1);
    expect(choices[0]?.courtCount).toBe(1);
    expect(choices[0]?.courts).toEqual([2]);
    expect(choices[0]?.sitting).toBe(0);
  });

  it("handles 3 players (cutthroat)", () => {
    const choices = getCourtRebalanceChoices(3, 1);
    expect(choices.length).toBe(1);
    expect(choices[0]?.courtCount).toBe(1);
    expect(choices[0]?.courts).toEqual([3]);
    expect(choices[0]?.sitting).toBe(0);
  });
});

