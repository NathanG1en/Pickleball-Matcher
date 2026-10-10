import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PlayerProfilePage from "@/app/players/page";
import { leavePublicGroupAction } from "@/app/actions/player-account";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import * as actionContext from "@/app/actions/action-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActivePlayerAccountId: vi.fn(),
    requirePlayer: vi.fn(),
  };
});

describe("PlayerProfilePage and Group Leaving", () => {
  const testAccountId = "usr_test123";

  beforeEach(() => {
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(testAccountId);
    vi.mocked(actionContext.requirePlayer).mockResolvedValue(testAccountId);
  });

  afterEach(() => {
    setActionRepository(null);
    vi.clearAllMocks();
  });

  it("shows the Host label and does not render Leave group button when player is the host", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "host_user",
          name: "Host User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groups: [
        {
          id: "grp_hosted",
          name: "Hosted League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: testAccountId,
        },
        {
          id: "grp_member",
          name: "Regular League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: "usr_other",
        },
      ],
      players: [
        {
          id: "p1",
          groupId: "grp_hosted",
          accountId: testAccountId,
          name: "Host User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
        {
          id: "p2",
          groupId: "grp_member",
          accountId: testAccountId,
          name: "Host User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    // Should display group names
    expect(html).toContain("Hosted League");
    expect(html).toContain("Regular League");

    // Hosted League must show "Host" label
    expect(html).toContain("Host");

    // Regular League should allow leaving
    expect(html).toContain("Leave group");

    // Check specifically that Hosted League row does not contain the leave group button
    const listItems = html.split("<li").filter((item) => item.includes("Hosted League") || item.includes("Regular League"));
    expect(listItems).toHaveLength(2);

    const hostedItem = listItems.find((item) => item.includes("Hosted League"));
    expect(hostedItem).toBeDefined();
    expect(hostedItem).toContain("Host");
    expect(hostedItem).not.toContain("Leave group");

    const memberItem = listItems.find((item) => item.includes("Regular League"));
    expect(memberItem).toBeDefined();
    expect(memberItem).not.toContain("Host");
    expect(memberItem).toContain("Leave group");
  });

  it("shows Organizer label and allows leaving when player is an organizer but not host", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "org_user",
          name: "Org User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groups: [
        {
          id: "grp_org",
          name: "Co-Organized League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: "usr_actual_host",
        },
      ],
      groupOrganizers: [
        {
          groupId: "grp_org",
          accountId: testAccountId,
        },
      ],
      players: [
        {
          id: "p1",
          groupId: "grp_org",
          accountId: testAccountId,
          name: "Org User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    const listItems = html.split("<li").filter((item) => item.includes("Co-Organized League"));
    expect(listItems).toHaveLength(1);

    const orgItem = listItems[0];
    expect(orgItem).toContain("Organizer");
    expect(orgItem).not.toContain("Host");
    expect(orgItem).toContain("Leave group");
  });

  it("rejects leavePublicGroupAction when called by the host of the group", async () => {
    const repository = new InMemoryRepositories({
      groups: [
        {
          id: "grp_hosted",
          name: "Hosted League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: testAccountId,
        },
      ],
      players: [
        {
          id: "p1",
          groupId: "grp_hosted",
          accountId: testAccountId,
          name: "Host User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const result = await leavePublicGroupAction({ groupId: "grp_hosted" });
    expect(result).toEqual({ ok: false, error: "Hosts cannot leave their own group." });
  });

  it("allows leavePublicGroupAction when called by a non-host member", async () => {
    const repository = new InMemoryRepositories({
      groups: [
        {
          id: "grp_member",
          name: "Regular League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: "usr_other",
        },
      ],
      players: [
        {
          id: "p2",
          groupId: "grp_member",
          accountId: testAccountId,
          name: "Member User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const result = await leavePublicGroupAction({ groupId: "grp_member" });
    expect(result).toEqual({ ok: true, data: { groupId: "grp_member" } });
  });
});

