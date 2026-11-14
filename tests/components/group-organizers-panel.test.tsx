import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupOrganizersPanel, getRemoveGuestConfirmationMessage } from "@/components/groups/group-organizers-panel";
import {
  addGroupOrganizerAction,
  addGroupPlayerByUsernameAction,
  removeGroupOrganizerAction,
  removeGroupPlayerAction,
  transferGroupHostAction,
} from "@/app/actions/group-organizers";
import {
  addPlayerByAccountIdAction,
  createPlayerAction,
  linkGuestPlayerAction,
} from "@/app/actions/players";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import * as actionContext from "@/app/actions/action-context";
import type { GroupOrganizerPermissionKey, GroupOrganizerRecord, PlayerRecord } from "@/lib/domain/types";
import { AuthorizationError } from "@/lib/auth/authorize";
import { parseGroupOrganizerPermissions } from "@/lib/auth/group-permissions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  const mockGetActivePlayerAccountId = vi.fn();
  const mockGetActiveOrganizerSession = vi.fn();
  const mockRequirePlayer = vi.fn();
  return {
    ...actual,
    getActivePlayerAccountId: mockGetActivePlayerAccountId,
    getActiveOrganizerSession: mockGetActiveOrganizerSession,
    requirePlayer: mockRequirePlayer,
    requireGroupPermission: vi.fn(async (groupId: string, permission: GroupOrganizerPermissionKey) => {
      const repository = actual.getActionRepository();
      const group = await repository.getGroup(groupId);
      if (!group) throw new Error("Group not found");
      let accountId: string | null = null;
      try {
        accountId = (await mockRequirePlayer()) ?? null;
      } catch {
        accountId = null;
      }
      if (!accountId) {
        try {
          accountId = (await mockGetActivePlayerAccountId()) ?? null;
        } catch {
          accountId = null;
        }
      }
      const isHost = Boolean(accountId && group.ownerAccountId === accountId);
      if (isHost) return { group, accountId, isHost: true };
      const isOrg = Boolean(accountId && (await repository.isGroupOrganizer(groupId, accountId)));
      const session = await mockGetActiveOrganizerSession();
      const isSessionOrg = Boolean(session && session.groupId === groupId);
      if (!isOrg && !isSessionOrg) throw new AuthorizationError();
      const perms = parseGroupOrganizerPermissions(group.organizerPermissions);
      if (!perms[permission]) throw new AuthorizationError();
      return { group, accountId, isHost: false };
    }),
    requireGroupHost: vi.fn(async (groupId: string) => {
      let accountId: string | null = null;
      try {
        accountId = (await mockRequirePlayer()) ?? (await mockGetActivePlayerAccountId()) ?? null;
      } catch {
        accountId = null;
      }
      if (!accountId) throw new Error("Not signed in");
      const repository = actual.getActionRepository();
      const group = await repository.getGroup(groupId);
      if (!group) throw new Error("Group not found");
      if (group.ownerAccountId !== accountId) {
        throw new AuthorizationError();
      }
      return { group, accountId };
    }),
    requireOrganizer: vi.fn(async (groupId: string) => {
      const accountId = await mockGetActivePlayerAccountId();
      if (accountId && (await actual.getActionRepository().isGroupOrganizer(groupId, accountId))) {
        return null;
      }
      const session = await mockGetActiveOrganizerSession();
      if (session && session.groupId === groupId) {
        return session;
      }
      throw new Error("Not authorized");
    }),
  };
});

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

describe("GroupOrganizersPanel and Actions", () => {
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

  const hostAccountId = "acc_host";
  const orgAccountId = "acc_org";
  const memberAccountId = "acc_member";

  const sampleOrganizers: readonly GroupOrganizerRecord[] = [
    { accountId: hostAccountId, username: "host_user", name: "Host Player", isHost: true },
    { accountId: orgAccountId, username: "org_user", name: "Organizer Player", isHost: false },
  ];

  const samplePlayers: readonly PlayerRecord[] = [
    {
      id: "p1",
      groupId: "g1",
      name: "Host Player",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
      accountId: hostAccountId,
      username: "host_user",
    },
    {
      id: "p2",
      groupId: "g1",
      name: "Organizer Player",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
      accountId: orgAccountId,
      username: "org_user",
    },
    {
      id: "p3",
      groupId: "g1",
      name: "Regular Member",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
      accountId: memberAccountId,
      username: "member_user",
    },
    {
      id: "p4",
      groupId: "g1",
      name: "Guest Player",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
      accountId: null,
    },
  ];

  afterEach(() => {
    setActionRepository(null);
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders players without active/inactive label, and shows Make Organizer and Remove player options for host", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={true}
        />
      );

      // Verify username formatting
      expect(html).toContain("Host Player");
      expect(html).toContain('href="/players/host_user"');
      expect(html).toContain("@host_user");
      expect(html).toContain("Organizer Player");
      expect(html).toContain('href="/players/org_user"');
      expect(html).toContain("@org_user");
      expect(html).toContain("Regular Member");
      expect(html).toContain('href="/players/member_user"');
      expect(html).toContain("@member_user");
      expect(html).toContain("Guest Player");
      expect(html).not.toContain("Guest Player (@");
      expect(html).toContain("View profile");
      expect(html).toContain(
        'class="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"'
      );
      expect(html).not.toContain("text-xs font-black uppercase hover:bg-[#ccff00]");

      // Verify active/inactive text was removed
      expect(html).not.toContain("· Active");
      expect(html).not.toContain("· Inactive");

      // Verify labels are rendered with player profile styling
      expect(html).toContain("Host");
      expect(html).toContain("Organizer");
      expect(html).toContain("rounded-md border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 bg-[#fde047]");

      // Verify player ratings are displayed on decimal scale rather than raw 1000s Elo
      expect(html).toContain("3.5");
      expect(html).not.toContain("DUPR");
      expect(html).not.toContain("Advanced Intermediate");
      expect(html).toContain("0 games");
      expect(html).not.toContain("Rating: 1000");

      // Verify "Remove organizer" button exists for delegated organizer
      expect(html).toContain("Remove organizer");
      // Verify "Transfer host" button exists for delegated organizer
      expect(html).toContain("Transfer host");
      // Verify "Make a group organizer" button exists for regular member
      expect(html).toContain("Make a group organizer");
      // Verify "Remove player" button exists in the dropdown with destructive red styling
      expect(html).toContain("Remove player");
      expect(html).toContain("text-[#E32929]");
      expect(html).toContain("data-player-menu");
      expect(html).toContain("data-player-menu-dropdown");
      expect(html).toContain('role="separator"');
      expect(html).toContain("rounded-[20px]");
      expect(html).toContain("border-[2.5px]");
      expect(html).toContain("bg-[#FFFDF6]");

      // Verify Link to public player and Edit guest option exists for guest player
      expect(html).toContain("Link to public player");
      expect(html).toContain("Edit guest");

      // Verify Find Player, Add Guest, and separate Add Player or Guest section exist for host
      expect(html).toContain("Add Player or Guest");
      expect(html).toContain('aria-label="Add player or guest"');
      expect(html).toContain('aria-label="Group roster"');
      expect(html).toContain("Find Player");
      expect(html).toContain("Add Guest");
      expect(html).toContain("Find player by username");
    });

    it("masks rating and gender for a private player on group roster and only shows games played when viewed by another user", () => {
      const privatePlayer: PlayerRecord = {
        id: "p_priv",
        groupId: "g1",
        name: "Private Member",
        initialRating: 1000,
        rating: 1250,
        ratedGamesPlayed: 7,
        active: true,
        accountId: "acc_priv",
        username: "priv_user",
        gender: "female",
        isPublic: false,
        visibilitySettings: {
          profile: "only_you",
          activities: "only_you",
          ratingStats: "only_you",
          chemistry: "only_you",
          groups: "only_you",
        },
      };

      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={[privatePlayer]}
          organizers={sampleOrganizers}
          isHost={true}
          currentAccountId="acc_viewer"
        />
      );

      expect(html).toContain("Private Member");
      expect(html).toContain("@priv_user");
      expect(html).toContain("7 games");
      expect(html).not.toContain("Rating:");
      expect(html).not.toContain("female");
    });

    it("shows rating and gender for a private player on group roster when viewed by that player themselves", () => {
      const privatePlayer: PlayerRecord = {
        id: "p_priv",
        groupId: "g1",
        name: "Private Member",
        initialRating: 1000,
        rating: 1250,
        ratedGamesPlayed: 7,
        active: true,
        accountId: "acc_priv",
        username: "priv_user",
        gender: "female",
        isPublic: false,
        visibilitySettings: {
          profile: "only_you",
          activities: "only_you",
          ratingStats: "only_you",
          chemistry: "only_you",
          groups: "only_you",
        },
      };

      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={[privatePlayer]}
          organizers={sampleOrganizers}
          isHost={false}
          currentAccountId="acc_priv"
        />
      );

      expect(html).toContain("Private Member");
      expect(html).toContain("@priv_user");
      expect(html).toContain("Rating:");
      expect(html).toContain("female");
      expect(html).toContain("7 games");
    });

    it("renders add player/guest, link guest, and remove player options for group organizers, but not make organizer", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={false}
          isOrganizer={true}
        />
      );

      expect(html).toContain("Regular Member");
      expect(html).toContain('href="/players/member_user"');
      expect(html).toContain("@member_user");
      expect(html).toContain("···");
      expect(html).toContain("h-7 w-7");
      expect(html).toContain("Remove player");
      expect(html).toContain("Link to public player");
      expect(html).toContain("Edit guest");
      expect(html).not.toContain("Make a group organizer");
      expect(html).not.toContain("Remove organizer");
      expect(html).not.toContain("Transfer host");

      // Verify Find Player, Add Guest, and separate Add Player or Guest section exist for organizers
      expect(html).toContain("Add Player or Guest");
      expect(html).toContain('aria-label="Add player or guest"');
      expect(html).toContain('aria-label="Group roster"');
      expect(html).toContain("Find Player");
      expect(html).toContain("Add Guest");
      expect(html).toContain("Find player by username");
    });

    it("renders Link to public player for guest players, and omits make organizer for guests", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={[
            {
              id: "guest1",
              groupId: "g1",
              name: "Only Guest",
              initialRating: 1000,
              rating: 1000,
              ratedGamesPlayed: 0,
              active: true,
              accountId: null,
            },
          ]}
          organizers={[]}
          isHost={true}
        />
      );

      expect(html).toContain("Link to public player");
      expect(html).toContain("Edit guest");
      expect(html).toContain("Merge with another guest player");
      expect(html).toContain("Remove player");
      expect(html).not.toContain("Make a group organizer");
    });

    it("formats guest removal confirmation message correctly for 0, 1, and multiple games played", () => {
      expect(getRemoveGuestConfirmationMessage("Bob", 0)).toBe(
        'Are you sure you want to remove "Bob"? They have played 0 games.'
      );
      expect(getRemoveGuestConfirmationMessage("Bob", 1)).toBe(
        'Are you sure you want to remove "Bob"? They have played 1 game.'
      );
      expect(getRemoveGuestConfirmationMessage("Bob", 7)).toBe(
        'Are you sure you want to remove "Bob"? They have played 7 games.'
      );
    });

    it("renders dismissable guest description banner with dismiss button in guest add mode", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={true}
          initialAddMode="guest"
        />
      );

      expect(html).toContain('data-testid="guest-description-banner"');
      expect(html).toContain("Guests don&#x27;t need an account to play, but their sessions won&#x27;t be saved.");
      expect(html).toContain('data-testid="dismiss-guest-desc-button"');
      expect(html).toContain('aria-label="Dismiss guest description"');
    });

    it("hides guest description banner when dismissed in sessionStorage", () => {
      const originalSessionStorage = globalThis.sessionStorage;
      const storageMap = new Map<string, string>();
      storageMap.set("pickleball_dismiss_guest_desc", "true");

      Object.defineProperty(globalThis, "sessionStorage", {
        value: {
          getItem: (key: string) => storageMap.get(key) ?? null,
          setItem: (key: string, val: string) => storageMap.set(key, val),
          removeItem: (key: string) => storageMap.delete(key),
        },
        writable: true,
        configurable: true,
      });

      try {
        const html = renderToStaticMarkup(
          <GroupOrganizersPanel
            groupId="g1"
            players={samplePlayers}
            organizers={sampleOrganizers}
            isHost={true}
            initialAddMode="guest"
          />
        );

        expect(html).not.toContain('data-testid="guest-description-banner"');
      } finally {
        Object.defineProperty(globalThis, "sessionStorage", {
          value: originalSessionStorage,
          writable: true,
          configurable: true,
        });
      }
    });

    it("does not render the legacy alert box inside add player container", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={true}
        />
      );

      expect(html).not.toContain("bg-[#ccff00]/40");
      expect(html).not.toContain("p-2 rounded-lg border border-black/40");
    });

    it("renders player search without an Add button next to input and without Dismiss in results, formatting results as name (@username)", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={true}
          initialAddMode="search"
          initialSearchUsername="alice"
          initialSearchResults={[
            {
              accountId: "acc_alice",
              username: "alice",
              name: "Alice Smith",
              isPublic: true,
              isRestricted: false,
              alreadyInGroup: false,
              rating: 1200,
            },
          ]}
        />
      );

      // Search input is present
      expect(html).toContain('id="roster-player-username"');
      expect(html).toContain('placeholder="Find player by username"');

      // No Add button next to the search input in the search form
      expect(html).not.toContain('<button type="submit"');

      // No Dismiss button in the search results header
      expect(html).not.toContain("Dismiss");

      // Public Accounts header is rendered
      expect(html).toContain("Public Accounts (1)");

      // Search result item displays name and (@username)
      expect(html).toContain("Alice Smith");
      expect(html).toContain("(@alice)");

      // Search result item has its own Add button
      expect(html).toContain(">Add</button>");
    });

    it("does not render Link to public player for players who already have an account", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={[
            {
              id: "p_acc",
              groupId: "g1",
              name: "Account Player",
              initialRating: 1000,
              rating: 1000,
              ratedGamesPlayed: 0,
              active: true,
              accountId: "some_acc",
              username: "acc_user",
            },
          ]}
          organizers={[]}
          isHost={true}
        />
      );

      expect(html).toContain("Make a group organizer");
      expect(html).not.toContain("Link to public player");
      expect(html).not.toContain("Edit guest");
      expect(html).not.toContain("Merge with another guest player");
    });

    it("does not render organizer options when user is not the host or organizer", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={false}
          isOrganizer={false}
        />
      );

      expect(html).toContain("Host Player");
      expect(html).toContain('href="/players/host_user"');
      expect(html).toContain("@host_user");
      expect(html).toContain("Organizer Player");
      expect(html).toContain('href="/players/org_user"');
      expect(html).toContain("@org_user");
      expect(html).toContain("View profile");
      expect(html).not.toContain("Remove organizer");
      expect(html).not.toContain("Make a group organizer");
      expect(html).not.toContain("Link to public player");
      expect(html).not.toContain("Edit guest");
      expect(html).not.toContain("Remove player");
      expect(html).not.toContain("···");
      expect(html).not.toContain("Find Player");
      expect(html).not.toContain("Add Guest");
      expect(html).not.toContain("Add Player or Guest");
      expect(html).not.toContain('aria-label="Add player or guest"');
      expect(html).toContain('aria-label="Group roster"');
    });

    it("renders roster search, filter, and sort controls on the group page", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={true}
        />
      );

      // Search input
      expect(html).toContain('data-testid="roster-search-input"');
      expect(html).toContain('placeholder="Search roster by name or @username..."');

      // Filter select and options
      expect(html).toContain('data-testid="roster-filter-select"');
      expect(html).toContain("All (4)");
      expect(html).toContain("Pinned (0)");
      expect(html).toContain("Organizers (2)");
      expect(html).toContain("Members (3)");
      expect(html).toContain("Guests (1)");

      // Sort select and options
      expect(html).toContain('data-testid="roster-sort-select"');
      expect(html).toContain("Name (A–Z)");
      expect(html).toContain("Name (Z–A)");
      expect(html).toContain("Rating (High–Low)");
      expect(html).toContain("Rating (Low–High)");
      expect(html).toContain("Most Games");
      expect(html).toContain("Least Games");
    });

    it("renders pin buttons for organizers and host, and sorts pinned players to the top", () => {
      // Pin Guest Player (p4) via localStorage
      localStorage.setItem("pickleball_pinned_players_g1", JSON.stringify(["p4"]));

      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={true}
        />
      );

      // Pin buttons exist for host/organizer
      expect(html).toContain('data-testid="pin-player-Guest Player"');
      expect(html).toContain('data-testid="pin-player-Host Player"');

      // Guest Player is pinned: button turns black with lime icon
      expect(html).toContain('aria-label="Unpin Guest Player"');
      expect(html).toContain('title="Unpin player"');
      expect(html).toContain("bg-black text-[#ccff00]");

      // Host Player is not pinned: button is white/neutral
      expect(html).toContain('aria-label="Pin Host Player to top"');
      expect(html).toContain('title="Pin player to top"');

      // Pinned Guest Player appears before Host Player in the rendered list
      const guestIdx = html.indexOf('data-testid="roster-player-row-Guest Player"');
      const hostIdx = html.indexOf('data-testid="roster-player-row-Host Player"');
      expect(guestIdx).toBeGreaterThan(-1);
      expect(hostIdx).toBeGreaterThan(-1);
      expect(guestIdx).toBeLessThan(hostIdx);

      // Pinned count reflects pinned player
      expect(html).toContain("Pinned (1)");

      // Option in dropdown menu
      expect(html).toContain("Unpin player");
      expect(html).toContain("Pin player");

      localStorage.removeItem("pickleball_pinned_players_g1");
    });

    it("clearly separates the adding player/guest section from the roster directory", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={true}
        />
      );

      // Verify Add Player or Guest section header and description
      expect(html).toContain("Add Player or Guest");
      expect(html).toContain('aria-label="Add player or guest"');
      expect(html).toContain('aria-label="Collapse add player or guest form"');
      expect(html).not.toContain(">Collapse<");
      expect(html).not.toContain(">Expand<");
      expect(html).toContain("rotate-180");

      // Verify Roster Directory section header
      expect(html).toContain("Roster (4)");
      expect(html).not.toContain("Players and group organizers.");
      expect(html).toContain('aria-label="Group roster"');

      // Verify Add section appears before Roster section
      const addSectionIdx = html.indexOf('aria-label="Add player or guest"');
      const rosterSectionIdx = html.indexOf('aria-label="Group roster"');
      expect(addSectionIdx).toBeGreaterThan(-1);
      expect(rosterSectionIdx).toBeGreaterThan(addSectionIdx);

      // Verify search input is inside the Roster section
      const searchInputIdx = html.indexOf('data-testid="roster-search-input"');
      expect(searchInputIdx).toBeGreaterThan(rosterSectionIdx);
    });
  });

  describe("removeGroupOrganizerAction", () => {
    let repository: InMemoryRepositories;

    beforeEach(() => {
      repository = new InMemoryRepositories({
        groups: [
          {
            id: "g1",
            name: "Test Group",
            organizerPinHash: "hash",
            createdAt: new Date(),
            isPublic: true,
            ownerAccountId: hostAccountId,
          },
        ],
        playerAccounts: [
          {
            id: hostAccountId,
            username: "host_user",
            name: "Host Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: orgAccountId,
            username: "org_user",
            name: "Organizer Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
        ],
        groupOrganizers: [
          { groupId: "g1", accountId: orgAccountId },
        ],
        players: [
          {
            id: "p1",
            groupId: "g1",
            name: "Host Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: hostAccountId,
            username: "host_user",
          },
          {
            id: "p2",
            groupId: "g1",
            name: "Organizer Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: orgAccountId,
            username: "org_user",
          },
        ],
      });
      setActionRepository(repository);
    });

    it("allows the host to remove a delegated group organizer", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      const result = await removeGroupOrganizerAction({ groupId: "g1", playerId: "p2" });
      expect(result.ok).toBe(true);

      const isOrg = await repository.isGroupOrganizer("g1", orgAccountId);
      expect(isOrg).toBe(false);
    });

    it("rejects non-host from removing a group organizer", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(orgAccountId);

      const result = await removeGroupOrganizerAction({ groupId: "g1", playerId: "p2" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Only the host can remove organizers");
    });

    it("rejects removing the host as an organizer", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      const result = await removeGroupOrganizerAction({ groupId: "g1", playerId: "p1" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("The host cannot be removed");
    });
  });

  describe("removeGroupPlayerAction", () => {
    let repository: InMemoryRepositories;

    beforeEach(() => {
      repository = new InMemoryRepositories({
        groups: [
          {
            id: "g1",
            name: "Test Group",
            organizerPinHash: "hash",
            createdAt: new Date(),
            isPublic: true,
            ownerAccountId: hostAccountId,
          },
        ],
        playerAccounts: [
          {
            id: hostAccountId,
            username: "host_user",
            name: "Host Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: orgAccountId,
            username: "org_user",
            name: "Organizer Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: memberAccountId,
            username: "member_user",
            name: "Regular Member",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
        ],
        groupOrganizers: [
          { groupId: "g1", accountId: orgAccountId },
        ],
        players: [
          {
            id: "p1",
            groupId: "g1",
            name: "Host Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: hostAccountId,
            username: "host_user",
          },
          {
            id: "p2",
            groupId: "g1",
            name: "Organizer Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: orgAccountId,
            username: "org_user",
          },
          {
            id: "p3",
            groupId: "g1",
            name: "Regular Member",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: memberAccountId,
            username: "member_user",
          },
        ],
      });
      setActionRepository(repository);
    });

    it("allows the host to remove a regular player", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p3" });
      expect(result.ok).toBe(true);

      const activePlayers = await repository.listPlayers("g1");
      expect(activePlayers.some((p) => p.id === "p3")).toBe(false);

      const allPlayers = await repository.listPlayers("g1", { includeInactive: true });
      const removed = allPlayers.find((p) => p.id === "p3");
      expect(removed).toBeDefined();
      expect(removed?.active).toBe(false);
    });

    it("updates active session attendance when removing a player", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);
      await repository.insertSession(
        {
          id: "s1",
          groupId: "g1",
          courtCount: 1,
          status: "active",
          currentRoundNumber: 0,
          startedAt: new Date(),
          endedAt: null,
          version: 1,
        },
        [
          { sessionId: "s1", playerId: "p3", joinedRound: 1, leftRound: null },
        ],
      );

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p3" });
      expect(result.ok).toBe(true);

      const attendance = await repository.listAttendance("s1");
      const p3Attendance = attendance.find((a) => a.playerId === "p3");
      expect(p3Attendance?.leftRound).toBe(1);
    });

    it("allows a group organizer to remove a regular player", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(orgAccountId);

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p3" });
      expect(result.ok).toBe(true);

      const activePlayers = await repository.listPlayers("g1");
      expect(activePlayers.some((p) => p.id === "p3")).toBe(false);
    });

    it("rejects an organizer trying to remove another organizer", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(orgAccountId);

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p2" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Only the host can remove organizers");
    });

    it("allows the host to remove an organizer (and clears organizer status)", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p2" });
      expect(result.ok).toBe(true);

      const activePlayers = await repository.listPlayers("g1");
      expect(activePlayers.some((p) => p.id === "p2")).toBe(false);

      const isOrg = await repository.isGroupOrganizer("g1", orgAccountId);
      expect(isOrg).toBe(false);
    });

    it("rejects removing the host", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p1" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("The host cannot be removed from the group");
    });

    it("rejects non-organizers from removing players", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(memberAccountId);

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p2" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Only the host or a group organizer can remove players");
    });

    it("completely deletes a guest player with 0 games from the database when removed", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);
      await repository.createPlayer({
        id: "p_guest_0",
        groupId: "g1",
        name: "Zero Games Guest",
        initialRating: 1000,
        rating: 1000,
        ratedGamesPlayed: 0,
        active: true,
      });

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p_guest_0" });
      expect(result.ok).toBe(true);

      const allPlayers = await repository.listPlayers("g1", { includeInactive: true });
      expect(allPlayers.some((p) => p.id === "p_guest_0")).toBe(false);
    });

    it("soft-deletes a guest player who has played games when removed", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);
      await repository.createPlayer({
        id: "p_guest_played",
        groupId: "g1",
        name: "Played Guest",
        initialRating: 1000,
        rating: 1050,
        ratedGamesPlayed: 3,
        active: true,
      });

      const result = await removeGroupPlayerAction({ groupId: "g1", playerId: "p_guest_played" });
      expect(result.ok).toBe(true);

      const activePlayers = await repository.listPlayers("g1");
      expect(activePlayers.some((p) => p.id === "p_guest_played")).toBe(false);

      const allPlayers = await repository.listPlayers("g1", { includeInactive: true });
      const removed = allPlayers.find((p) => p.id === "p_guest_played");
      expect(removed).toBeDefined();
      expect(removed?.active).toBe(false);
    });
  });

  describe("Adding public users and guests to private groups", () => {
    let repository: InMemoryRepositories;
    const newPublicUserAccountId = "acc_newbie";

    beforeEach(() => {
      repository = new InMemoryRepositories({
        groups: [
          {
            id: "priv_g1",
            name: "Private Group",
            organizerPinHash: "hash",
            createdAt: new Date(),
            isPublic: false,
            ownerAccountId: hostAccountId,
          },
        ],
        playerAccounts: [
          {
            id: hostAccountId,
            username: "host_user",
            name: "Host Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: orgAccountId,
            username: "org_user",
            name: "Organizer Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: memberAccountId,
            username: "member_user",
            name: "Regular Member",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: newPublicUserAccountId,
            username: "new_player",
            name: "New Player",
            passwordHash: "hash",
            skillLevel: "advanced",
            initialRating: 1200,
            createdAt: new Date(),
          },
        ],
        groupOrganizers: [
          { groupId: "priv_g1", accountId: orgAccountId },
        ],
        players: [
          {
            id: "p1",
            groupId: "priv_g1",
            name: "Host Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: hostAccountId,
            username: "host_user",
          },
          {
            id: "p2",
            groupId: "priv_g1",
            name: "Organizer Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: orgAccountId,
            username: "org_user",
          },
        ],
      });
      setActionRepository(repository);
    });

    it("allows host to add a public user by username to a private group", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await addGroupPlayerByUsernameAction({
        groupId: "priv_g1",
        username: "new_player",
      });
      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("priv_g1");
      const added = roster.find((p) => p.accountId === newPublicUserAccountId);
      expect(added).toBeDefined();
      expect(added?.name).toBe("New Player");
      expect(added?.username).toBe("new_player");
      expect(added?.active).toBe(true);
    });

    it("allows a group organizer to add a public user by username to a private group", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(orgAccountId);

      const result = await addGroupPlayerByUsernameAction({
        groupId: "priv_g1",
        username: "new_player",
      });
      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("priv_g1");
      const added = roster.find((p) => p.accountId === newPublicUserAccountId);
      expect(added).toBeDefined();
      expect(added?.name).toBe("New Player");
      expect(added?.username).toBe("new_player");
    });

    it("rejects non-organizers from adding players by username", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(newPublicUserAccountId);

      const result = await addGroupPlayerByUsernameAction({
        groupId: "priv_g1",
        username: "member_user",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Only the host or a group organizer can add players");
    });

    it("allows host to add a public user by accountId to a private group", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await addPlayerByAccountIdAction({
        groupId: "priv_g1",
        accountId: newPublicUserAccountId,
      });
      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("priv_g1");
      const added = roster.find((p) => p.accountId === newPublicUserAccountId);
      expect(added).toBeDefined();
      expect(added?.name).toBe("New Player");
    });

    it("allows an organizer to add a public user by accountId to a private group", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(orgAccountId);

      const result = await addPlayerByAccountIdAction({
        groupId: "priv_g1",
        accountId: newPublicUserAccountId,
      });
      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("priv_g1");
      const added = roster.find((p) => p.accountId === newPublicUserAccountId);
      expect(added).toBeDefined();
      expect(added?.name).toBe("New Player");
    });

    it("allows host to add a guest player to a private group", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await createPlayerAction({
        groupId: "priv_g1",
        name: "Guest Host Friend",
        initialRating: 1100,
        idempotencyKey: "guest_1",
      });
      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("priv_g1");
      const guest = roster.find((p) => p.name === "Guest Host Friend");
      expect(guest).toBeDefined();
      expect(guest?.accountId).toBeUndefined();
      expect(guest?.rating).toBe(1100);
    });

    it("allows an organizer to add a guest player to a private group", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(orgAccountId);

      const result = await createPlayerAction({
        groupId: "priv_g1",
        name: "Guest Org Friend",
        initialRating: 900,
        idempotencyKey: "guest_2",
      });
      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("priv_g1");
      const guest = roster.find((p) => p.name === "Guest Org Friend");
      expect(guest).toBeDefined();
      expect(guest?.accountId).toBeUndefined();
      expect(guest?.rating).toBe(900);
    });
  });

  describe("linkGuestPlayerAction", () => {
    let repository: InMemoryRepositories;
    const targetAccountId = "acc_target";

    beforeEach(() => {
      repository = new InMemoryRepositories({
        groups: [
          {
            id: "g1",
            name: "Test Group",
            organizerPinHash: "hash",
            createdAt: new Date(),
            isPublic: false,
            ownerAccountId: hostAccountId,
          },
        ],
        playerAccounts: [
          {
            id: hostAccountId,
            username: "host_user",
            name: "Host Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: orgAccountId,
            username: "org_user",
            name: "Organizer Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: memberAccountId,
            username: "member_user",
            name: "Member Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: targetAccountId,
            username: "target_user",
            name: "Target Public Player",
            passwordHash: "hash",
            skillLevel: "advanced",
            initialRating: 1200,
            rating: 1250,
            ratedGamesPlayed: 5,
            createdAt: new Date(),
          },
        ],
        groupOrganizers: [
          { groupId: "g1", accountId: orgAccountId },
        ],
        players: [
          {
            id: "p1",
            groupId: "g1",
            name: "Host Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: hostAccountId,
            username: "host_user",
          },
          {
            id: "p2",
            groupId: "g1",
            name: "Organizer Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: orgAccountId,
            username: "org_user",
          },
          {
            id: "p_guest",
            groupId: "g1",
            name: "Guest Alex",
            initialRating: 900,
            rating: 900,
            ratedGamesPlayed: 0,
            active: true,
            accountId: null,
          },
        ],
      });
      setActionRepository(repository);
    });

    it("allows host to link a guest player to a public player account", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await linkGuestPlayerAction({
        groupId: "g1",
        playerId: "p_guest",
        targetAccountId,
      });

      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("g1");
      const linked = roster.find((p) => p.id === "p_guest");
      expect(linked).toBeDefined();
      expect(linked?.accountId).toBe(targetAccountId);
      expect(linked?.username).toBe("target_user");
      expect(linked?.name).toBe("Target Public Player");
      expect(linked?.rating).toBe(1200);
      expect(linked?.ratedGamesPlayed).toBe(0);
    });

    it("allows an organizer to link a guest player to a public player account", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(orgAccountId);

      const result = await linkGuestPlayerAction({
        groupId: "g1",
        playerId: "p_guest",
        targetAccountId,
      });

      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("g1");
      const linked = roster.find((p) => p.id === "p_guest");
      expect(linked?.accountId).toBe(targetAccountId);
    });

    it("rejects non-organizers from linking a guest player", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(memberAccountId);

      const result = await linkGuestPlayerAction({
        groupId: "g1",
        playerId: "p_guest",
        targetAccountId,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Only the host or a group organizer");
      }
    });

    it("rejects linking a player that already has an account", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await linkGuestPlayerAction({
        groupId: "g1",
        playerId: "p2",
        targetAccountId,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("already linked to an account");
      }
    });

    it("allows linking to an account already in the group roster and merges histories", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      // Add a session and attendance for the guest player
      const sessionId = "s_merge_test";
      repository.state.sessions.push({
        id: sessionId,
        groupId: "g1",
        courtCount: 1,
        courtPlayerCounts: [4],
        status: "active",
        currentRoundNumber: 1,
        startedAt: new Date(),
        endedAt: null,
        version: 1,
        type: "regular",
      });
      repository.state.attendance.push({
        sessionId,
        playerId: "p_guest",
        joinedRound: 1,
        leftRound: null,
      });

      const result = await linkGuestPlayerAction({
        groupId: "g1",
        playerId: "p_guest",
        targetAccountId: orgAccountId,
      });

      expect(result.ok).toBe(true);

      const roster = await repository.listPlayers("g1");
      expect(roster.some((p) => p.id === "p_guest")).toBe(false);

      const mergedPlayer = roster.find((p) => p.accountId === orgAccountId);
      expect(mergedPlayer).toBeDefined();

      const attendance = repository.state.attendance.filter(
        (a) => a.sessionId === sessionId && a.playerId === mergedPlayer?.id,
      );
      expect(attendance.length).toBe(1);
    });

    it("rejects non-existent target account", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);

      const result = await linkGuestPlayerAction({
        groupId: "g1",
        playerId: "p_guest",
        targetAccountId: "non_existent_acc",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("account not found");
      }
    });
  });

  describe("transferGroupHostAction", () => {
    let repository: InMemoryRepositories;

    beforeEach(() => {
      repository = new InMemoryRepositories({
        groups: [
          {
            id: "g1",
            name: "Test Group",
            organizerPinHash: "hash",
            createdAt: new Date(),
            isPublic: true,
            ownerAccountId: hostAccountId,
          },
        ],
        playerAccounts: [
          {
            id: hostAccountId,
            username: "host_user",
            name: "Host Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: orgAccountId,
            username: "org_user",
            name: "Organizer Player",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
          {
            id: memberAccountId,
            username: "member_user",
            name: "Regular Member",
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            createdAt: new Date(),
          },
        ],
        groupOrganizers: [
          { groupId: "g1", accountId: orgAccountId },
        ],
        players: [
          {
            id: "p1",
            groupId: "g1",
            name: "Host Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: hostAccountId,
            username: "host_user",
          },
          {
            id: "p2",
            groupId: "g1",
            name: "Organizer Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: orgAccountId,
            username: "org_user",
          },
          {
            id: "p3",
            groupId: "g1",
            name: "Regular Member",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: memberAccountId,
            username: "member_user",
          },
          {
            id: "p4",
            groupId: "g1",
            name: "Guest Player",
            initialRating: 1000,
            rating: 1000,
            ratedGamesPlayed: 0,
            active: true,
            accountId: null,
          },
        ],
      });
      setActionRepository(repository);
    });

    it("allows the host to transfer host privileges to another organizer with matching group name confirmation", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      const result = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p2",
        confirmationName: "Test Group",
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group?.ownerAccountId).toBe(orgAccountId);

      const organizers = await repository.listGroupOrganizers("g1");
      const newHost = organizers.find((o) => o.accountId === orgAccountId);
      expect(newHost?.isHost).toBe(true);

      const oldHost = organizers.find((o) => o.accountId === hostAccountId);
      expect(oldHost?.isHost).toBe(false);

      // Once that happens, the original host loses their host privileges:
      // Old host can no longer add organizers
      const addOrgResult = await addGroupOrganizerAction({ groupId: "g1", playerId: "p3" });
      expect(addOrgResult.ok).toBe(false);
      expect(addOrgResult.error).toContain("Only the host can add organizers");

      // Old host can no longer remove organizers
      const removeOrgResult = await removeGroupOrganizerAction({ groupId: "g1", playerId: "p2" });
      expect(removeOrgResult.ok).toBe(false);
      expect(removeOrgResult.error).toContain("Only the host can remove organizers");

      // Old host can no longer transfer host
      const transferAgain = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p1",
        confirmationName: "Test Group",
      });
      expect(transferAgain.ok).toBe(false);
      expect(transferAgain.error).toContain("Only the host can transfer host privileges");

      // But the new host CAN now perform host actions!
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(orgAccountId);
      const newHostAddResult = await addGroupOrganizerAction({ groupId: "g1", playerId: "p3" });
      expect(newHostAddResult.ok).toBe(true);
    });

    it("rejects case-mismatched group name confirmation", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      const result = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p2",
        confirmationName: "test group", // group name is "Test Group"
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Group name does not match");
      const group = await repository.getGroup("g1");
      expect(group?.ownerAccountId).toBe(hostAccountId);
    });

    it("accepts exact case group name confirmation", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      const result = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p2",
        confirmationName: "Test Group",
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group?.ownerAccountId).toBe(orgAccountId);
    });

    it("rejects transfer when confirmation name does not match", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      const result = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p2",
        confirmationName: "Wrong Name",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Group name does not match");
      const group = await repository.getGroup("g1");
      expect(group?.ownerAccountId).toBe(hostAccountId);
    });

    it("rejects non-host caller from transferring host", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(orgAccountId);

      const result = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p2",
        confirmationName: "Test Group",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Only the host can transfer host privileges");
    });

    it("requires the recipient to be an organizer", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      // p3 is a regular member, not an organizer
      const result = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p3",
        confirmationName: "Test Group",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("The new host must already be a group organizer");
    });

    it("rejects transferring host to self", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      const result = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p1",
        confirmationName: "Test Group",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("You are already the host");
    });

    it("rejects transferring host to guest player", async () => {
      vi.mocked(actionContext.requirePlayer).mockResolvedValue(hostAccountId);

      const result = await transferGroupHostAction({
        groupId: "g1",
        playerId: "p4",
        confirmationName: "Test Group",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("This player must have an account to become the host");
    });
  });
});


