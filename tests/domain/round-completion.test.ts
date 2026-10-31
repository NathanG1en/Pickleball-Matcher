import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainRepository } from "@/lib/domain/repositories";
import { SessionService } from "@/lib/domain/session-service";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { SqliteDomainRepository } from "../simulations/sqlite-repositories";
import { seedBatchScores, batchNow } from "../fixtures/batch-scores";

describe.each(["memory", "sqlite"] as const)("focused round completion (%s)", adapter => {
  let repository: DomainRepository;
  let db: DatabaseSync | undefined;
  let fixture: Awaited<ReturnType<typeof seedBatchScores>>;
  let service: SessionService;
  beforeEach(async () => {
    db = adapter === "sqlite" ? new DatabaseSync(":memory:") : undefined;
    repository = db ? new SqliteDomainRepository(db) : new InMemoryRepositories();
    fixture = await seedBatchScores(repository, 2);
    service = new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });
  });
  afterEach(() => { vi.restoreAllMocks(); db?.close(); });

  it("returns pending match counts, excludes resolved/other-round matches, and preserves the round", async () => {
    const { round, matches } = fixture;
    const original = (await repository.listStartedRounds(round.sessionId))[0];
    await repository.updateMatch({ ...matches[0], status: "cancelled", version: 2 });
    await repository.insertStartedRound({ ...original, round: { ...round, id: "later-round", roundNumber: 2 }, matches: [{ ...matches[0], id: "later-match", roundId: "later-round" }], matchPlayers: [], sits: [] });
    expect(await repository.getRoundCompletionContext(round.id)).toEqual({ round, pendingMatches: [{ match: matches[1], playerCount: 4 }] });
    expect(await repository.getRoundCompletionContext("missing")).toBeNull();
  });

  it("distinguishes an existing empty round from a missing round", async () => {
    for (const match of fixture.matches) await repository.deleteMatch(match.id);
    expect(await repository.getRoundCompletionContext(fixture.round.id)).toEqual({ round: fixture.round, pendingMatches: [] });
    await expect(service.completeRound(fixture.round.id)).resolves.toMatchObject({ status: "completed", version: 2 });
    await expect(service.completeRound("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("completes through the focused read without loading session history or rereading the round", async () => {
    await service.recordMultipleResults(fixture.inputs);
    const history = vi.spyOn(repository, "listStartedRounds").mockRejectedValue(new Error("Full session history was loaded"));
    const roundRead = vi.spyOn(repository, "getRound").mockRejectedValue(new Error("Separate round read was used"));
    await expect(service.completeRound(fixture.round.id)).resolves.toMatchObject({ status: "completed", version: 2 });
    expect(history).not.toHaveBeenCalled(); expect(roundRead).not.toHaveBeenCalled();
    if (adapter === "memory") expect(await repository.getPairSynergy("batch-account-0", "batch-account-1")).toMatchObject({ matchesPlayed: 1, wins: 1 });
  });

  it.each([0, 1, 3, 4])("blocks an unresolved match with %i participants and rolls back an earlier singles cancellation", async count => {
    const original = (await repository.listStartedRounds("batch-session"))[0];
    await repository.updateMatchPlayers(fixture.matches[0].id, original.matchPlayers.filter(p => p.matchId === fixture.matches[0].id).slice(0, 2));
    await repository.updateMatchPlayers(fixture.matches[1].id, original.matchPlayers.filter(p => p.matchId === fixture.matches[1].id).slice(0, count));
    await expect(service.completeRound(fixture.round.id)).rejects.toMatchObject({ code: "UNRESOLVED_MATCHES" });
    expect(await repository.getMatch(fixture.matches[0].id)).toMatchObject({ status: "pending", version: 1 });
    expect(await repository.getRound(fixture.round.id)).toMatchObject({ status: "started", version: 1 });
  });

  it("cancels pending singles, preserves resolved scores, and rolls everything back on chemistry failure", async () => {
    const original = (await repository.listStartedRounds("batch-session"))[0];
    await repository.updateMatchPlayers(fixture.matches[1].id, original.matchPlayers.filter(p => p.matchId === fixture.matches[1].id).slice(0, 2));
    await service.recordResult(fixture.inputs[0]);
    const fault = vi.spyOn(repository, "replaceSynergyState").mockRejectedValueOnce(new Error("chemistry failed"));
    // SQLite transactions pass the same repository, like the in-memory adapter.
    await expect(service.completeRound(fixture.round.id)).rejects.toThrow("chemistry failed");
    expect(await repository.getMatch(fixture.matches[1].id)).toMatchObject({ status: "pending", version: 1 });
    fault.mockRestore();
    await service.completeRound(fixture.round.id);
    expect(await repository.getMatch(fixture.matches[1].id)).toMatchObject({ status: "cancelled", version: 2, completedAt: null });
    expect(await repository.getMatch(fixture.matches[0].id)).toMatchObject({ status: "completed", team1Score: 11, team2Score: 7, completedAt: batchNow });
  });
});
