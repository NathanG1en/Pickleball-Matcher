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

  it("returns a domain validation error when fewer than two players are present", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 1).map((player) => player.id),
    });

    await expect(service.proposeRound(session.id, 1)).rejects.toEqual(
      new DomainError("INSUFFICIENT_PLAYERS", "At least 2 players are required."),
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

  it("reshuffles the latest round, reverting previous match data and proposing a new round", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 2,
      playerIds: players.map((player) => player.id),
    });
    const firstRound = await service.startRound(session.id, await service.proposeRound(session.id, 10));
    const firstMatchIds = new Set(
      repository.state.matches.filter((match) => match.roundId === firstRound.id).map((match) => match.id),
    );

    const reshuffledProposal = await service.reshuffleRound(session.id, 999);

    expect(reshuffledProposal).toBeDefined();
    expect(reshuffledProposal.courts.length).toBe(2);
    // Previous round should be deleted
    expect(repository.state.rounds.some((r) => r.id === firstRound.id)).toBe(false);
    expect(repository.state.matches.some((m) => firstMatchIds.has(m.id))).toBe(false);
    // Session round number should be back to 0
    const updatedSession = await repository.getSession(session.id);
    expect(updatedSession?.currentRoundNumber).toBe(0);
  });

  it("allows completing a round when a singles match has no score entered", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 2,
      playerIds: players.slice(0, 6).map((player) => player.id),
    });
    const round = await service.startRound(session.id, await service.proposeRound(session.id, 5));
    const roundMatches = repository.state.matches.filter((m) => m.roundId === round.id);
    const doublesMatch = roundMatches.find((m) => m.courtNumber === 1)!;
    const singlesMatch = roundMatches.find((m) => m.courtNumber === 2)!;

    // Record only doubles score
    await service.recordResult({ matchId: doublesMatch.id, team1Score: 11, team2Score: 7 });

    // Round should complete successfully without needing singles score
    await expect(service.completeRound(round.id)).resolves.toMatchObject({ status: "completed" });

    // Singles match should be closed as cancelled (unrecorded)
    const updatedSingles = repository.state.matches.find((m) => m.id === singlesMatch.id)!;
    expect(updatedSingles.status).toBe("cancelled");
  });

  it("does not change elo when a singles match score is recorded", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 2).map((player) => player.id),
    });
    const round = await service.startRound(session.id, await service.proposeRound(session.id, 1));
    const [singlesMatch] = repository.state.matches.filter((m) => m.roundId === round.id);

    await service.recordResult({ matchId: singlesMatch.id, team1Score: 11, team2Score: 4 });
    await service.completeRound(round.id);

    const player1 = repository.state.players.find((p) => p.id === players[0].id)!;
    const player2 = repository.state.players.find((p) => p.id === players[1].id)!;
    expect(player1.rating).toBe(1000);
    expect(player2.rating).toBe(1000);
    expect(player1.ratedGamesPlayed).toBe(0);
    expect(player2.ratedGamesPlayed).toBe(0);
  });

  it("rejects marking an inactive (deleted) player as present in changeAttendance", async () => {
    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 4).map((player) => player.id),
    });

    // Remove player-5 from group
    await repository.removePlayerFromGroup("player-5", "group-1");

    await expect(
      service.changeAttendance({
        sessionId: session.id,
        playerId: "player-5",
        present: true,
      }),
    ).rejects.toEqual(
      new DomainError("INVALID_STATE", "Player is not an active member of this group."),
    );
  });

  it("marks attendance as left when an attending player is deleted from the group mid-session", async () => {
    // Set accountId on player-4 so they are treated as an account member rather than a guest
    repository.state.players = repository.state.players.map((p) =>
      p.id === "player-4" ? { ...p, accountId: "acc-4" } : p,
    );

    const session = await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 4).map((player) => player.id),
    });

    // Check that player-4 is present
    const initialAtt = repository.state.attendance.find(
      (a) => a.sessionId === session.id && a.playerId === "player-4",
    );
    expect(initialAtt?.leftRound).toBeNull();

    // Delete player-4 from group after session started
    await repository.removePlayerFromGroup("player-4", "group-1");

    const updatedAtt = repository.state.attendance.find(
      (a) => a.sessionId === session.id && a.playerId === "player-4",
    );
    expect(updatedAtt?.leftRound).toBe(1);
  });

  it("completely deletes an attending guest player with 0 games from the repository when removed mid-session", async () => {
    await service.startSession({
      groupId: "group-1",
      courtCount: 1,
      playerIds: players.slice(0, 4).map((player) => player.id),
    });

    // Guest player-4 has 0 games and no account
    const removed = await repository.removePlayerFromGroup("player-4", "group-1");
    expect(removed).toBe(true);

    expect(repository.state.players.some((p) => p.id === "player-4")).toBe(false);
    expect(repository.state.attendance.some((a) => a.playerId === "player-4")).toBe(false);
  });

  describe("updateCourtConfig", () => {
    it("updates court count and court sizes on an active session and generates new proposal", async () => {
      const session = await service.startSession({
        groupId: "group-1",
        courtCount: 1,
        courtPlayerCounts: [4],
        playerIds: players.map((p) => p.id),
      });

      const result = await service.updateCourtConfig({
        sessionId: session.id,
        courtCount: 2,
        courtPlayerCounts: [4, 4],
      });

      expect(result.session.courtCount).toBe(2);
      expect(result.session.courtPlayerCounts).toEqual([4, 4]);
      expect(result.session.version).toBe(session.version + 1);

      // Verify in repository
      const saved = await repository.getSession(session.id);
      expect(saved?.courtCount).toBe(2);
      expect(saved?.courtPlayerCounts).toEqual([4, 4]);

      // Proposal was updated to 2 courts
      expect(result.proposal?.courts).toHaveLength(2);
    });

    it("rejects updating court config if session has ended", async () => {
      const session = await service.startSession({
        groupId: "group-1",
        courtCount: 1,
        playerIds: players.slice(0, 4).map((p) => p.id),
      });
      await service.endSession(session.id);

      await expect(
        service.updateCourtConfig({
          sessionId: session.id,
          courtCount: 2,
        }),
      ).rejects.toEqual(new DomainError("INVALID_STATE", "The session has ended."));
    });

    it("rejects court sizes exceeding eligible players", async () => {
      const session = await service.startSession({
        groupId: "group-1",
        courtCount: 1,
        courtPlayerCounts: [4],
        playerIds: players.slice(0, 4).map((p) => p.id),
      });

      await expect(
        service.updateCourtConfig({
          sessionId: session.id,
          courtCount: 2,
          courtPlayerCounts: [4, 4], // Requires 8 players, but only 4 present
        }),
      ).rejects.toEqual(
        new DomainError("INVALID_STATE", "Court sizes cannot exceed the number of present players."),
      );
    });

    it.each([false, true])("counts singles history from played matches, skips cancellations (%s), and resets each session", async (cancelled) => {
      const ids = players.slice(0, 2).map(p => p.id);
      const session = await service.startSession({ groupId: "group-1", courtCount: 1, courtPlayerCounts: [2], playerIds: ids });
      const round = await service.startRound(session.id, await service.proposeRound(session.id, 101));
      const match = repository.state.matches.find(m => m.roundId === round.id)!;
      if (cancelled) await service.cancelMatch(match.id);
      else await service.recordResult({ matchId: match.id, team1Score: 11, team2Score: 9 });
      await service.completeRound(round.id);
      const next = await service.proposeRound(session.id, 102);
      expect(next.scoreBreakdown.singlesRepeat ?? 0).toBe(cancelled ? 0 : 200);
      expect(next.courts).toHaveLength(1);
      const fresh = await service.startSession({ groupId: "group-1", courtCount: 1, courtPlayerCounts: [2], playerIds: ids });
      expect((await service.proposeRound(fresh.id, 103)).scoreBreakdown.singlesRepeat ?? 0).toBe(0);
    });

    it("rotates singles players out of the 1v1 court after a completed mixed-format round", async () => {
      const session = await service.startSession({ groupId: "group-1", courtCount: 2, courtPlayerCounts: [4, 2], playerIds: players.slice(0, 6).map(p => p.id) });
      const proposal = await service.proposeRound(session.id, 101);
      const singles = proposal.courts.find(c => c.team1.length === 1 && c.team2.length === 1)!;
      const previousSingles = [...singles.team1, ...singles.team2];
      const round = await service.startRound(session.id, proposal);
      for (const match of repository.state.matches.filter(m => m.roundId === round.id)) {
        await service.recordResult({ matchId: match.id, team1Score: 11, team2Score: 9 });
      }
      await service.completeRound(round.id);
      for (const seed of [102, 103, 104]) {
        const next = await service.proposeRound(session.id, seed);
        const nextSingles = next.courts.find(c => c.team1.length === 1 && c.team2.length === 1)!;
        for (const id of previousSingles) expect([...nextSingles.team1, ...nextSingles.team2]).not.toContain(id);
      }
    });

    it("tracks timesPlayed2v1 and rotates 2v1 court assignments across rounds", async () => {
      // 7 players on 2 courts: [4, 3] -> 1 doubles court, 1 2v1 court
      const session = await service.startSession({
        groupId: "group-1",
        courtCount: 2,
        courtPlayerCounts: [4, 3],
        playerIds: players.slice(0, 7).map((p) => p.id),
      });

      // Round 1
      const proposal1 = await service.proposeRound(session.id, 101);
      const court3R1 = proposal1.courts.find((c) => c.matchType === "team-vs-one");
      expect(court3R1).toBeDefined();
      const r1Players = [...court3R1!.team1, ...court3R1!.team2];
      expect(r1Players).toHaveLength(3);

      const startedRound = await service.startRound(session.id, proposal1);
      // Complete round 1 matches
      for (const court of proposal1.courts) {
        const matches = repository.state.matches.filter((m) => m.courtNumber === court.courtNumber);
        const match = matches[matches.length - 1];
        await service.recordResult({
          matchId: match.id,
          team1Score: 11,
          team2Score: 9,
        });
      }
      await service.completeRound(startedRound.id);

      // Propose Round 2
      const proposal2 = await service.proposeRound(session.id, 102);
      const court3R2 = proposal2.courts.find((c) => c.matchType === "team-vs-one");
      expect(court3R2).toBeDefined();
      const r2Players = [...court3R2!.team1, ...court3R2!.team2];
      expect(r2Players).toHaveLength(3);

      // None of the players who played 2v1 in Round 1 should play 2v1 in Round 2!
      for (const p of r1Players) {
        expect(r2Players).not.toContain(p);
      }
    });

    it("records multiple match results in a single transaction", async () => {
      const session = await service.startSession({
        groupId: "group-1",
        courtCount: 2,
        playerIds: players.map((p) => p.id),
      });
      const round = await service.startRound(session.id, await service.proposeRound(session.id, 10));
      const roundMatches = repository.state.matches.filter((m) => m.roundId === round.id);

      const results = await service.recordMultipleResults([
        { matchId: roundMatches[0].id, team1Score: 11, team2Score: 8 },
        { matchId: roundMatches[1].id, team1Score: 5, team2Score: 11 },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("completed");
      expect(results[0].team1Score).toBe(11);
      expect(results[1].status).toBe("completed");
      expect(results[1].team2Score).toBe(11);
    });

    it("saves scores and advances to the next round in a single atomic transaction", async () => {
      const session = await service.startSession({
        groupId: "group-1",
        courtCount: 1,
        playerIds: players.slice(0, 5).map((p) => p.id),
      });
      const round1 = await service.startRound(session.id, await service.proposeRound(session.id, 10));
      const r1Match = repository.state.matches.find((m) => m.roundId === round1.id)!;

      const txBefore = repository.committedTransactions;
      const { completedRound, startedRound } = await service.saveAndStartNextRound({
        sessionId: session.id,
        roundId: round1.id,
        results: [{ matchId: r1Match.id, team1Score: 11, team2Score: 9 }],
      });

      // Assert it executed atomically in 1 transaction
      expect(repository.committedTransactions).toBe(txBefore + 1);
      expect(completedRound.status).toBe("completed");
      expect(completedRound.roundNumber).toBe(1);
      expect(startedRound.round.status).toBe("started");
      expect(startedRound.round.roundNumber).toBe(2);

      // Verify the new round's matches and sits exist in repository
      const r2Matches = repository.state.matches.filter((m) => m.roundId === startedRound.round.id);
      expect(r2Matches).toHaveLength(1);
      const r2Sits = repository.state.roundSits.filter((s) => s.roundId === startedRound.round.id);
      expect(r2Sits).toHaveLength(1);

      // Verify session version incremented
      const updatedSession = await repository.getSession(session.id);
      expect(updatedSession?.currentRoundNumber).toBe(2);
      expect(updatedSession?.version).toBe(session.version + 2);
    });

    it("rejects scores from a different session without writing any state", async () => {
      const first = await service.startSession({ groupId: "group-1", courtCount: 1, playerIds: players.slice(0, 4).map(p => p.id) });
      const second = await service.startSession({ groupId: "group-1", courtCount: 1, playerIds: players.slice(4).map(p => p.id) });
      const round = await service.startRound(first.id, await service.proposeRound(first.id, 1));
      const foreignRound = await service.startRound(second.id, await service.proposeRound(second.id, 2));
      const before = structuredClone(repository.state);
      const results = repository.state.matches.filter(m => [round.id, foreignRound.id].includes(m.roundId)).map(m => ({ matchId: m.id, team1Score: 11, team2Score: 7 }));
      await expect(service.saveAndStartNextRound({ sessionId: first.id, roundId: round.id, results })).rejects.toThrow();
      expect(repository.state).toEqual(before);
    });

    it("rejects a supplied next lineup that splits an approved pair atomically", async () => {
      const session = await service.startSession({ groupId: "group-1", courtCount: 1, playerIds: players.slice(0, 4).map(p => p.id), stayTogetherPairs: [["player-1", "player-2"]] });
      const proposal = await service.proposeRound(session.id, 1);
      const round = await service.startRound(session.id, proposal);
      const before = structuredClone(repository.state);
      await expect(service.saveAndStartNextRound({
        sessionId: session.id, roundId: round.id,
        results: repository.state.matches.map(m => ({ matchId: m.id, team1Score: 11, team2Score: 7 })),
        nextProposal: { ...proposal, courts: [{ courtNumber: 1, team1: ["player-1", "player-3"], team2: ["player-2", "player-4"], matchType: "doubles" }], sitting: [] },
      })).rejects.toThrow();
      expect(repository.state).toEqual(before);
    });

    it("rejects a stale round version without saving scores", async () => {
      const session = await service.startSession({ groupId: "group-1", courtCount: 1, playerIds: players.slice(0, 4).map(p => p.id) });
      const round = await service.startRound(session.id, await service.proposeRound(session.id, 1));
      const before = structuredClone(repository.state);
      await expect(service.saveAndStartNextRound({ sessionId: session.id, roundId: round.id, expectedRoundVersion: round.version + 1, results: repository.state.matches.map(m => ({ matchId: m.id, team1Score: 11, team2Score: 7 })) })).rejects.toThrow("round changed");
      expect(repository.state).toEqual(before);
    });

    it("rejects a duplicate-player next lineup even without approved pairs", async () => {
      const session = await service.startSession({ groupId: "group-1", courtCount: 1, playerIds: players.slice(0, 4).map(p => p.id) });
      const proposal = await service.proposeRound(session.id, 1);
      const round = await service.startRound(session.id, proposal);
      const before = structuredClone(repository.state);
      await expect(service.saveAndStartNextRound({ sessionId: session.id, roundId: round.id, nextProposal: { ...proposal, courts: [{ courtNumber: 1, team1: ["player-1", "player-1"], team2: ["player-3", "player-4"], matchType: "doubles" }] }, results: repository.state.matches.map(m => ({ matchId: m.id, team1Score: 11, team2Score: 7 })) })).rejects.toThrow();
      expect(repository.state).toEqual(before);
    });

    it("recalculates synergies on demand via recalculateSynergies", async () => {
      await expect(service.recalculateSynergies()).resolves.toBeUndefined();
    });
  });
});

