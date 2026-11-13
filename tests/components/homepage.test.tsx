import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import * as actionContext from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { saveRecentGroup } from "@/lib/storage/recent-groups";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActiveOrganizerSession: vi.fn(),
    getActivePlayerAccountId: vi.fn(),
  };
});

const mockGuestGroups = vi.fn<() => Promise<Record<string, string>>>();
vi.mock("@/lib/auth/guest-session", () => ({
  getGuestGroupPlayerIds: () => mockGuestGroups(),
}));

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

describe("HomePage authentication states", () => {
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
    vi.mocked(actionContext.getActiveOrganizerSession).mockResolvedValue(null);
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(null);
    mockGuestGroups.mockResolvedValue({});
  });

  afterEach(() => {
    actionContext.setActionRepository(null);
    vi.clearAllMocks();
  });

  it("renders logged-out home page without device groups, with sign in and temporary group option", async () => {
    saveRecentGroup({ id: "grp-1", name: "Sunset Pickleballers" });

    const jsx = await HomePage();
    const html = renderToStaticMarkup(jsx);

    // Groups saved on device should NOT be visible when logged out
    expect(html).not.toContain("Sunset Pickleballers");
    expect(html).not.toContain("Your Group on this Device");

    // Sign in and temporary group options should be visible
    expect(html).toContain("Sign In to Play");
    expect(html).toContain("Create an Account");
    expect(html).toContain("Start a Quick Session");
    expect(html).not.toContain("Legacy organizer PIN sign in");

    // Elevated pickleball experience present, but feature slogans/boxes removed
    expect(html).toContain("An elevated pickleball experience.");
    expect(html).not.toContain("Equal Sits");
    expect(html).not.toContain("New Pairs");
    expect(html).not.toContain("Fair Games");
    expect(html).not.toContain("Even court time");
    expect(html).not.toContain("Partner variety");

    // Log out button should NOT be visible
    expect(html).not.toContain("Log Out");
  });

  it("renders logged-in home page with the account's groups, logout button, and hides temporary group option", async () => {
    saveRecentGroup({ id: "grp-1", name: "Sunset Pickleballers" });
    const repo = new InMemoryRepositories({
      groups: [
        {
          id: "grp-1",
          name: "Sunset Pickleballers",
          organizerPinHash: "pin-hash",
          createdAt: new Date(),
          ownerAccountId: "usr-1",
        },
      ],
      playerAccounts: [
        {
          id: "usr-1",
          username: "player1",
          name: "Player One",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    actionContext.setActionRepository(repo);
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("usr-1");

    const jsx = await HomePage();
    const html = renderToStaticMarkup(jsx);

    // The account's groups come from the server, not this device's history
    expect(html).toContain("Sunset Pickleballers");
    expect(html).toContain("Your groups");
    expect(html).toContain('href="/g/grp-1"');
    expect(html).not.toContain("Live now");

    // Action buttons when logged in
    expect(html).toContain("Create A Group");
    expect(html).toContain("Find Groups");
    expect(html).toContain("Find Players");
    expect(html).toContain("View Profile");
    expect(html).toContain("Log Out");

    // Order: View Profile -> Find Groups/Players -> Create A Group -> Log Out
    const viewProfileIdx = html.indexOf("View Profile");
    const findGroupsIdx = html.indexOf("Find Groups");
    const findPlayersIdx = html.indexOf("Find Players");
    const createGroupIdx = html.indexOf("Create A Group");
    const logoutIdx = html.indexOf("Log Out");

    expect(viewProfileIdx).toBeLessThan(findGroupsIdx);
    expect(findGroupsIdx).toBeLessThan(createGroupIdx);
    expect(findPlayersIdx).toBeLessThan(createGroupIdx);
    expect(createGroupIdx).toBeLessThan(logoutIdx);

    // Font weight: Find Groups, Find Players, and Log Out share the same font-bold weight
    expect(html).toMatch(/class="[^"]*font-bold[^"]*"[^>]*href="\/players\/groups"/);
    expect(html).toMatch(/class="[^"]*font-bold[^"]*"[^>]*href="\/players\/find"/);
    expect(html).toMatch(/class="[^"]*font-bold[^"]*"[^>]*>Log Out<\/button>/);

    // Sign In button, Make Temporary Group, and legacy PIN link should be GONE
    expect(html).not.toContain("Sign In to Play");
    expect(html).not.toContain("Start a Quick Session");
    expect(html).not.toContain("Legacy organizer PIN sign in");
  });

  it("does not render recent groups the player is not part of even if looked at and saved on device", async () => {
    saveRecentGroup({ id: "grp-other", name: "Other Pickleballers" });
    const repo = new InMemoryRepositories({
      groups: [
        {
          id: "grp-other",
          name: "Other Pickleballers",
          organizerPinHash: "pin-hash",
          createdAt: new Date(),
          ownerAccountId: "someone-else",
          isPublic: true,
        },
      ],
      playerAccounts: [
        {
          id: "usr-1",
          username: "player1",
          name: "Player One",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    actionContext.setActionRepository(repo);
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("usr-1");

    const jsx = await HomePage();
    const html = renderToStaticMarkup(jsx);

    expect(html).not.toContain("Other Pickleballers");
    expect(html).not.toContain("Your groups");
  });

  it("puts a live session first with a one-tap link to the player's court", async () => {
    const repo = new InMemoryRepositories({
      groups: [
        { id: "grp-1", name: "Sunset Pickleballers", organizerPinHash: "pin-hash", createdAt: new Date(), ownerAccountId: "usr-1" },
      ],
      playerAccounts: [
        { id: "usr-1", username: "player1", name: "Player One", passwordHash: "hash", skillLevel: "intermediate", initialRating: 1000, createdAt: new Date() },
      ],
      sessions: [
        { id: "ses-1", groupId: "grp-1", courtCount: 2, status: "active", currentRoundNumber: 3, startedAt: new Date(), endedAt: null, version: 4 },
      ],
    });
    actionContext.setActionRepository(repo);
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("usr-1");

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("Live now · Round 3 in play");
    expect(html).toContain('href="/g/grp-1/sessions/ses-1"');
    expect(html).toContain("See my court");
    expect(html.indexOf("Live now")).toBeLessThan(html.indexOf("FAIR ROUNDS"));
  });

  it("shows signed-out guests the groups they joined on this device", async () => {
    const repo = new InMemoryRepositories({
      groups: [
        { id: "grp-1", name: "Sunset Pickleballers", organizerPinHash: "pin-hash", createdAt: new Date(), ownerAccountId: "usr-1" },
        { id: "grp-2", name: "Left Behind", organizerPinHash: "pin-hash", createdAt: new Date(), ownerAccountId: "usr-1" },
      ],
      players: [
        { id: "ply-guest", groupId: "grp-1", name: "Alice", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, accountId: null },
        { id: "ply-gone", groupId: "grp-2", name: "Alice", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: false, accountId: null },
      ],
    });
    actionContext.setActionRepository(repo);
    mockGuestGroups.mockResolvedValue({ "grp-1": "ply-guest", "grp-2": "ply-gone" });

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("Your groups");
    expect(html).toContain("Sunset Pickleballers");
    // A guest removed from a roster no longer sees that group
    expect(html).not.toContain("Left Behind");
    expect(html).toContain("Sign In to Play");
  });
});

