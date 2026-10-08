import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { SessionService } from "@/lib/domain/session-service";
import { SqliteDomainRepository } from "./sqlite-repositories";

describe("SqliteDomainRepository", () => {
  it("supports player accounts joining public groups and recording their session history", async () => {
    const db = new DatabaseSync(":memory:");
    const repository = new SqliteDomainRepository(db);
    await repository.insertGroup({
      id: "public-group",
      name: "Public Pickleball",
      organizerPinHash: "hash",
      publicShareId: "share-public",
      createdAt: new Date("2026-10-06T10:00:00Z"),
      isPublic: true,
    });
    await repository.createPlayerAccount({
      id: "user-1",
      username: "player_one",
      name: "Player One",
      passwordHash: "hash",
      skillLevel: "beginner",
      initialRating: 900,
      createdAt: new Date("2026-10-06T10:00:00Z"),
    });
    const joined = await repository.joinPublicGroup("user-1", "public-group");
    expect(joined?.accountId).toBe("user-1");

    const playerIds = [joined!.id];
    for (let index = 1; index <= 3; index++) {
      const id = `roster-${index}`;
      playerIds.push(id);
      await repository.createPlayer({
        id,
        groupId: "public-group",
        name: `Roster ${index}`,
        initialRating: 1_000,
        rating: 1_000,
        ratedGamesPlayed: 0,
        active: true,
      });
    }
    const service = new SessionService(repository, {
      now: () => new Date("2026-10-06T12:00:00Z"),
      nextId: (kind) => `${kind}-player-test`,
      nextSeed: () => 123,
    });
    const session = await service.startSession({ groupId: "public-group", courtCount: 1, playerIds });
    const proposal = await service.proposeRound(session.id, 1);
    const round = await service.startRound(session.id, proposal);
    const matches = await repository.listStartedRounds(session.id);
    for (const match of matches[0].matches) {
      await service.recordResult({ matchId: match.id, team1Score: 11, team2Score: 6 });
    }
    await service.completeRound(round.id);
    await service.endSession(session.id);

    const history = await repository.listPlayerSessionHistory("user-1");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ sessionId: session.id, groupName: "Public Pickleball" });
    expect(history[0].wins + history[0].losses).toBe(1);
    expect(history[0].rating).not.toBe(900);
    db.close();
  });

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
