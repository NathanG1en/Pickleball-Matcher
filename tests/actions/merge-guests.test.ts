import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeGuestPlayersAction } from "@/app/actions/players";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { GroupRecord, PlayerRecord, SessionRecord } from "@/lib/domain/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetActivePlayerAccountId = vi.fn();
const mockGetActiveOrganizerSession = vi.fn();

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActivePlayerAccountId: () => mockGetActivePlayerAccountId(),
    getActiveOrganizerSession: () => mockGetActiveOrganizerSession(),
  };
});

describe("mergeGuestPlayersAction", () => {
  let repository: InMemoryRepositories;
  const groupId = "grp_test";
  const hostAccountId = "acc_host";

  const group: GroupRecord = {
    id: groupId,
    name: "Pickle Champions",
    organizerPinHash: "hash123",
    createdAt: new Date(),
    isPublic: true,
    ownerAccountId: hostAccountId,
  };

  const guestA: PlayerRecord = {
    id: "ply_guest_a",
    groupId,
    name: "Guest Alice",
    initialRating: 1000,
    rating: 1000,
    ratedGamesPlayed: 0,
    active: true,
    accountId: null,
  };

  const guestB: PlayerRecord = {
    id: "ply_guest_b",
    groupId,
    name: "Guest Alyce",
    initialRating: 1000,
    rating: 1050,
    ratedGamesPlayed: 1,
    active: true,
    accountId: null,
  };

  const memberC: PlayerRecord = {
    id: "ply_member_c",
    groupId,
    name: "Member Charlie",
    initialRating: 1200,
    rating: 1200,
    ratedGamesPlayed: 5,
    active: true,
    accountId: "acc_charlie",
  };

  const session1: SessionRecord = {
    id: "sess_1",
    groupId,
    courtCount: 1,
    status: "completed",
    currentRoundNumber: 1,
    startedAt: new Date("2026-01-01T10:00:00Z"),
    endedAt: new Date("2026-01-01T11:00:00Z"),
    version: 1,
    type: "regular",
    name: null,
  };

  beforeEach(() => {
    mockGetActivePlayerAccountId.mockReset();
    mockGetActiveOrganizerSession.mockReset();
    repository = new InMemoryRepositories({
      groups: [{ ...group }],
      players: [{ ...guestA }, { ...guestB }, { ...memberC }],
      sessions: [{ ...session1 }],
      attendance: [
        { sessionId: "sess_1", playerId: "ply_guest_a", joinedRound: 1, leftRound: null },
        { sessionId: "sess_1", playerId: "ply_guest_b", joinedRound: 1, leftRound: null },
      ],
      rounds: [],
      matches: [],
      matchPlayers: [],
      roundSits: [],
      groupOrganizers: [],
      playerAccounts: [
        {
          id: hostAccountId,
          username: "host",
          name: "Host User",
          isPublic: true,
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);
  });

  afterEach(() => {
    setActionRepository(null);
  });

  it("fails if caller is not an organizer or host", async () => {
    mockGetActivePlayerAccountId.mockResolvedValue("someone_else");

    const result = await mergeGuestPlayersAction({
      groupId,
      targetPlayerId: "ply_guest_a",
      sourcePlayerIds: ["ply_guest_b"],
      mergedName: "Alice Combined",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Only the host or a group organizer");
    }
  });

  it("fails if target player or source player is a registered account member", async () => {
    mockGetActivePlayerAccountId.mockResolvedValue(hostAccountId);

    const result = await mergeGuestPlayersAction({
      groupId,
      targetPlayerId: "ply_member_c",
      sourcePlayerIds: ["ply_guest_a"],
      mergedName: "Charlie Merged",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Registered account players cannot be merged as guests");
    }

    const result2 = await mergeGuestPlayersAction({
      groupId,
      targetPlayerId: "ply_guest_a",
      sourcePlayerIds: ["ply_member_c"],
      mergedName: "Alice Merged",
    });

    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.error).toContain("Registered account players cannot be merged as guests");
    }
  });

  it("successfully merges guest profiles, combines session attendance, and removes duplicates", async () => {
    mockGetActivePlayerAccountId.mockResolvedValue(hostAccountId);

    const result = await mergeGuestPlayersAction({
      groupId,
      targetPlayerId: "ply_guest_a",
      sourcePlayerIds: ["ply_guest_b"],
      mergedName: "Alice Combined",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Alice Combined");
      expect(result.data.id).toBe("ply_guest_a");
    }

    // Guest B should be removed from players
    const players = await repository.listPlayers(groupId, { includeInactive: true });
    expect(players.find((p) => p.id === "ply_guest_b")).toBeUndefined();

    // Guest A should have the updated name
    const surviving = players.find((p) => p.id === "ply_guest_a");
    expect(surviving?.name).toBe("Alice Combined");

    // Attendance should be merged without duplicate (session_id, player_id)
    const attendances = await repository.listAttendance("sess_1");
    expect(attendances).toHaveLength(1);
    expect(attendances[0].playerId).toBe("ply_guest_a");
  });
});

