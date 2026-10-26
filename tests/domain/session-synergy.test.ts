import { describe, it, expect, vi } from "vitest";
import { SessionService } from "@/lib/domain/session-service";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

async function fixture() {
  const players = ["a", "b", "c", "d"].map((id) => ({
    id, groupId: "g1", name: id, accountId: `account-${id}`,
    initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true,
  }));
  const repository = new InMemoryRepositories({ players });
  let sequence = 0;
  let time = 0;
  const service = new SessionService(repository, {
    now: () => new Date(Date.UTC(2026, 9, 26, 12, 0, time++)),
    nextId: (kind) => `${kind}-${++sequence}`, nextSeed: () => 1,
  });
  const session = await service.startSession({ groupId: "g1", courtCount: 1, playerIds: players.map(p => p.id) });
  const proposal = await service.proposeRound(session.id, 1);
  const round = await service.startRound(session.id, proposal);
  const match = repository.state.matches[0];
  const pair = proposal.courts[0].team1.map(id => `account-${id}`);
  const opposingPair = proposal.courts[0].team2.map(id => `account-${id}`);
  await service.recordResult({ matchId: match.id, team1Score: 11, team2Score: 0 });
  return { repository, service, session, round, match, pair, opposingPair };
}

describe("Normal-session chemistry corrections", () => {
  it("reverses chemistry when a completed round's winner is corrected", async () => {
    const { repository, service, round, match, pair, opposingPair } = await fixture();
    await service.completeRound(round.id);
    expect(await repository.getPairSynergy(pair[0], pair[1])).toMatchObject({ matchesPlayed: 1, wins: 1, synergyScore: 5 });

    await service.recordResult({ matchId: match.id, team1Score: 0, team2Score: 11 });
    expect(await repository.getPairSynergy(pair[0], pair[1])).toMatchObject({ matchesPlayed: 1, wins: 0, synergyScore: -5 });
    expect(await repository.getPairSynergy(opposingPair[0], opposingPair[1])).toMatchObject({ matchesPlayed: 1, wins: 1, synergyScore: 5 });
  });

  it("waits for round finalization and does not double count repeated completion or saves", async () => {
    const { repository, service, round, match, pair, session } = await fixture();
    expect(await repository.getPairSynergy(pair[0], pair[1])).toBeNull();
    await service.completeRound(round.id);
    await service.completeRound(round.id);
    await service.recordResult({ matchId: match.id, team1Score: 11, team2Score: 0 });
    await service.endSession(session.id);
    expect(await repository.getPairSynergy(pair[0], pair[1])).toMatchObject({ matchesPlayed: 1, wins: 1, synergyScore: 5 });
  });

  it("updates chemistry for a score-margin correction without adding a match", async () => {
    const { repository, service, round, match, pair } = await fixture();
    await service.completeRound(round.id);
    await service.recordResult({ matchId: match.id, team1Score: 11, team2Score: 9 });
    expect(await repository.getPairSynergy(pair[0], pair[1])).toMatchObject({ matchesPlayed: 1, wins: 1, synergyScore: 4 });
  });

  it.each(["cancel", "delete", "undo", "reshuffle"])("removes obsolete chemistry after %s", async (operation) => {
    const { repository, service, round, match, pair, session } = await fixture();
    await service.completeRound(round.id);
    if (operation === "cancel") await service.cancelMatch(match.id);
    if (operation === "delete") await service.deleteMatch(match.id);
    if (operation === "undo") await service.undoLatestRound(session.id);
    if (operation === "reshuffle") await service.reshuffleRound(session.id, 2);
    expect(await repository.getPairSynergy(pair[0], pair[1])).toBeNull();
  });

  it("preserves original completion time when correcting a historical result", async () => {
    const { repository, service, match } = await fixture();
    const original = (await repository.getMatch(match.id))!.completedAt;
    await service.recordResult({ matchId: match.id, team1Score: 0, team2Score: 11 });
    expect((await repository.getMatch(match.id))!.completedAt).toEqual(original);
  });

  it("finalizes chemistry when ending without completing the round first", async () => {
    const { repository, service, match, pair, session } = await fixture();
    await service.endSession(session.id);
    expect(await repository.getPairSynergy(pair[0], pair[1])).toMatchObject({ matchesPlayed: 1, synergyScore: 5 });
    await service.recordResult({ matchId: match.id, team1Score: 0, team2Score: 11 });
    expect(await repository.getPairSynergy(pair[0], pair[1])).toMatchObject({ matchesPlayed: 1, wins: 0, synergyScore: -5 });
  });
});


it("rolls back a result and Elo changes if chemistry persistence fails", async () => {
  const { repository, service, round, match } = await fixture();
  await service.completeRound(round.id);
  const before = structuredClone(repository.state);
  vi.spyOn(repository, "replaceSynergyState").mockRejectedValueOnce(new Error("Storage failure"));
  await expect(service.recordResult({ matchId: match.id, team1Score: 0, team2Score: 11 })).rejects.toThrow("Storage failure");
  expect(repository.state).toEqual(before);
});
