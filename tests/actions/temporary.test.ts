import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveTemporaryGroupAction } from "@/app/actions/temporary";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { GroupRecord, PlayerAccountRecord, PlayerRecord } from "@/lib/domain/types";

const mockGetActivePlayerAccountId = vi.fn();

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActivePlayerAccountId: () => mockGetActivePlayerAccountId(),
    requirePlayer: async () => {
      const id = mockGetActivePlayerAccountId();
      if (!id) throw new Error("Authentication required");
      return id;
    },
  };
});

describe("saveTemporaryGroupAction", () => {
  let repository: InMemoryRepositories;
  const hostAccountId = "acc_host";
  const existingGroupId = "grp_existing";

  const hostAccount: PlayerAccountRecord = {
    id: hostAccountId,
    username: "hostplayer",
    name: "Host Player",
    passwordHash: "hash123",
    skillLevel: "intermediate",
    initialRating: 1200,
    rating: 1200,
    createdAt: new Date(),
  };

  const existingGroup: GroupRecord = {
    id: existingGroupId,
    name: "Sunset Club",
    organizerPinHash: "pin_hash",
    createdAt: new Date(),
    isPublic: true,
    ownerAccountId: hostAccountId,
  };

  const existingPlayerAlice: PlayerRecord = {
    id: "ply_alice",
    groupId: existingGroupId,
    name: "Alice",
    initialRating: 1200,
    rating: 1200,
    ratedGamesPlayed: 0,
    active: true,
    accountId: null,
  };

  beforeEach(() => {
    repository = new InMemoryRepositories({
      playerAccounts: [hostAccount],
      groups: [existingGroup],
      players: [existingPlayerAlice],
    });
    setActionRepository(repository);
    mockGetActivePlayerAccountId.mockReturnValue(hostAccountId);
  });

  afterEach(() => {
    setActionRepository(null);
    vi.clearAllMocks();
  });

  it("saves a quick session as a brand new group", async () => {
    const input = {
      name: "New Quick Group",
      isPublic: true,
      courtPlayerCounts: [4],
      players: [
        { id: "temp_1", name: "Host Player", rating: 1200 },
        { id: "temp_2", name: "Player Two", rating: 1000 },
        { id: "temp_3", name: "Player Three", rating: 1000 },
        { id: "temp_4", name: "Player Four", rating: 1000 },
      ],
      rounds: [
        {
          roundNumber: 1,
          seed: 42,
          courts: [
            {
              courtNumber: 1,
              team1: ["temp_1", "temp_2"],
              team2: ["temp_3", "temp_4"],
              team1Score: 11,
              team2Score: 7,
            },
          ],
          sitting: [],
        },
      ],
    };

    const result = await saveTemporaryGroupAction(input);
    expect(result.ok).toBe(true);
    expect(result.groupId).toBeDefined();

    const createdGroup = await repository.getGroup(result.groupId!);
    expect(createdGroup).toBeDefined();
    expect(createdGroup?.name).toBe("New Quick Group");

    const players = await repository.listPlayers(result.groupId!);
    expect(players).toHaveLength(4);

    const sessions = await repository.listSessions(result.groupId!);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("completed");
    expect(sessions[0].currentRoundNumber).toBe(1);
  });

  it("attaches a quick session to an existing organized group with explicit playerMappings", async () => {
    const input = {
      name: "Quick Session",
      isPublic: true,
      targetGroupId: existingGroupId,
      playerMappings: { temp_1: "ply_alice" }, // Explicitly merge into existingPlayerAlice
      courtPlayerCounts: [4],
      players: [
        { id: "temp_1", name: "Alice", rating: 1200 },
        { id: "temp_2", name: "Bob Newbie", rating: 1000 },
        { id: "temp_3", name: "Charlie New", rating: 1000 },
        { id: "temp_4", name: "Dave New", rating: 1000 },
      ],
      rounds: [
        {
          roundNumber: 1,
          seed: 123,
          courts: [
            {
              courtNumber: 1,
              team1: ["temp_1", "temp_2"],
              team2: ["temp_3", "temp_4"],
              team1Score: 11,
              team2Score: 9,
            },
          ],
          sitting: [],
        },
      ],
    };

    const result = await saveTemporaryGroupAction(input);
    expect(result.ok).toBe(true);
    expect(result.groupId).toBe(existingGroupId);

    // Group player count: 1 original (merged) + 3 new = 4 total
    const players = await repository.listPlayers(existingGroupId);
    expect(players).toHaveLength(4);

    const alice = players.find((p) => p.name === "Alice");
    expect(alice?.id).toBe("ply_alice"); // Merged into existing ID!

    const bob = players.find((p) => p.name === "Bob Newbie");
    expect(bob).toBeDefined();

    const sessions = await repository.listSessions(existingGroupId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].groupId).toBe(existingGroupId);
  });

  it("does not match players by name automatically if not mapped, creating new guest players", async () => {
    const input = {
      name: "Quick Session",
      isPublic: true,
      targetGroupId: existingGroupId,
      // No playerMappings provided
      courtPlayerCounts: [4],
      players: [
        { id: "temp_1", name: "Alice", rating: 1200 }, // Same name as existing player
        { id: "temp_2", name: "Bob Newbie", rating: 1000 },
        { id: "temp_3", name: "Charlie New", rating: 1000 },
        { id: "temp_4", name: "Dave New", rating: 1000 },
      ],
      rounds: [],
    };

    const result = await saveTemporaryGroupAction(input);
    expect(result.ok).toBe(true);

    // Group player count: 1 original Alice + 4 new players = 5 total
    const players = await repository.listPlayers(existingGroupId);
    expect(players).toHaveLength(5);

    const alicePlayers = players.filter((p) => p.name === "Alice");
    expect(alicePlayers).toHaveLength(2); // Original ply_alice + new guest Alice
  });

  it("fails when attempting to attach to a group the user does not organize", async () => {
    mockGetActivePlayerAccountId.mockReturnValue("acc_unauthorized");

    const input = {
      name: "Quick Session",
      isPublic: true,
      targetGroupId: existingGroupId,
      courtPlayerCounts: [4],
      players: [
        { id: "temp_1", name: "Player 1", rating: 1000 },
        { id: "temp_2", name: "Player 2", rating: 1000 },
        { id: "temp_3", name: "Player 3", rating: 1000 },
        { id: "temp_4", name: "Player 4", rating: 1000 },
      ],
      rounds: [],
    };

    const result = await saveTemporaryGroupAction(input);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("You do not have permission");
  });
});

