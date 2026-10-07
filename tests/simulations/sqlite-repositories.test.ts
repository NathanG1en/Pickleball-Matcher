import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { SessionService } from "@/lib/domain/session-service";
import { SqliteDomainRepository } from "./sqlite-repositories";

describe("SqliteDomainRepository", () => {
  it("supports starting session, rounds, matches, recording results and rating replay", async () => {
    const db = new DatabaseSync(":memory:");
    const repository = new SqliteDomainRepository(db);

    await repository.insertGroup({
      id: "group-1",
      name: "Test Group",
      organizerPinHash: "hash",
      publicShareId: "share-1",
      createdAt: new Date("2026-10-06T10:00:00Z"),
    });

    const playerIds: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const id = `player-${i}`;
      playerIds.push(id);
      await repository.createPlayer({
        id,
        groupId: "group-1",
        name: `Player ${i}`,
        initialRating: 1000,
        rating: 1000,
        ratedGamesPlayed: 0,
        active: true,
      });
    }

    let seed = 100;
    let id = 0;
    const service = new SessionService(repository, {
      now: () => new Date("2026-10-06T12:00:00Z"),
      nextId: (kind) => `${kind}-${++id}`,
      nextSeed: () => ++seed,
    });

    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 2,
      playerIds,
    });

    expect(session.id).toBe("session-1");

    const proposal = await service.proposeRound(session.id, 1);
    expect(proposal.courts).toHaveLength(2);

    const round = await service.startRound(session.id, proposal);
    expect(round.roundNumber).toBe(1);

    const startedRounds = await repository.listStartedRounds(session.id);
    expect(startedRounds).toHaveLength(1);
    expect(startedRounds[0].matches).toHaveLength(2);

    for (const match of startedRounds[0].matches) {
      await service.recordResult({
        matchId: match.id,
        team1Score: 11,
        team2Score: 7,
      });
    }

    await service.completeRound(round.id);
    await service.endSession(session.id);

    const players = await repository.listPlayers("group-1");
    expect(players.every((p) => p.ratedGamesPlayed === 1)).toBe(true);
    // Rating should have changed from 1000
    expect(players.some((p) => p.rating !== 1000)).toBe(true);
  });
});
