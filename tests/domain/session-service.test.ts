import { beforeEach, describe, expect, it } from "vitest";

import { DomainError } from "@/lib/domain/errors";
import { SessionService } from "@/lib/domain/session-service";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

const players = Array.from({ length: 8 }, (_, index) => ({
  id: `player-${index + 1}`,
  groupId: "group-1",
  name: `Player ${index + 1}`,
  initialRating: 1_000,
  rating: 1_000,
  ratedGamesPlayed: 0,
  active: true,
}));

function serviceFor(repository: InMemoryRepositories) {
  let id = 0;
  let seed = 100;
  return new SessionService(repository, {
    now: () => new Date("2026-10-06T12:00:00.000Z"),
    nextId: (kind) => `${kind}-${++id}`,
    nextSeed: () => ++seed,
  });
}

describe("SessionService", () => {
  let repository: InMemoryRepositories;
  let service: SessionService;

  beforeEach(() => {
    repository = new InMemoryRepositories({ players });
    service = serviceFor(repository);
  });

  it("keeps proposals and regeneration out of repository history", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 5).map((player) => player.id),
    });
    const writesAfterStart = repository.writeCount;

    const first = await service.proposeRound(session.id, 1);
    const regenerated = await service.proposeRound(session.id, 2);

    expect(first.seed).toBe(1);
    expect(regenerated.seed).toBe(2);
    expect(repository.writeCount).toBe(writesAfterStart);
    expect(repository.state.rounds).toHaveLength(0);
  });

  it("starts a proposed round atomically with matches and sitting players", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 5).map((player) => player.id),
    });
    const proposal = await service.proposeRound(session.id, 10);
    const transactionsBefore = repository.committedTransactions;

    const round = await service.startRound(session.id, proposal);

    expect(round.status).toBe("started");
    expect(repository.committedTransactions).toBe(transactionsBefore + 1);
    expect(repository.state.rounds).toHaveLength(1);
    expect(repository.state.matches).toHaveLength(1);
    expect(repository.state.matchPlayers).toHaveLength(4);
    expect(repository.state.roundSits).toHaveLength(1);
  });

  it("applies attendance changes only to future rounds", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 5).map((player) => player.id),
    });
    const first = await service.proposeRound(session.id, 10);
    await service.startRound(session.id, first);
    const firstRoundPlayers = new Set(repository.state.matchPlayers.map((item) => item.playerId));
    await service.changeAttendance({
      sessionId: session.id,
      playerId: "player-1",
      present: false,
    });
    await service.changeAttendance({
      sessionId: session.id,
      playerId: "player-6",
      present: true,
    });

    const next = await service.proposeRound(session.id, 11);

    expect(firstRoundPlayers.has("player-1")).toBe(
      repository.state.matchPlayers.some((item) => item.playerId === "player-1"),
    );
    expect(next.courts.flatMap((court) => [...court.team1, ...court.team2])).not.toContain(
      "player-1",
    );
    expect([
      ...next.courts.flatMap((court) => [...court.team1, ...court.team2]),
      ...next.sitting,
    ]).toContain("player-6");
  });

  it("requires every match to be resolved before completing a round", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 2,
      playerIds: players.map((player) => player.id),
    });
    const round = await service.startRound(session.id, await service.proposeRound(session.id, 5));
    const [firstMatch, secondMatch] = repository.state.matches;

    await service.recordResult({ matchId: firstMatch.id, team1Score: 11, team2Score: 7 });
    await expect(service.completeRound(round.id)).rejects.toMatchObject({
      code: "UNRESOLVED_MATCHES",
    });
    await service.cancelMatch(secondMatch.id);

    await expect(service.completeRound(round.id)).resolves.toMatchObject({ status: "completed" });
  });

  it("returns a domain validation error when fewer than four players are present", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 3).map((player) => player.id),
    });

    await expect(service.proposeRound(session.id, 1)).rejects.toEqual(
      new DomainError("INSUFFICIENT_PLAYERS", "At least 4 players are required for doubles."),
    );
  });

  it("undoes only the latest round and removes all of its participation records", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 2,
      playerIds: players.map((player) => player.id),
    });
    const first = await service.startRound(session.id, await service.proposeRound(session.id, 1));
    const second = await service.startRound(session.id, await service.proposeRound(session.id, 2));
    const secondMatchIds = new Set(
      repository.state.matches.filter((match) => match.roundId === second.id).map((match) => match.id),
    );
    await service.recordResult({
      matchId: [...secondMatchIds][0],
      team1Score: 11,
      team2Score: 8,
    });

    const undone = await service.undoLatestRound(session.id);

    expect(undone.id).toBe(second.id);
    expect(repository.state.rounds.map((round) => round.id)).toEqual([first.id]);
    expect(repository.state.matches.some((match) => secondMatchIds.has(match.id))).toBe(false);
    expect(repository.state.matchPlayers.some((item) => secondMatchIds.has(item.matchId))).toBe(false);
    expect(repository.state.roundSits.some((sit) => sit.roundId === second.id)).toBe(false);
    expect(repository.state.players.every((player) => player.ratedGamesPlayed === 0)).toBe(true);
  });
});
