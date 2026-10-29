import { beforeEach, describe, expect, it, vi } from "vitest";
import { duplicateSessionAction, changeAttendanceAction } from "@/app/actions/sessions";
import { addOpenPlayPlayerAction, removeOpenPlayPlayerAction } from "@/app/actions/open-play";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { SessionRecord, PlayerRecord } from "@/lib/domain/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockOrganizerAllowed = true;

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    requireOrganizer: vi.fn(async () => {
      if (!mockOrganizerAllowed) {
        throw new Error("Organizer authorization required.");
      }
      return null;
    }),
  };
});

describe("duplicateSessionAction", () => {
  let repository: InMemoryRepositories;

  const samplePlayers: PlayerRecord[] = [
    { id: "p1", groupId: "g1", name: "Player 1", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p2", groupId: "g1", name: "Player 2", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p3", groupId: "g1", name: "Player 3", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p4", groupId: "g1", name: "Player 4", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p5", groupId: "g1", name: "Player 5 (Inactive)", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: false },
  ];

  const sampleRegularSession: SessionRecord = {
    id: "ses_regular",
    groupId: "g1",
    courtCount: 1,
    courtPlayerCounts: [4],
    status: "completed",
    currentRoundNumber: 2,
    startedAt: new Date("2026-09-01T10:00:00Z"),
    endedAt: new Date("2026-09-01T11:00:00Z"),
    version: 3,
    type: "regular",
    name: "Old Tournament Name",
  };

  const sampleOpenPlaySession: SessionRecord = {
    id: "ses_open_play",
    groupId: "g1",
    courtCount: 1,
    courtPlayerCounts: [4],
    status: "completed",
    currentRoundNumber: 1,
    startedAt: new Date("2026-09-01T10:00:00Z"),
    endedAt: new Date("2026-09-01T12:00:00Z"),
    version: 2,
    type: "open_play",
    name: "Old Open Play",
  };

  beforeEach(() => {
    mockOrganizerAllowed = true;
    repository = new InMemoryRepositories({
      groups: [{ id: "g1", name: "Pickle Club", organizerPinHash: "pin", createdAt: new Date() }],
      players: samplePlayers,
      sessions: [
        structuredClone(sampleRegularSession),
        structuredClone(sampleOpenPlaySession),
      ],
      rounds: [],
      matches: [],
      matchPlayers: [],
      attendance: [
        // For regular session: p1, p2, p3 stayed until end (leftRound: null)
        // p4 left at round 2 (leftRound: 2)
        // p5 is inactive (leftRound: null)
        { sessionId: "ses_regular", playerId: "p1", joinedRound: 1, leftRound: null },
        { sessionId: "ses_regular", playerId: "p2", joinedRound: 1, leftRound: null },
        { sessionId: "ses_regular", playerId: "p3", joinedRound: 1, leftRound: null },
        { sessionId: "ses_regular", playerId: "p4", joinedRound: 1, leftRound: 2 },
        { sessionId: "ses_regular", playerId: "p5", joinedRound: 1, leftRound: null },

        // For open play session: p1 and p2 checked in (leftRound: null), p3 left (leftRound: 1)
        { sessionId: "ses_open_play", playerId: "p1", joinedRound: 1, leftRound: null },
        { sessionId: "ses_open_play", playerId: "p2", joinedRound: 1, leftRound: null },
        { sessionId: "ses_open_play", playerId: "p3", joinedRound: 1, leftRound: 1 },
      ],
    });
    setActionRepository(repository);
  });

  it("duplicates a normal session with attendance from the end of the session and no stored date-based custom name", async () => {
    const result = await duplicateSessionAction({
      groupId: "g1",
      sessionId: "ses_regular",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const newSession = result.data;
    expect(newSession.id).not.toBe("ses_regular");
    expect(newSession.groupId).toBe("g1");
    expect(newSession.status).toBe("active");
    expect(newSession.currentRoundNumber).toBe(0);
    expect(newSession.type).toBe("regular");

    // Default date labels must be calculated in the viewer’s browser, not stored as server-local names.
    expect(newSession.name).toBeNull();

    // Verify attendance: p1, p2, p3 were attending at the end.
    // p4 left at round 2 so should NOT be included.
    // p5 is inactive so should NOT be included.
    const newAttendance = await repository.listAttendance(newSession.id);
    expect(newAttendance.map((a) => a.playerId).sort()).toEqual(["p1", "p2", "p3"]);
    for (const a of newAttendance) {
      expect(a.joinedRound).toBe(1);
      expect(a.leftRound).toBeNull();
    }

    // Verify people can still be added and marked as attended/left
    const addResult = await changeAttendanceAction({
      groupId: "g1",
      sessionId: newSession.id,
      playerId: "p4",
      present: true,
      sessionVersion: newSession.version,
      idempotencyKey: "test_key_add_p4",
    });
    expect(addResult.ok).toBe(true);

    const updatedAttendance = await repository.listAttendance(newSession.id);
    const p4Att = updatedAttendance.find((a) => a.playerId === "p4");
    expect(p4Att).toBeDefined();
    expect(p4Att?.leftRound).toBeNull();

    // Mark p1 as left
    const leaveResult = await changeAttendanceAction({
      groupId: "g1",
      sessionId: newSession.id,
      playerId: "p1",
      present: false,
      sessionVersion: newSession.version,
      idempotencyKey: "test_key_leave_p1",
    });
    expect(leaveResult.ok).toBe(true);
    const afterLeaveAtt = await repository.listAttendance(newSession.id);
    const p1Att = afterLeaveAtt.find((a) => a.playerId === "p1");
    expect(p1Att?.leftRound).not.toBeNull();
  });

  it("duplicates an open play session with who was checked in and no stored date-based custom name", async () => {
    const result = await duplicateSessionAction({
      groupId: "g1",
      sessionId: "ses_open_play",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const newSession = result.data;
    expect(newSession.id).not.toBe("ses_open_play");
    expect(newSession.groupId).toBe("g1");
    expect(newSession.status).toBe("active");
    expect(newSession.currentRoundNumber).toBe(1);
    expect(newSession.type).toBe("open_play");

    expect(newSession.name).toBeNull();

    // p1 and p2 were checked in. p3 had left.
    const newAttendance = await repository.listAttendance(newSession.id);
    expect(newAttendance.map((a) => a.playerId).sort()).toEqual(["p1", "p2"]);
    for (const a of newAttendance) {
      expect(a.leftRound).toBeNull();
    }

    // Round 1 was started
    const rounds = await repository.listStartedRounds(newSession.id);
    expect(rounds.length).toBe(1);
    expect(rounds[0].round.status).toBe("started");

    // People can still be added / removed in open play
    const addP3Result = await addOpenPlayPlayerAction({
      groupId: "g1",
      sessionId: newSession.id,
      playerId: "p3",
    });
    expect(addP3Result.ok).toBe(true);

    const attAfterAdd = await repository.listAttendance(newSession.id);
    const p3Att = attAfterAdd.find((a) => a.playerId === "p3");
    expect(p3Att?.leftRound).toBeNull();

    // Remove p1
    const removeP1Result = await removeOpenPlayPlayerAction({
      groupId: "g1",
      sessionId: newSession.id,
      playerId: "p1",
    });
    expect(removeP1Result.ok).toBe(true);
    const attAfterRemove = await repository.listAttendance(newSession.id);
    const p1Att = attAfterRemove.find((a) => a.playerId === "p1");
    expect(p1Att?.leftRound).not.toBeNull();
  });

  it("fails to duplicate if an active session is already in progress for the group", async () => {
    // Add an active session to group
    await repository.insertSession(
      {
        id: "active_ses",
        groupId: "g1",
        courtCount: 1,
        status: "active",
        currentRoundNumber: 1,
        startedAt: new Date(),
        endedAt: null,
        version: 1,
        type: "regular",
      },
      [],
    );

    const result = await duplicateSessionAction({
      groupId: "g1",
      sessionId: "ses_regular",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("An active session is already in progress");
    }
  });

  it("fails if session does not exist or does not belong to group", async () => {
    const notFound = await duplicateSessionAction({
      groupId: "g1",
      sessionId: "non_existent",
    });
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) {
      expect(notFound.error).toBe("Session not found.");
    }

    const wrongGroup = await duplicateSessionAction({
      groupId: "other_group",
      sessionId: "ses_regular",
    });
    expect(wrongGroup.ok).toBe(false);
    if (!wrongGroup.ok) {
      expect(wrongGroup.error).toBe("Session not found.");
    }
  });

  it("fails if caller is not an organizer", async () => {
    mockOrganizerAllowed = false;
    const result = await duplicateSessionAction({
      groupId: "g1",
      sessionId: "ses_regular",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Organizer authorization required");
    }
  });

  it("fails to duplicate a normal session if fewer than 2 players are attending at the end", async () => {
    // Create a completed session with only 1 attending player
    await repository.insertSession(
      {
        id: "ses_one_player",
        groupId: "g1",
        courtCount: 1,
        status: "completed",
        currentRoundNumber: 1,
        startedAt: new Date(),
        endedAt: new Date(),
        version: 1,
        type: "regular",
      },
      [{ sessionId: "ses_one_player", playerId: "p1", joinedRound: 1, leftRound: null }],
    );

    const result = await duplicateSessionAction({
      groupId: "g1",
      sessionId: "ses_one_player",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("at least 2 attending players are required");
    }
  });
});

