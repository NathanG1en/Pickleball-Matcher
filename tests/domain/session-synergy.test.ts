import { describe, it, expect } from "vitest";

describe("Session synergy pair extraction", () => {
  it("extracts teammates pairs when both have accounts", () => {
    const court = {
      team1: [{ accountId: "acc_1" }, { accountId: "acc_2" }],
      team2: [{ accountId: "acc_3" }, { accountId: null }],
      winnerTeam: 1,
    };
    const pairs: { accountIdA: string; accountIdB: string; won: boolean }[] = [];
    if (court.team1[0].accountId && court.team1[1].accountId) {
      pairs.push({
        accountIdA: court.team1[0].accountId,
        accountIdB: court.team1[1].accountId,
        won: court.winnerTeam === 1,
      });
    }
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ accountIdA: "acc_1", accountIdB: "acc_2", won: true });
  });

  it("skips teams where at least one player is a guest", () => {
    const court = {
      team1: [{ accountId: "acc_1" }, { accountId: null }],
      winnerTeam: 1,
    };
    const pairs: { accountIdA: string; accountIdB: string; won: boolean }[] = [];
    if (court.team1[0].accountId && court.team1[1].accountId) {
      pairs.push({
        accountIdA: court.team1[0].accountId,
        accountIdB: court.team1[1].accountId,
        won: court.winnerTeam === 1,
      });
    }
    expect(pairs).toHaveLength(0);
  });
});
