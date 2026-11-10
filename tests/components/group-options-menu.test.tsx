import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BackButton } from "@/components/groups/back-button";
import { GroupOptionsMenu } from "@/components/groups/group-options-menu";
import { deleteGroupAction } from "@/app/actions/group-settings";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { AuthorizationError } from "@/lib/auth/authorize";
import { parseGroupOrganizerPermissions } from "@/lib/auth/group-permissions";
import type { GroupOrganizerPermissionKey } from "@/lib/domain/types";

let currentAccountId: string | null = null;

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
    getActivePlayerAccountId: vi.fn(async () => currentAccountId),
    requirePlayer: vi.fn(async () => {
      if (!currentAccountId) throw new Error("Not signed in");
      return currentAccountId;
    }),
    requireGroupPermission: vi.fn(async (groupId: string, permission: GroupOrganizerPermissionKey) => {
      const group = await actual.getActionRepository().getGroup(groupId);
      if (!group) throw new Error("Group not found");
      const isHost = Boolean(currentAccountId && group.ownerAccountId === currentAccountId);
      if (isHost) return { group, accountId: currentAccountId, isHost: true };
      const isOrg = Boolean(currentAccountId && (await actual.getActionRepository().isGroupOrganizer(groupId, currentAccountId)));
      if (!isOrg) throw new AuthorizationError();
      const perms = parseGroupOrganizerPermissions(group.organizerPermissions);
      if (!perms[permission]) throw new AuthorizationError();
      return { group, accountId: currentAccountId, isHost: false };
    }),
    requireOrganizer: vi.fn(async (groupId: string) => {
      if (currentAccountId && (await actual.getActionRepository().isGroupOrganizer(groupId, currentAccountId))) {
        return null;
      }
      throw new Error("Not authorized");
    }),
  };
});

describe("Group Navigation and Options Menu", () => {
  const hostAccountId = "acc_host";
  const orgAccountId = "acc_org";
  const memberAccountId = "acc_member";

  let repository: InMemoryRepositories;

  beforeEach(() => {
    currentAccountId = null;
    repository = new InMemoryRepositories({
      groups: [
        {
          id: "g1",
          name: "Friday Night Picklers",
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
        },
      ],
    });
    setActionRepository(repository);
  });

  afterEach(() => {
    setActionRepository(null);
    currentAccountId = null;
    vi.clearAllMocks();
  });

  describe("BackButton component", () => {
    it("renders Back button with left arrow", () => {
      const html = renderToStaticMarkup(<BackButton fallbackHref="/players" />);
      expect(html).toContain("← Back");
      expect(html).toContain('aria-label="Go back"');
    });

    it("renders as Link when href is provided", () => {
      const html = renderToStaticMarkup(<BackButton href="/players" />);
      expect(html).toContain("← Back");
      expect(html).toContain('href="/players"');
    });
  });

  describe("GroupOptionsMenu component", () => {
    it("renders the 3 dots button for group options", () => {
      const html = renderToStaticMarkup(
        <GroupOptionsMenu groupId="g1" groupName="Friday Night Picklers" isAccountOrganizer={true} />
      );

      expect(html).toContain("···");
      expect(html).toContain('aria-label="Group options"');
      expect(html).toContain("h-7 w-7");
    });

    it("renders the 3 dots button for non-organizer members", () => {
      const html = renderToStaticMarkup(
        <GroupOptionsMenu
          groupId="g1"
          groupName="Friday Night Picklers"
          isAccountOrganizer={false}
          isOrganizer={false}
        />
      );

      expect(html).toContain("···");
      expect(html).toContain('aria-label="Group options"');
    });

    it("renders Group Settings modal with tab navigation when open for host/organizer", () => {
      const html = renderToStaticMarkup(
        <GroupOptionsMenu
          groupId="g1"
          groupName="Friday Night Picklers"
          isHost={true}
          isOrganizer={true}
          initialMenuOpen={true}
        />
      );

      expect(html).toContain("Group Settings");
      expect(html).toContain('data-testid="settings-tab-general"');
      expect(html).toContain('data-testid="settings-tab-organizers"');
      expect(html).toContain('data-testid="settings-tab-permissions"');
      expect(html).toContain('data-testid="settings-tab-danger"');
      expect(html).toContain('data-testid="delete-group-menu-item"');
      expect(html).toContain("Delete Group");
    });

    it("renders Leave Group option with standard styling for non-organizers when open", () => {
      const html = renderToStaticMarkup(
        <GroupOptionsMenu
          groupId="g1"
          groupName="Friday Night Picklers"
          isOrganizer={false}
          initialMenuOpen={true}
        />
      );

      expect(html).toContain('data-testid="leave-group-menu-item"');
      expect(html).toContain("<span>Leave</span>");
      expect(html).not.toContain("Delete Group");
      expect(html).toContain("rounded-[20px]");
      expect(html).toContain("bg-[#FFFDF6]");
    });
  });

  describe("deleteGroupAction", () => {
    it("allows the host to delete the group when the confirmation name matches", async () => {
      currentAccountId = hostAccountId;

      const result = await deleteGroupAction({
        groupId: "g1",
        confirmationName: "Friday Night Picklers",
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group).toBeNull();
      const players = await repository.listPlayers("g1");
      expect(players).toHaveLength(0);
    });

    it("rejects a delegated organizer from deleting the group when delete_group is OFF (default)", async () => {
      currentAccountId = orgAccountId;

      const result = await deleteGroupAction({
        groupId: "g1",
        confirmationName: "Friday Night Picklers",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("You do not have permission to delete this group");
      const group = await repository.getGroup("g1");
      expect(group).not.toBeNull();
    });

    it("allows a delegated organizer to delete the group when delete_group is enabled", async () => {
      currentAccountId = orgAccountId;

      await repository.updateGroupOrganizerPermissions("g1", {
        edit_group_name: true,
        edit_group_privacy: true,
        manage_organizers: false,
        delete_group: true,
      });

      const result = await deleteGroupAction({
        groupId: "g1",
        confirmationName: "Friday Night Picklers",
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group).toBeNull();
    });

    it("rejects deletion if the confirmation name case does not match", async () => {
      currentAccountId = hostAccountId;

      const result = await deleteGroupAction({
        groupId: "g1",
        confirmationName: "friday night picklers", // Case mismatch
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Group name does not match");
      const group = await repository.getGroup("g1");
      expect(group).not.toBeNull();
    });

    it("rejects deletion if the confirmation name does not match", async () => {
      currentAccountId = hostAccountId;

      const result = await deleteGroupAction({
        groupId: "g1",
        confirmationName: "Wrong Name",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Group name does not match");
      const group = await repository.getGroup("g1");
      expect(group).not.toBeNull();
    });

    it("rejects deletion by an unauthorized non-organizer member", async () => {
      currentAccountId = memberAccountId;

      const result = await deleteGroupAction({
        groupId: "g1",
        confirmationName: "Friday Night Picklers",
      });

      expect(result.ok).toBe(false);
      const group = await repository.getGroup("g1");
      expect(group).not.toBeNull();
    });
  });
});

