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
} from "@/app/actions/open-play";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

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

    // Add guest player with selected rating (4.0 DUPR -> 1200 Elo)
    const addGuestRes = await addOpenPlayGuestAction({
      groupId: "g1",
      sessionId: startRes.data.id,
      guestName: "Guest Gary",
      initialRating: 4.0,
    });
    expect(addGuestRes.ok).toBe(true);
    if (!addGuestRes.ok) return;
    expect(addGuestRes.data.rating).toBe(1200);

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

  it("ends open play session and marks session and rounds completed", async () => {
    const startRes = await startOpenPlaySessionAction({ groupId: "g1" });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

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
    expect(delRes.data.status).toBe("cancelled");

    const rounds = await repository.listStartedRounds(startRes.data.id);
    const deletedMatch = rounds[0].matches.find((m) => m.id === gameRes.data.id);
    expect(deletedMatch?.status).toBe("cancelled");
  });
});


