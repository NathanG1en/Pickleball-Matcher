import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addOpenPlayGuestAction,
  addOpenPlayPlayerAction,
  deleteOpenPlayGameAction,
  endOpenPlaySessionAction,
  getPlayerLastOpenPlayGameAction,
  joinOpenPlaySessionAction,
  removeOpenPlayPlayerAction,
  startOpenPlaySessionAction,
  submitOpenPlayGameAction,
  updateOpenPlayGameAction,
} from "@/app/actions/open-play";
import { setActionRepository } from "@/app/actions/action-context";
import { replaySynergies } from "@/lib/domain/synergy-replay";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { PlayerRecord } from "@/lib/domain/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockActiveAccountId: string | null = "acc-host";
let mockGuestPlayerId: string | null = null;

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    requireOrganizer: vi.fn(async () => null),
    getActivePlayerAccountId: vi.fn(async () => mockActiveAccountId),
  };
});

vi.mock("@/lib/auth/guest-session", () => ({
  getGuestPlayerIdForGroup: vi.fn(async () => mockGuestPlayerId),
}));

describe("Open Play Server Actions", () => {
  let repository: InMemoryRepositories;

  const samplePlayers = [
    { id: "p-host", groupId: "g1", name: "Host Player", initialRating: 1200, rating: 1200, ratedGamesPlayed: 0, active: true, accountId: "acc-host" },
    { id: "p-user2", groupId: "g1", name: "Bob", initialRating: 1100, rating: 1100, ratedGamesPlayed: 0, active: true, accountId: "acc-user2" },
    { id: "p-user3", groupId: "g1", name: "Charlie", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, accountId: "acc-user3" },
    { id: "p-user4", groupId: "g1", name: "Dana", initialRating: 1050, rating: 1050, ratedGamesPlayed: 0, active: true, accountId: "acc-user4" },
  ];

  beforeEach(() => {
    mockActiveAccountId = "acc-host";
    mockGuestPlayerId = null;
    repository = new InMemoryRepositories({
      groups: [{ id: "g1", name: "Pickle Champions", organizerPinHash: "pin", createdAt: new Date(), ownerAccountId: "acc-host" }],
      players: samplePlayers,
      playerAccounts: [
        { id: "acc-host", username: "hostplayer", name: "Host Player", skillLevel: "advanced", initialRating: 1200, rating: 1200, ratedGamesPlayed: 0, passwordHash: "h", createdAt: new Date() },
        { id: "acc-user2", username: "bobplayer", name: "Bob", skillLevel: "intermediate", initialRating: 1100, rating: 1100, ratedGamesPlayed: 0, passwordHash: "h", createdAt: new Date() },
      ],
      sessions: [],
      attendance: [],
      rounds: [],
      matches: [],
      matchPlayers: [],
    });
    setActionRepository(repository);
  });

  it("starts an open play session with the host checked in", async () => {
    const res = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.type).toBe("open_play");
    expect(res.data.status).toBe("active");
    expect(res.data.currentRoundNumber).toBe(1);

    const attendance = await repository.listAttendance(res.data.id);
    expect(attendance).toHaveLength(1);
    expect(attendance[0].playerId).toBe("p-host");

    const rounds = await repository.listStartedRounds(res.data.id);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].round.status).toBe("started");
  });

  it("prevents starting open play if an active session already exists", async () => {
    await startOpenPlaySessionAction({ groupId: "g1" });
    const res = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("already in progress");
    }
  });

  it("allows a group player to join open play", async () => {
    const startRes = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    // Switch caller to user2
    mockActiveAccountId = "acc-user2";

    const joinRes = await joinOpenPlaySessionAction({
      groupId: "g1",
      sessionId: startRes.data.id,
    });
    expect(joinRes.ok).toBe(true);

    const attendance = await repository.listAttendance(startRes.data.id);
    expect(attendance.map((a) => a.playerId)).toContain("p-user2");
  });

  it("allows adding guests and roster players to open play", async () => {
    const startRes = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    // Add roster player
    const addPlayerRes = await addOpenPlayPlayerAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      playerId: "p-user3",
    });
    expect(addPlayerRes.ok).toBe(true);

    // Add guest player with selected rating (4.0 DUPR -> 1200 Elo) and selected gender
    const addGuestRes = await addOpenPlayGuestAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      guestName: "Guest Gary",
      gender: "female",
      initialRating: 4.0,
    });
    expect(addGuestRes.ok).toBe(true);
    if (!addGuestRes.ok) return;
    expect(addGuestRes.data.rating).toBe(1200);
    expect(addGuestRes.data.gender).toBe("female");

    const attendance = await repository.listAttendance(startRes.data.id);
    const attendedIds = attendance.map((a) => a.playerId);
    expect(attendedIds).toContain("p-user3");
    expect(attendedIds).toContain(addGuestRes.data.id);

    // Remove player
    const removeRes = await removeOpenPlayPlayerAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      playerId: "p-user3",
    });
    expect(removeRes.ok).toBe(true);
    const updatedAttendance = await repository.listAttendance(startRes.data.id);
    const user3Att = updatedAttendance.find((a) => a.playerId === "p-user3");
    expect(user3Att?.leftRound).toBe(1);
  });

  async function chemistryGame() {
    const started = await startOpenPlaySessionAction({ groupId: "g1" });
    if (!started.ok) throw new Error(started.error);
    for (const playerId of ["p-user2", "p-user3", "p-user4"]) {
      await repository.saveAttendance({ sessionId: started.data.id, playerId, joinedRound: 1, leftRound: null });
    }
    return { groupId: "g1", sessionId: started.data.id, team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"], team1Score: 11, team2Score: 0 };
  }

  it("does not append chemistry twice when another replay observes a newly inserted Open Play game", async () => {
    const input = await chemistryGame();
    const insertMatch = repository.insertMatch.bind(repository);
    vi.spyOn(repository, "insertMatch").mockImplementationOnce(async (match, members) => {
      await insertMatch(match, members);
      // Force the former visibility gap: another replay already counted this game.
      await replaySynergies(repository);
    });
    expect((await submitOpenPlayGameAction(input)).ok).toBe(true);
    expect(await repository.getPairSynergy("acc-host", "acc-user2")).toMatchObject({ matchesPlayed: 1, wins: 1 });
  });

  it("replaces edited Open Play chemistry and removes it after deletion", async () => {
    const input = await chemistryGame();
    const submitted = await submitOpenPlayGameAction(input);
    if (!submitted.ok) throw new Error(submitted.error);
    for (let repeat = 0; repeat < 2; repeat++) {
      expect((await updateOpenPlayGameAction({ ...input, matchId: submitted.data.id, team1Score: 0, team2Score: 11 })).ok).toBe(true);
    }
    expect(await repository.getPairSynergy("acc-host", "acc-user2")).toMatchObject({ matchesPlayed: 1, wins: 0 });
    expect((await deleteOpenPlayGameAction({ groupId: "g1", sessionId: input.sessionId, matchId: submitted.data.id })).ok).toBe(true);
    expect(await repository.getPairSynergy("acc-host", "acc-user2")).toBeNull();
  });

  it("rolls back Open Play source writes when the chemistry rebuild fails", async () => {
    const input = await chemistryGame();
    const before = structuredClone(repository.state);
    vi.spyOn(repository, "replaceSynergyState").mockRejectedValueOnce(new Error("Storage failure"));
    expect(await submitOpenPlayGameAction(input)).toMatchObject({ ok: false });
    expect(repository.state).toEqual(before);
  });

  it("submits games, calculates rating updates, and records synergy", async () => {
    const startRes = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    // Check in user2, user3, user4
    await repository.saveAttendance({ sessionId: startRes.data.id, playerId: "p-user2", joinedRound: 1, leftRound: null });
    await repository.saveAttendance({ sessionId: startRes.data.id, playerId: "p-user3", joinedRound: 1, leftRound: null });
    await repository.saveAttendance({ sessionId: startRes.data.id, playerId: "p-user4", joinedRound: 1, leftRound: null });

    // Submit doubles game 1
    const gameRes = await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 11,
      team2Score: 7,
    });

    expect(gameRes.ok).toBe(true);
    if (!gameRes.ok) return;

    expect(gameRes.data.status).toBe("completed");
    expect(gameRes.data.courtNumber).toBe(1);
    expect(gameRes.data.team1Score).toBe(11);
    expect(gameRes.data.team2Score).toBe(7);

    // Verify ability to submit a 2nd game with the exact same teams and same order of players
    const game2Res = await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 9,
      team2Score: 11,
    });
    expect(game2Res.ok).toBe(true);
    if (!game2Res.ok) return;
    expect(game2Res.data.courtNumber).toBe(2);

    // Verify autopopulation of last game for p-host
    const autopopulateRes = await getPlayerLastOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      playerId: "p-host",
    });
    expect(autopopulateRes.ok).toBe(true);
    if (!autopopulateRes.ok) return;
    expect(autopopulateRes.data).toEqual({
      matchType: "doubles",
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
    });

    // Verify player history includes the session as open_play
    const historyHost = await repository.listPlayerSessionHistory("acc-host");
    expect(historyHost).toHaveLength(1);
    expect(historyHost[0].type).toBe("open_play");
    expect(historyHost[0].wins).toBe(1);
    expect(historyHost[0].losses).toBe(1);

    const historyUser2 = await repository.listPlayerSessionHistory("acc-user2");
    expect(historyUser2).toHaveLength(1);
    expect(historyUser2[0].type).toBe("open_play");
    expect(historyUser2[0].wins).toBe(1);
    expect(historyUser2[0].losses).toBe(1);

    // Verify synergy between acc-host and acc-user2 was recorded
    const synergy = await repository.getPairSynergy("acc-host", "acc-user2");
    expect(synergy).not.toBeNull();
    expect(synergy?.matchesPlayed).toBe(2);
    expect(synergy?.wins).toBe(1);
  });

  it("keeps the session and rounds active if chemistry rebuild fails during completion", async () => {
    const started = await startOpenPlaySessionAction({ groupId: "g1" });
    if (!started.ok) throw new Error(started.error);
    const before = structuredClone(repository.state);
    const replacement = vi.spyOn(repository, "replaceSynergyState").mockRejectedValueOnce(new Error("Chemistry write failed"));
    try {
      const result = await endOpenPlaySessionAction({ groupId: "g1", sessionId: started.data.id });
      expect(result.ok).toBe(false);
      expect(repository.state).toEqual(before);
    } finally { replacement.mockRestore(); }
  });

  it("ends open play session and marks session and rounds completed, updating player profiles", async () => {
    const startRes = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    await joinOpenPlaySessionAction({ groupId: "g1", sessionId: startRes.data.id });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user2" });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user3" });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user4" });

    await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 11,
      team2Score: 7,
    });

    const endRes = await endOpenPlaySessionAction({
      groupId: "g1",
      sessionId: startRes.data.id,
    });
    expect(endRes.ok).toBe(true);
    if (!endRes.ok) return;

    expect(endRes.data.status).toBe("completed");
    expect(endRes.data.endedAt).not.toBeNull();

    const rounds = await repository.listStartedRounds(startRes.data.id);
    expect(rounds[0].round.status).toBe("completed");

    // Verify player profile has wins and losses from open play session
    const historyHost = await repository.listPlayerSessionHistory("acc-host");
    const sessionHistory = historyHost.find((h) => h.sessionId === startRes.data.id);
    expect(sessionHistory).toBeDefined();
    expect(sessionHistory?.type).toBe("open_play");
    expect(sessionHistory?.wins).toBe(1);
    expect(sessionHistory?.losses).toBe(0);

    const historyUser3 = await repository.listPlayerSessionHistory("acc-user3");
    const user3SessionHistory = historyUser3.find((h) => h.sessionId === startRes.data.id);
    expect(user3SessionHistory).toBeDefined();
    expect(user3SessionHistory?.type).toBe("open_play");
    expect(user3SessionHistory?.wins).toBe(0);
    expect(user3SessionHistory?.losses).toBe(1);
  });

  it("deletes a recorded open play game and recalculates", async () => {
    const startRes = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    await joinOpenPlaySessionAction({ groupId: "g1", sessionId: startRes.data.id });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user2" });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user3" });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user4" });

    const gameRes = await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 11,
      team2Score: 9,
    });
    expect(gameRes.ok).toBe(true);
    if (!gameRes.ok) return;

    const delRes = await deleteOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      matchId: gameRes.data.id,
    });
    expect(delRes.ok).toBe(true);
    if (!delRes.ok) return;
    expect(delRes.data.id).toBe(gameRes.data.id);

    const rounds = await repository.listStartedRounds(startRes.data.id);
    const deletedMatch = rounds[0].matches.find((m) => m.id === gameRes.data.id);
    expect(deletedMatch).toBeUndefined();
  });

  it("allows group organizers and hosts to add, edit, and delete games after the session has ended, while blocking non-organizers", async () => {
    // 1. Start open play session as host
    const startRes = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    // Check in players and submit initial game
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user2" });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user3" });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user4" });

    const game1Res = await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 11,
      team2Score: 7,
    });
    expect(game1Res.ok).toBe(true);
    if (!game1Res.ok) return;

    // 2. End the session
    const endRes = await endOpenPlaySessionAction({
      groupId: "g1",
      sessionId: startRes.data.id,
    });
    expect(endRes.ok).toBe(true);

    // 3. Verify non-organizer cannot add, edit, or delete games in ended session
    mockActiveAccountId = "acc-user2"; // Regular player / non-organizer

    // Non-organizer attempts to add game
    const nonOrgAddRes = await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-user2", "p-user3"],
      team2PlayerIds: ["p-host", "p-user4"],
      team1Score: 11,
      team2Score: 5,
    });
    expect(nonOrgAddRes.ok).toBe(false);
    if (!nonOrgAddRes.ok) {
      expect(nonOrgAddRes.error).toContain("Only organizers can add games to an ended session");
    }

    // Non-organizer attempts to edit game
    const nonOrgEditRes = await updateOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      matchId: game1Res.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 11,
      team2Score: 9,
    });
    expect(nonOrgEditRes.ok).toBe(false);
    if (!nonOrgEditRes.ok) {
      expect(nonOrgEditRes.error).toContain("Only organizers can edit games in an ended session");
    }

    // Non-organizer attempts to delete game
    const nonOrgDeleteRes = await deleteOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      matchId: game1Res.data.id,
    });
    expect(nonOrgDeleteRes.ok).toBe(false);
    if (!nonOrgDeleteRes.ok) {
      expect(nonOrgDeleteRes.error).toContain("Only organizers can delete games from an ended session");
    }

    // 4. Switch back to host (organizer)
    mockActiveAccountId = "acc-host";

    // Organizer adds a new game after session is ended
    const postEndAddRes = await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-host", "p-user3"],
      team2PlayerIds: ["p-user2", "p-user4"],
      team1Score: 11,
      team2Score: 6,
    });
    expect(postEndAddRes.ok).toBe(true);
    if (!postEndAddRes.ok) return;

    // Organizer edits the newly added game (update scores and team players)
    const postEndEditRes = await updateOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      matchId: postEndAddRes.data.id,
      team1PlayerIds: ["p-host", "p-user4"],
      team2PlayerIds: ["p-user2", "p-user3"],
      team1Score: 11,
      team2Score: 8,
    });
    expect(postEndEditRes.ok).toBe(true);
    if (!postEndEditRes.ok) return;
    expect(postEndEditRes.data.team1Score).toBe(11);
    expect(postEndEditRes.data.team2Score).toBe(8);

    // Organizer edits the initial game (game1)
    const editGame1Res = await updateOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      matchId: game1Res.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 12,
      team2Score: 10,
    });
    expect(editGame1Res.ok).toBe(true);
    if (!editGame1Res.ok) return;
    expect(editGame1Res.data.team1Score).toBe(12);
    expect(editGame1Res.data.team2Score).toBe(10);

    // Organizer deletes the initial game from the ended session
    const postEndDeleteRes = await deleteOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      matchId: game1Res.data.id,
    });
    expect(postEndDeleteRes.ok).toBe(true);

    const roundsAfter = await repository.listStartedRounds(startRes.data.id);
    const remainingMatches = roundsAfter.flatMap((r) => r.matches);
    expect(remainingMatches.map((m) => m.id)).not.toContain(game1Res.data.id);
    expect(remainingMatches.map((m) => m.id)).toContain(postEndAddRes.data.id);
  });

  it("rejects submitting or updating a game with a player who is not checked into the session, even for organizers", async () => {
    // Start session as host - only p-host is checked in
    const startRes = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    // Check in p-user2 and p-user3, but NOT p-user4
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user2" });
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user3" });

    // Host attempts to submit game including p-user4 (who is in group roster but not checked in)
    const submitRes = await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 11,
      team2Score: 7,
    });
    expect(submitRes.ok).toBe(false);
    if (!submitRes.ok) {
      expect(submitRes.error).toBe("All players in a game must be currently checked in to the open play session.");
    }

    // Now check in p-user4 and submit game successfully
    await addOpenPlayPlayerAction({ groupId: "g1", sessionId: startRes.data.id, playerId: "p-user4" });
    const successfulSubmitRes = await submitOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", "p-user4"],
      team1Score: 11,
      team2Score: 7,
    });
    expect(successfulSubmitRes.ok).toBe(true);
    if (!successfulSubmitRes.ok) return;

    // Add a new player to the group roster who is NOT checked in
    const newPlayer: PlayerRecord = {
      id: "p-not-checked-in",
      groupId: "g1",
      name: "Not Checked In",
      initialRating: 1200,
      rating: 1200,
      ratedGamesPlayed: 0,
      active: true,
    };
    await repository.createPlayer(newPlayer);

    // Attempt to update the game to swap in the un-checked-in player
    const updateRes = await updateOpenPlayGameAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      matchId: successfulSubmitRes.data.id,
      team1PlayerIds: ["p-host", "p-user2"],
      team2PlayerIds: ["p-user3", newPlayer.id],
      team1Score: 11,
      team2Score: 8,
    });
    expect(updateRes.ok).toBe(false);
    if (!updateRes.ok) {
      expect(updateRes.error).toBe("All players in a game must be currently checked in to the open play session.");
    }
  });
});


