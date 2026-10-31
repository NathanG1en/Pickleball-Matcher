import { beforeEach, describe, expect, it } from "vitest";
import {
  getPinnedPlayers,
  setPinnedPlayers,
  sortPlayersWithPinned,
  togglePinnedPlayer,
} from "@/lib/storage/pinned-players";

const mockStorage: Record<string, string> = {};
const storageMock: Storage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  },
  key: (index: number) => Object.keys(mockStorage)[index] || null,
  get length() {
    return Object.keys(mockStorage).length;
  },
};

describe("pinned-players storage and sorting", () => {
  beforeEach(() => {
    storageMock.clear();
    Object.defineProperty(globalThis, "window", {
      value: {
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        localStorage: storageMock,
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storageMock,
      writable: true,
      configurable: true,
    });
  });

  it("toggles and retrieves pinned players in localStorage per group", () => {
    const groupId = "grp_test_1";

    expect(getPinnedPlayers(groupId)).toEqual([]);

    const pinnedAlice = togglePinnedPlayer(groupId, "p1");
    expect(pinnedAlice).toBe(true);
    expect(getPinnedPlayers(groupId)).toEqual(["p1"]);

    const pinnedBob = togglePinnedPlayer(groupId, "p2");
    expect(pinnedBob).toBe(true);
    expect(getPinnedPlayers(groupId)).toContain("p1");
    expect(getPinnedPlayers(groupId)).toContain("p2");

    // Toggling Alice again unpins her
    const unpinnedAlice = togglePinnedPlayer(groupId, "p1");
    expect(unpinnedAlice).toBe(false);
    expect(getPinnedPlayers(groupId)).toEqual(["p2"]);
  });

  it("keeps pinned players isolated by groupId", () => {
    togglePinnedPlayer("grp_a", "p1");
    togglePinnedPlayer("grp_b", "p2");

    expect(getPinnedPlayers("grp_a")).toEqual(["p1"]);
    expect(getPinnedPlayers("grp_b")).toEqual(["p2"]);

    setPinnedPlayers("grp_a", ["p1", "p3"]);
    expect(getPinnedPlayers("grp_a")).toEqual(["p1", "p3"]);
    expect(getPinnedPlayers("grp_b")).toEqual(["p2"]);
  });

  it("sorts pinned players to the top while preserving alphabetical order within tiers", () => {
    const players = [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
      { id: "p3", name: "Charlie" },
      { id: "p4", name: "Dave" },
      { id: "p5", name: "Evan" },
    ];

    // Pin Dave (p4) and Bob (p2)
    const pinnedIds = new Set(["p4", "p2"]);
    const sorted = sortPlayersWithPinned(players, pinnedIds);

    // Pinned tier comes first (Bob, then Dave alphabetically)
    // Followed by unpinned tier (Alice, Charlie, Evan alphabetically)
    expect(sorted.map((p) => p.name)).toEqual([
      "Bob",
      "Dave",
      "Alice",
      "Charlie",
      "Evan",
    ]);
  });

  it("sorts selected players to top of pinned tier and above unpinned when selectedIds is provided", () => {
    const players = [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
      { id: "p3", name: "Charlie" },
      { id: "p4", name: "Dave" },
      { id: "p5", name: "Evan" },
      { id: "p6", name: "Frank" },
    ];

    // Pinned: Bob (p2), Dave (p4), Frank (p6)
    const pinnedIds = new Set(["p2", "p4", "p6"]);
    // Selected: Charlie (p3, unpinned), Dave (p4, pinned), Frank (p6, pinned)
    const selectedIds = new Set(["p3", "p4", "p6"]);

    const sorted = sortPlayersWithPinned(players, pinnedIds, selectedIds);

    // 1. Pinned & Selected: Dave, Frank
    // 2. Pinned & Unselected: Bob (still in pinned tier, below selected pinned)
    // 3. Unpinned & Selected: Charlie (above unpinned unselected)
    // 4. Unpinned & Unselected: Alice, Evan
    expect(sorted.map((p) => p.name)).toEqual([
      "Dave",
      "Frank",
      "Bob",
      "Charlie",
      "Alice",
      "Evan",
    ]);
  });
});
