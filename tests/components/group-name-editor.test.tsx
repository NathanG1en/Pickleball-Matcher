import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupNameEditor } from "@/components/groups/group-name-editor";
import { updateGroupNameAction } from "@/app/actions/group-settings";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

let currentAccountId: string | null = null;

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
  return {
    ...actual,
    requireOrganizer: vi.fn(async (groupId: string) => {
      if (currentAccountId && (await actual.getActionRepository().isGroupOrganizer(groupId, currentAccountId))) {
        return null;
      }
      throw new Error("Not authorized");
    }),
  };
});

describe("GroupNameEditor and updateGroupNameAction", () => {
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
          name: "Original Group Name",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: hostAccountId,
        },
        {
          id: "g2",
          name: "Existing Another Group",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: "acc_other",
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
    });
    setActionRepository(repository);
  });

  afterEach(() => {
    setActionRepository(null);
    currentAccountId = null;
    vi.clearAllMocks();
  });

  describe("GroupNameEditor component", () => {
    it("renders display name and edit pencil button when canEdit is true", () => {
      const html = renderToStaticMarkup(
        <GroupNameEditor groupId="g1" initialName="Original Group Name" canEdit={true} />
      );

      expect(html).toContain("Original Group Name");
      expect(html).toContain('aria-label="Edit group name"');
    });

    it("renders display name without pencil button when canEdit is false", () => {
      const html = renderToStaticMarkup(
        <GroupNameEditor groupId="g1" initialName="Original Group Name" canEdit={false} />
      );

      expect(html).toContain("Original Group Name");
      expect(html).not.toContain('aria-label="Edit group name"');
    });
  });

  describe("updateGroupNameAction", () => {
    it("allows the host to update the group name", async () => {
      currentAccountId = hostAccountId;

      const result = await updateGroupNameAction({
        groupId: "g1",
        name: "New Group Name",
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group?.name).toBe("New Group Name");
    });

    it("allows a delegated organizer to update the group name", async () => {
      currentAccountId = orgAccountId;

      const result = await updateGroupNameAction({
        groupId: "g1",
        name: "Organizer Renamed Group",
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group?.name).toBe("Organizer Renamed Group");
    });

    it("rejects a regular member from updating the group name", async () => {
      currentAccountId = memberAccountId;

      const result = await updateGroupNameAction({
        groupId: "g1",
        name: "Unauthorized Rename",
      });

      expect(result.ok).toBe(false);
      const group = await repository.getGroup("g1");
      expect(group?.name).toBe("Original Group Name");
    });

    it("rejects duplicate group name taken by another group", async () => {
      currentAccountId = hostAccountId;

      const result = await updateGroupNameAction({
        groupId: "g1",
        name: "Existing Another Group",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("A group with this exact name already exists");
    });

    it("rejects empty group name", async () => {
      currentAccountId = hostAccountId;

      const result = await updateGroupNameAction({
        groupId: "g1",
        name: "   ",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Group name cannot be blank");
    });
  });
});

