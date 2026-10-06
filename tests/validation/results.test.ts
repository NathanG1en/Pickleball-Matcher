import { describe, expect, it } from "vitest";

import { recordResultSchema } from "@/lib/validation/results";

describe("recordResultSchema", () => {
  it.each([
    { input: { matchId: "match-1", team1Score: 11, team2Score: 11 }, label: "tied" },
    { input: { matchId: "match-1", team1Score: -1, team2Score: 11 }, label: "negative" },
    { input: { matchId: "match-1", team1Score: 11.5, team2Score: 9 }, label: "fractional" },
    { input: { matchId: "match-1", team1Score: 11 }, label: "missing" },
    { input: { matchId: "match-1", team1Score: 100, team2Score: 98 }, label: "excessive" },
  ])("rejects a $label score", ({ input }) => {
    expect(recordResultSchema.safeParse(input).success).toBe(false);
  });

  it("accepts ordinary non-tied non-negative integer scores", () => {
    expect(
      recordResultSchema.parse({
        matchId: "match-1",
        team1Score: "11",
        team2Score: "7",
      }),
    ).toEqual({ matchId: "match-1", team1Score: 11, team2Score: 7 });
  });

  it("does not turn a missing form value into zero", () => {
    expect(
      recordResultSchema.safeParse({
        matchId: "match-1",
        team1Score: "",
        team2Score: "11",
      }).success,
    ).toBe(false);
  });
});
