import { describe, expect, it } from "vitest";
import { replaySynergies } from "@/lib/domain/synergy-replay";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { PlayerRecord, ReplayMatch } from "@/lib/domain/types";

const players: PlayerRecord[] = ["a", "b", "c", "d", "e", "f"].map(id => ({
  id, groupId: "g1", name: id, initialRating: 1000, rating: id === "a" ? 9000 : 1000, ratedGamesPlayed: 20, active: true, accountId: `account-${id}`,
}));
function match(id: string, time: number, overrides: Partial<ReplayMatch> = {}): ReplayMatch {
  return { id, groupId: "g1", status: "completed", completedAt: new Date(time),
    team1: ["a", "b"], team2: ["c", "d"], team1Score: 11, team2Score: 0, synergyEligible: true, ...overrides };
}

describe("Chemistry replay", () => {
  it("uses historical starting ratings rather than current roster ratings, and is idempotent", async () => {
    const repository = new InMemoryRepositories({ players, replayMatches: [match("first", 1000)] });
    await replaySynergies(repository);
    expect(await repository.getPairSynergy("account-a", "account-b")).toMatchObject({ synergyScore: 5, matchesPlayed: 1 });
    const first = structuredClone(repository.state.synergies);
    await replaySynergies(repository);
    expect(repository.state.synergies).toEqual(first);
  });

  it("replays chronological recency even when repository rows arrive out of order", async () => {
    const first = match("a", 1000);
    const later = match("b", 1000, { team1Score: 0, team2Score: 11 });
    const ordered = new InMemoryRepositories({ players, replayMatches: [first, later] });
    const reversed = new InMemoryRepositories({ players, replayMatches: [later, first] });
    await replaySynergies(ordered);
    await replaySynergies(reversed);
    expect(reversed.state.synergies).toEqual(ordered.state.synergies);
    expect(await reversed.getPairSynergy("account-a", "account-b")).toMatchObject({ matchesPlayed: 2, wins: 1 });
  });

  it("recalculates later chemistry across groups sharing an account", async () => {
    const shared = [{ ...players[0], id: "a2", groupId: "g2" }, { ...players[2], id: "c2", groupId: "g2" }];
    const earlier = match("first", 1000);
    const later = match("later", 2000, { groupId: "g2", team1: ["a2", "e"], team2: ["c2", "f"], team2Score: 5 });
    const repository = new InMemoryRepositories({ players: [...players, ...shared], replayMatches: [earlier, later] });
    await replaySynergies(repository);
    const before = (await repository.getPairSynergy("account-a", "account-e"))!;
    repository.state.replayMatches[0] = { ...earlier, team1Score: 0, team2Score: 11 };
    await replaySynergies(repository);
    const after = (await repository.getPairSynergy("account-a", "account-e"))!;
    expect(after.matchesPlayed).toBe(1);
    expect(after.contributionSum!).toBeGreaterThan(before.contributionSum!);
    expect(await repository.getPairSynergy("account-a", "account-b")).toMatchObject({ wins: 0, synergyScore: -5 });
  });

  it("skips unfinished rounds and cancelled games, retaining eligible Open Play history", async () => {
    const repository = new InMemoryRepositories({ players, replayMatches: [
      match("unfinished-normal-round", 1000, { synergyEligible: false }),
      match("cancelled", 2000, { status: "cancelled" }),
      match("open-play", 3000, { groupId: "open-group", team1: ["a", "e"], team2: ["c", "f"] }),
    ] });
    await replaySynergies(repository);
    expect(await repository.getPairSynergy("account-a", "account-b")).toBeNull();
    expect(await repository.getPairSynergy("account-a", "account-e")).toMatchObject({ matchesPlayed: 1 });
  });

  it("skips guest partnerships while retaining their registered opponents", async () => {
    const repository = new InMemoryRepositories({ players: players.map(p => p.id === "b" ? { ...p, accountId: null } : p),
      replayMatches: [match("game", 1000)] });
    await replaySynergies(repository);
    expect(repository.state.synergies).toHaveLength(1);
    expect(await repository.getPairSynergy("account-c", "account-d")).toMatchObject({ wins: 0, synergyScore: -5 });
  });
});
