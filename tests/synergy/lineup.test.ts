import { describe, expect, it } from "vitest";
import { buildCourtSynergies, buildPairSynergies } from "@/lib/synergy/lineup";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

const history = [
  { accountId1: "a", accountId2: "b", matchesPlayed: 1, wins: 1, synergyScore: 67, updatedAt: new Date() },
  { accountId1: "a", accountId2: "c", matchesPlayed: 3, wins: 1, synergyScore: 40, updatedAt: new Date() },
];
const accounts = { p1: "a", p2: "b", p3: "c", guest: null };

describe("lineup synergy", () => {
  it("selects partnership history by account identity rather than court or slot", () => {
    const pairs = buildPairSynergies(history);
    const before = buildCourtSynergies([{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "guest"] }], accounts, pairs);
    expect(before[1]?.team1).toMatchObject({ score: 67, matchesPlayed: 1 });
    const after = buildCourtSynergies([{ courtNumber: 2, team1: ["p3", "p1"], team2: ["p2", "guest"] }], accounts, pairs);
    expect(after[2]?.team1).toMatchObject({ score: 40, matchesPlayed: 3 });
    expect(after[2]?.team2?.status).toBe("guest_ineligible");
    const reversed = buildCourtSynergies([{ courtNumber: 3, team1: ["p3"], team2: ["p2", "p1"] }], accounts, pairs);
    expect(reversed[3]?.team2).toMatchObject({ score: 67, matchesPlayed: 1 });
    expect(reversed[3]?.team1?.status).toBe("solo");
  });

  it("shows new duo only for a registered pair without recorded games", () => {
    const current = buildCourtSynergies([{ courtNumber: 1, team1: ["p2", "p3"], team2: ["p1", "guest"] }], accounts, buildPairSynergies(history));
    expect(current[1]?.team1?.status).toBe("new_duo");
    expect(current[1]?.team2?.status).toBe("guest_ineligible");
  });

  it("loads only history whose two accounts belong to the roster", async () => {
    const repo = new InMemoryRepositories({ synergies: history });
    expect(await repo.listPairSynergies(["b", "a", "b"])).toEqual([history[0]]);
    expect(await repo.listPairSynergies([])).toEqual([]);
  });
});
