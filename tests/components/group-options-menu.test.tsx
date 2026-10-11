import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BackButton } from "@/components/groups/back-button";
import { GroupOptionsMenu } from "@/components/groups/group-options-menu";
import { deleteGroupAction } from "@/app/actions/group-settings";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

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

    it("allows a delegated organizer to delete the group when the confirmation name matches", async () => {
      currentAccountId = orgAccountId;

      const result = await deleteGroupAction({
        groupId: "g1",
        confirmationName: "friday night picklers", // Case insensitive match
      });

      expect(result.ok).toBe(true);
      const group = await repository.getGroup("g1");
      expect(group).toBeNull();
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

