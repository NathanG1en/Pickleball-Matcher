import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupOrganizersPanel } from "@/components/groups/group-organizers-panel";
import {
  addGroupOrganizerAction,
  removeGroupOrganizerAction,
} from "@/app/actions/group-organizers";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import * as actionContext from "@/app/actions/action-context";
import type { GroupOrganizerRecord, PlayerRecord } from "@/lib/domain/types";

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
    getActivePlayerAccountId: vi.fn(),
    requirePlayer: vi.fn(),
  };
});

describe("GroupOrganizersPanel and Actions", () => {
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
    it("renders players as <display name> (@<username>) and puts Host / Organizer label next to display name", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={true}
        />
      );

      // Verify username formatting
      expect(html).toContain("Host Player (@host_user)");
      expect(html).toContain("Organizer Player (@org_user)");
      expect(html).toContain("Regular Member (@member_user)");
      expect(html).toContain("Guest Player");
      expect(html).not.toContain("Guest Player (@");

      // Verify labels are rendered with player profile styling
      expect(html).toContain("Host");
      expect(html).toContain("Organizer");
      expect(html).toContain("rounded-full border border-black px-2 py-1 text-[9px] font-black uppercase bg-[#fde047]");

      // Verify "Remove group organizer" button exists for delegated organizer
      expect(html).toContain("Remove group organizer");
      // Verify "Make a group organizer" button exists for regular member
      expect(html).toContain("Make a group organizer");
    });

    it("does not render organizer options when user is not the host", () => {
      const html = renderToStaticMarkup(
        <GroupOrganizersPanel
          groupId="g1"
          players={samplePlayers}
          organizers={sampleOrganizers}
          isHost={false}
        />
      );

      expect(html).toContain("Host Player (@host_user)");
      expect(html).toContain("Organizer Player (@org_user)");
      expect(html).not.toContain("Remove group organizer");
      expect(html).not.toContain("Make a group organizer");
      expect(html).not.toContain("···");
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
});

