import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareGroupButton, ShareGroupModal } from "@/components/groups/share-group-modal";
import { JoinGroupClient } from "@/app/g/[groupId]/join/join-group-client";
import { joinGroupViaInviteAction, joinAsGuestAction } from "@/app/actions/player-account";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { createGuestSessionToken, readGuestSession } from "@/lib/auth/guest-session";

let mockAccountId: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActivePlayerAccountId: vi.fn(async () => mockAccountId),
    requirePlayer: vi.fn(async () => {
      if (!mockAccountId) throw new Error("Not signed in");
      return mockAccountId;
    }),
  };
});

describe("Share Group and Join Feature", () => {
  const hostAccountId = "acc_host";
  const userAccountId = "acc_user";
  let repository: InMemoryRepositories;

  beforeEach(() => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "test-player-session-secret-32-chars-long!");
    mockAccountId = null;
    repository = new InMemoryRepositories({
      groups: [
        {
          id: "grp_private1",
          name: "Secret Picklers",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: false,
          ownerAccountId: hostAccountId,
        },
      ],
      playerAccounts: [
        {
          id: hostAccountId,
          username: "host_player",
          name: "Host Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: userAccountId,
          username: "invited_user",
          name: "Invited Player",
          passwordHash: "hash",
          skillLevel: "advanced",
          initialRating: 1100,
          createdAt: new Date(),
        },
      ],
      players: [
        {
          id: "ply_host",
          groupId: "grp_private1",
          name: "Host Player",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
          accountId: hostAccountId,
        },
      ],
    });
    setActionRepository(repository);
  });

  afterEach(() => {
    setActionRepository(null);
    mockAccountId = null;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("ShareGroupButton and ShareGroupModal UI", () => {
    it("renders Share button with share icon", () => {
      const html = renderToStaticMarkup(
        <ShareGroupButton groupId="grp_private1" groupName="Secret Picklers" />
      );
      expect(html).toContain("Share");
      expect(html).toContain('aria-label="Share group link and QR code"');
    });

    it("renders ShareGroupModal with group name, link, and QR code instructions when open", () => {
      const html = renderToStaticMarkup(
        <ShareGroupModal
          isOpen={true}
          onClose={() => {}}
          groupId="grp_private1"
          groupName="Secret Picklers"
        />
      );
      expect(html).toContain("Secret Picklers");
      expect(html).toContain("Share Group");
      expect(html).toContain("Scan with phone camera to join");
      expect(html).toContain("Copy Link");
      expect(html).toContain("/g/grp_private1/join");
      expect(html).toContain("Anyone with the link or QR code can join even if the group is private.");
    });

    it("does not render modal content when isOpen is false", () => {
      const html = renderToStaticMarkup(
        <ShareGroupModal
          isOpen={false}
          onClose={() => {}}
          groupId="grp_private1"
          groupName="Secret Picklers"
        />
      );
      expect(html).toBe("");
    });
  });

  describe("joinGroupViaInviteAction", () => {
    it("allows a logged-in user to join a private group via the invite link", async () => {
      mockAccountId = userAccountId;

      const result = await joinGroupViaInviteAction({ groupId: "grp_private1" });
      expect(result.ok).toBe(true);

      const players = await repository.listPlayers("grp_private1");
      const userPlayer = players.find((p) => p.accountId === userAccountId);
      expect(userPlayer).toBeDefined();
      expect(userPlayer?.name).toBe("Invited Player");
      expect(userPlayer?.active).toBe(true);
    });

    it("rejects joining a non-existent group", async () => {
      mockAccountId = userAccountId;

      const result = await joinGroupViaInviteAction({ groupId: "grp_nonexistent" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("does not exist");
      }
    });

    it("rejects joining if the user is not signed in", async () => {
      mockAccountId = null;

      const result = await joinGroupViaInviteAction({ groupId: "grp_private1" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("sign in");
      }
    });
  });

  describe("joinAsGuestAction", () => {
    it("allows a guest to join a private group with custom name and skill level", async () => {
      const result = await joinAsGuestAction({
        groupId: "grp_private1",
        name: "Guest Charlie",
        skillLevel: "advanced",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.groupId).toBe("grp_private1");
        expect(result.data.playerId).toBeDefined();

        const players = await repository.listPlayers("grp_private1");
        const guestPlayer = players.find((p) => p.name === "Guest Charlie");
        expect(guestPlayer).toBeDefined();
        expect(guestPlayer?.initialRating).toBe(1100);
        expect(guestPlayer?.accountId).toBeNull();
      }
    });

    it("defaults guest skill level to intermediate (1000) if not provided", async () => {
      const result = await joinAsGuestAction({
        groupId: "grp_private1",
        name: "Guest Sam",
      });

      expect(result.ok).toBe(true);
      const players = await repository.listPlayers("grp_private1");
      const guestPlayer = players.find((p) => p.name === "Guest Sam");
      expect(guestPlayer?.initialRating).toBe(1000);
    });

    it("rejects guest join with empty name", async () => {
      const result = await joinAsGuestAction({
        groupId: "grp_private1",
        name: "   ",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("enter your name");
      }
    });

    it("rejects guest join to non-existent group", async () => {
      const result = await joinAsGuestAction({
        groupId: "grp_missing",
        name: "Guest Bob",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("does not exist");
      }
    });
  });

  describe("Guest Session Token", () => {
    it("creates and verifies a guest session token mapping group IDs to player IDs", async () => {
      const token = await createGuestSessionToken({
        guests: { grp_private1: "ply_guest123", grp_other: "ply_guest456" },
      });
      expect(typeof token).toBe("string");

      const parsed = await readGuestSession(token);
      expect(parsed).toBeDefined();
      expect(parsed?.guests.grp_private1).toBe("ply_guest123");
      expect(parsed?.guests.grp_other).toBe("ply_guest456");
    });
  });

  describe("JoinGroupClient UI States", () => {
    it("renders quick guest form and account options for visitors who are not logged in", () => {
      const html = renderToStaticMarkup(
        <JoinGroupClient
          groupId="grp_private1"
          groupName="Secret Picklers"
          isPublic={false}
          activePlayerCount={1}
          account={null}
          isOrganizer={false}
          isAccountMember={false}
          guestPlayer={null}
        />
      );

      expect(html).toContain("Join Secret Picklers");
      expect(html).toContain("Quick Guest Join");
      expect(html).toContain("Join as Guest");
      expect(html).toContain("Sign In to Existing Account");
      expect(html).toContain("Create New Account");
      expect(html).toContain("Private Group");
    });

    it("renders 'Join Group Now' button when user is logged in as an account but not a member", () => {
      const html = renderToStaticMarkup(
        <JoinGroupClient
          groupId="grp_private1"
          groupName="Secret Picklers"
          isPublic={false}
          activePlayerCount={1}
          account={{
            id: userAccountId,
            username: "invited_user",
            name: "Invited Player",
            initialRating: 1100,
          }}
          isOrganizer={false}
          isAccountMember={false}
          guestPlayer={null}
        />
      );

      expect(html).toContain("Join Secret Picklers");
      expect(html).toContain("@invited_user");
      expect(html).toContain("Join Group Now");
      expect(html).not.toContain("Quick Guest Join");
    });

    it("renders 'Already a Member' when user is a regular member of the group", () => {
      const html = renderToStaticMarkup(
        <JoinGroupClient
          groupId="grp_private1"
          groupName="Secret Picklers"
          isPublic={false}
          activePlayerCount={2}
          account={{
            id: userAccountId,
            username: "invited_user",
            name: "Invited Player",
            initialRating: 1100,
          }}
          isOrganizer={false}
          isAccountMember={true}
          guestPlayer={null}
        />
      );

      expect(html).toContain("Already a Member");
      expect(html).toContain("Go to Group Dashboard →");
    });

    it("renders 'Group Organizer' when user is an organizer of the group", () => {
      const html = renderToStaticMarkup(
        <JoinGroupClient
          groupId="grp_private1"
          groupName="Secret Picklers"
          isPublic={false}
          activePlayerCount={2}
          account={{
            id: hostAccountId,
            username: "host_player",
            name: "Host Player",
            initialRating: 1000,
          }}
          isOrganizer={true}
          isAccountMember={true}
          guestPlayer={null}
        />
      );

      expect(html).toContain("Group Organizer");
      expect(html).toContain("Go to Group Dashboard →");
    });

    it("renders guest membership status when user has previously joined as guest", () => {
      const html = renderToStaticMarkup(
        <JoinGroupClient
          groupId="grp_private1"
          groupName="Secret Picklers"
          isPublic={false}
          activePlayerCount={2}
          account={null}
          isOrganizer={false}
          isAccountMember={false}
          guestPlayer={{
            id: "ply_guest_1",
            name: "Guest Player 1",
          }}
        />
      );

      expect(html).toContain("Already a Member");
      expect(html).toContain('joined to this group on this device as guest &quot;Guest Player 1&quot;');
      expect(html).toContain("Go to Group Dashboard →");
    });
  });
});
