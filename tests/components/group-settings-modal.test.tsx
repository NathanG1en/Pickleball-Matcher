import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupSettingsModal } from "@/components/groups/group-settings/group-settings-modal";
import {
  updateGroupPermissionsAction,
  updateGroupVisibilityAction,
} from "@/app/actions/group-settings";
import { updateGroupOrganizersAction } from "@/app/actions/group-organizers";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { GroupOrganizerPermissionKey, GroupOrganizerRecord, PlayerRecord } from "@/lib/domain/types";
import { AuthorizationError } from "@/lib/auth/authorize";
import { parseGroupOrganizerPermissions } from "@/lib/auth/group-permissions";

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
    requireGroupHost: vi.fn(async (groupId: string) => {
      if (!currentAccountId) throw new Error("Not signed in");
      const group = await actual.getActionRepository().getGroup(groupId);
      if (!group) throw new Error("Group not found");
      if (group.ownerAccountId !== currentAccountId) {
        throw new AuthorizationError();
      }
      return { group, accountId: currentAccountId };
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

describe("GroupSettingsModal and Permissions Workflows", () => {
  const hostAccountId = "acc_host";
  const orgAccountId = "acc_org";
  const player1AccountId = "acc_p1";
  const player2AccountId = "acc_p2";

  let repository: InMemoryRepositories;

  const testPlayers: PlayerRecord[] = [
    {
      id: "p_host",
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
      id: "p_org",
      groupId: "g1",
      name: "Org Player",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
      accountId: orgAccountId,
      username: "org_user",
    },
    {
      id: "p_cand1",
      groupId: "g1",
      name: "Candidate One",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
      accountId: player1AccountId,
      username: "cand_one",
    },
    {
      id: "p_cand2",
      groupId: "g1",
      name: "Candidate Two",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
      accountId: player2AccountId,
      username: "cand_two",
    },
  ];

  const testOrganizers: GroupOrganizerRecord[] = [
    {
      accountId: hostAccountId,
      name: "Host Player",
      username: "host_user",
      isHost: true,
    },
    {
      accountId: orgAccountId,
      name: "Org Player",
      username: "org_user",
      isHost: false,
    },
  ];

  beforeEach(() => {
    currentAccountId = null;
    repository = new InMemoryRepositories({
      groups: [
        {
          id: "g1",
          name: "Metro Picklers",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: false,
          ownerAccountId: hostAccountId,
          organizerPermissions: {
            edit_group_name: true,
            edit_group_privacy: true,
            manage_organizers: false,
            delete_group: false,
          },
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
          name: "Org Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: player1AccountId,
          username: "cand_one",
          name: "Candidate One",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: player2AccountId,
          username: "cand_two",
          name: "Candidate Two",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groupOrganizers: [
        { groupId: "g1", accountId: orgAccountId },
      ],
      players: testPlayers,
    });
    setActionRepository(repository);
  });

  afterEach(() => {
    setActionRepository(null);
    currentAccountId = null;
    vi.clearAllMocks();
  });

  describe("GroupSettingsModal UI and Gating", () => {
    it("renders all 4 tabs for the host", () => {
      const html = renderToStaticMarkup(
        <GroupSettingsModal
          isOpen={true}
          onClose={() => {}}
          groupId="g1"
          initialGroupName="Metro Picklers"
          initialIsPublic={false}
          isHost={true}
          isOrganizer={true}
          organizerPermissions={{
            edit_group_name: true,
            edit_group_privacy: true,
            manage_organizers: false,
            delete_group: false,
          }}
          players={testPlayers}
          organizers={testOrganizers}
        />
      );

      expect(html).toContain("Group Settings");
      expect(html).toContain('data-testid="settings-tab-general"');
      expect(html).toContain('data-testid="settings-tab-organizers"');
      expect(html).toContain('data-testid="settings-tab-permissions"');
      expect(html).toContain('data-testid="settings-tab-danger"');

      // Host can save permissions
      expect(html).toContain('data-testid="save-permissions-button"');
      // Group ID is visible with copy button
      expect(html).toContain('data-testid="copy-group-id-button"');
    });

    it("hides Organizers and Danger Zone tabs for organizers with default permissions", () => {
      const html = renderToStaticMarkup(
        <GroupSettingsModal
          isOpen={true}
          onClose={() => {}}
          groupId="g1"
          initialGroupName="Metro Picklers"
          initialIsPublic={false}
          isHost={false}
          isOrganizer={true}
          organizerPermissions={{
            edit_group_name: true,
            edit_group_privacy: true,
            manage_organizers: false,
            delete_group: false,
          }}
          players={testPlayers}
          organizers={testOrganizers}
        />
      );

      // Accessible tabs
      expect(html).toContain('data-testid="settings-tab-general"');
      expect(html).toContain('data-testid="settings-tab-permissions"');

      // Hidden tabs
      expect(html).not.toContain('data-testid="settings-tab-organizers"');
      expect(html).not.toContain('data-testid="settings-tab-danger"');

      // Permissions tab is read-only: no Save Permissions button
      expect(html).not.toContain('data-testid="save-permissions-button"');
      expect(html).toContain("Read-only view. These permissions are configured and managed by the group host.");
    });

    it("displays Organizers and Danger Zone tabs for organizers when permissions are granted by host", () => {
      const html = renderToStaticMarkup(
        <GroupSettingsModal
          isOpen={true}
          onClose={() => {}}
          groupId="g1"
          initialGroupName="Metro Picklers"
          initialIsPublic={false}
          isHost={false}
          isOrganizer={true}
          organizerPermissions={{
            edit_group_name: true,
            edit_group_privacy: true,
            manage_organizers: true,
            delete_group: true,
          }}
          players={testPlayers}
          organizers={testOrganizers}
        />
      );

      expect(html).toContain('data-testid="settings-tab-general"');
      expect(html).toContain('data-testid="settings-tab-organizers"');
      expect(html).toContain('data-testid="settings-tab-permissions"');
      expect(html).toContain('data-testid="settings-tab-danger"');
    });
  });

  describe("updateGroupPermissionsAction", () => {
    it("allows the host to update organizer permissions", async () => {
      currentAccountId = hostAccountId;

      const result = await updateGroupPermissionsAction({
        groupId: "g1",
        permissions: {
          edit_group_name: false,
          edit_group_privacy: false,
          manage_organizers: true,
          delete_group: true,
        },
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group?.organizerPermissions?.manage_organizers).toBe(true);
      expect(group?.organizerPermissions?.delete_group).toBe(true);
      expect(group?.organizerPermissions?.edit_group_name).toBe(false);
    });

    it("rejects non-host from modifying organizer permissions", async () => {
      currentAccountId = orgAccountId;

      const result = await updateGroupPermissionsAction({
        groupId: "g1",
        permissions: {
          edit_group_name: true,
          edit_group_privacy: true,
          manage_organizers: true,
          delete_group: true,
        },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Only the host can configure organizer permissions");
    });
  });

  describe("updateGroupVisibilityAction permissions", () => {
    it("allows delegated organizer to update privacy when edit_group_privacy is ON (default)", async () => {
      currentAccountId = orgAccountId;

      const result = await updateGroupVisibilityAction({
        groupId: "g1",
        isPublic: true,
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group?.isPublic).toBe(true);
    });

    it("rejects delegated organizer from updating privacy when edit_group_privacy is OFF", async () => {
      currentAccountId = orgAccountId;

      // Host disables edit_group_privacy
      await repository.updateGroupOrganizerPermissions("g1", {
        edit_group_name: true,
        edit_group_privacy: false,
        manage_organizers: false,
        delete_group: false,
      });

      const result = await updateGroupVisibilityAction({
        groupId: "g1",
        isPublic: true,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("You do not have permission to edit group privacy");
      const group = await repository.getGroup("g1");
      expect(group?.isPublic).toBe(false);
    });
  });

  describe("updateGroupOrganizersAction", () => {
    it("allows host to bulk assign and remove organizers", async () => {
      currentAccountId = hostAccountId;

      const result = await updateGroupOrganizersAction({
        groupId: "g1",
        addAccountIds: [player1AccountId, player2AccountId],
        removeAccountIds: [orgAccountId],
      });

      expect(result.ok).toBe(true);
      const isOrg1 = await repository.isGroupOrganizer("g1", player1AccountId);
      const isOrg2 = await repository.isGroupOrganizer("g1", player2AccountId);
      const isOldOrg = await repository.isGroupOrganizer("g1", orgAccountId);

      expect(isOrg1).toBe(true);
      expect(isOrg2).toBe(true);
      expect(isOldOrg).toBe(false);
    });

    it("rejects removing the host in bulk organizer update", async () => {
      currentAccountId = hostAccountId;

      const result = await updateGroupOrganizersAction({
        groupId: "g1",
        addAccountIds: [],
        removeAccountIds: [hostAccountId],
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("The host cannot be removed");
    });

    it("rejects organizer from updating organizers when manage_organizers is OFF", async () => {
      currentAccountId = orgAccountId;

      const result = await updateGroupOrganizersAction({
        groupId: "g1",
        addAccountIds: [player1AccountId],
        removeAccountIds: [],
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("You do not have permission to manage organizers");
    });

    it("allows organizer to update organizers when manage_organizers is ON", async () => {
      currentAccountId = orgAccountId;

      await repository.updateGroupOrganizerPermissions("g1", {
        edit_group_name: true,
        edit_group_privacy: true,
        manage_organizers: true,
        delete_group: false,
      });

      const result = await updateGroupOrganizersAction({
        groupId: "g1",
        addAccountIds: [player1AccountId],
        removeAccountIds: [],
      });

      expect(result.ok).toBe(true);
      const isOrg1 = await repository.isGroupOrganizer("g1", player1AccountId);
      expect(isOrg1).toBe(true);
    });
  });
});
