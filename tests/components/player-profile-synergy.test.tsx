import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import PlayerProfilePage from "@/app/players/page";
import { PlayerProfileHeader } from "@/components/players/player-profile-controls";
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

describe("Player Profile Privacy Toggle and Best Partner Spotlight", () => {
  const testAccountId = "usr_player1";

  beforeEach(() => {
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(testAccountId);
    vi.mocked(actionContext.requirePlayer).mockResolvedValue(testAccountId);
  });

  afterEach(() => {
    setActionRepository(null);
    vi.clearAllMocks();
  });

  it("PlayerProfileHeader renders privacy badge and toggle option", () => {
    const htmlPublic = renderToStaticMarkup(
      <PlayerProfileHeader
        initialName="Alex"
        initialUsername="alex123"
        initialGender="male"
        skillLevel="advanced"
        initialRating={1400}
        initialIsPublic={true}
      />
    );
    expect(htmlPublic).toContain("Public");

    const htmlPrivate = renderToStaticMarkup(
      <PlayerProfileHeader
        initialName="Alex"
        initialUsername="alex123"
        initialGender="male"
        skillLevel="advanced"
        initialRating={1400}
        initialIsPublic={false}
      />
    );
    expect(htmlPrivate).toContain("Private");
  });

  it("PlayerProfilePage renders Best Partner card when synergy exists", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "alex123",
          name: "Alex",
          isPublic: true,
          passwordHash: "hash",
          skillLevel: "advanced",
          initialRating: 1400,
          createdAt: new Date(),
        },
        {
          id: "usr_partner2",
          username: "sam_slam",
          name: "Sam",
          isPublic: true,
          passwordHash: "hash",
          skillLevel: "advanced",
          initialRating: 1400,
          createdAt: new Date(),
        },
      ],
      synergies: [
        {
          accountId1: testAccountId < "usr_partner2" ? testAccountId : "usr_partner2",
          accountId2: testAccountId < "usr_partner2" ? "usr_partner2" : testAccountId,
          matchesPlayed: 8,
          wins: 7,
          synergyScore: 0.8,
          updatedAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    const PageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(PageElement);

    expect(html).toContain("Best Partner");
    expect(html).toContain("@sam_slam");
    expect(html).toContain("80% Synergy");
    expect(html).toContain("8 matches");
  });
});
