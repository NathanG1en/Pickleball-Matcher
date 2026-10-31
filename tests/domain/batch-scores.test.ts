import { describe, expect, it } from "vitest";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { SessionService } from "@/lib/domain/session-service";
import { batchNow, seedBatchScores } from "../fixtures/batch-scores";

const serviceFor = (repository: InMemoryRepositories) => new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });

describe("batch score saving", () => {
  it("rejects duplicate IDs without changing scores, versions, or ratings", async () => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    const before = structuredClone(repository.state);
    await expect(serviceFor(repository).recordMultipleResults([inputs[0], { ...inputs[0], team2Score: 9 }])).rejects.toThrow();
    expect(repository.state).toEqual(before);
  });

  it("rejects a stale entry without saving the other courts", async () => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    repository.state.matches[1].version = 2;
    const before = structuredClone(repository.state);
    await expect(serviceFor(repository).recordMultipleResults(inputs)).rejects.toThrow(/changed|refresh/i);
    expect(repository.state).toEqual(before);
  });

  it("saves out-of-order courts in request order and applies each rating once", async () => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    const results = await serviceFor(repository).recordMultipleResults([...inputs].reverse());
    expect(results.map(match => match.id)).toEqual(["batch-match-3", "batch-match-2", "batch-match-1", "batch-match-0"]);
    expect(results.every(match => match.status === "completed" && match.version === 2)).toBe(true);
    expect(repository.state.players.find(player => player.id === "batch-player-0")).toMatchObject({ rating: 1020, ratedGamesPlayed: 1 });
    expect(repository.state.players.find(player => player.id === "batch-player-2")).toMatchObject({ rating: 980, ratedGamesPlayed: 1 });
  });

  it("rolls the entire batch back when one match is missing", async () => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    const before = structuredClone(repository.state);
    await expect(serviceFor(repository).recordMultipleResults([inputs[0], { ...inputs[1], matchId: "missing" }])).rejects.toThrow();
    expect(repository.state).toEqual(before);
  });

  it("keeps original completion times and rebuilds historical chemistry without duplicate games", async () => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    const service = serviceFor(repository);
    await service.recordMultipleResults(inputs);
    await service.completeRound("batch-round");
    expect(await repository.getPairSynergy("batch-account-0", "batch-account-1")).toMatchObject({ matchesPlayed: 1, wins: 1 });
    const later = new SessionService(repository, { now: () => new Date("2026-11-02T12:00:00Z"), nextId: kind => kind, nextSeed: () => 1 });
    const results = await later.recordMultipleResults(inputs.map((input, i) => ({ ...input, team1Score: i === 0 ? 0 : 11, team2Score: i === 0 ? 11 : 7, matchVersion: 2 })));
    expect(results.every(match => match.completedAt?.getTime() === batchNow.getTime() && match.version === 3)).toBe(true);
    const pair = await repository.getPairSynergy("batch-account-0", "batch-account-1");
    expect(pair).toMatchObject({ matchesPlayed: 1, wins: 0 });
    expect(pair!.synergyScore).toBeLessThan(0);
    expect(await repository.getPlayerAccount("batch-account-0")).toMatchObject({ rating: 980, ratedGamesPlayed: 1 });
  });

  it("saves unrated court scores without changing those players' ratings or snapshots", async () => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    repository.state.matches[3] = { ...repository.state.matches[3], rated: false };
    await serviceFor(repository).recordMultipleResults(inputs);
    expect(await repository.getMatch("batch-match-3")).toMatchObject({ status: "completed", rated: false, version: 2, team1Score: 11 });
    expect(await repository.getPlayerAccount("batch-account-12")).toMatchObject({ rating: 1000, ratedGamesPlayed: 0 });
    expect(repository.state.matchPlayers.find(member => member.playerId === "batch-player-12")).toMatchObject({ ratingBefore: null, ratingAfter: null });
    expect(await repository.getPlayerAccount("batch-account-0")).toMatchObject({ rating: 1020, ratedGamesPlayed: 1 });
  });

  it.each([[11, 11], [11.5, 7], [11, -1]])("rejects invalid scores %s–%s before any writes", async (team1Score, team2Score) => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    const before = structuredClone(repository.state);
    await expect(serviceFor(repository).recordMultipleResults([inputs[0], { ...inputs[1], team1Score, team2Score }])).rejects.toThrow();
    expect(repository.state).toEqual(before);
  });

  it("keeps empty batches as a no-op", async () => {
    const repository = new InMemoryRepositories();
    expect(await serviceFor(repository).recordMultipleResults([])).toEqual([]);
    expect(repository.writeCount).toBe(0);
    expect(repository.committedTransactions).toBe(0);
  });
});
