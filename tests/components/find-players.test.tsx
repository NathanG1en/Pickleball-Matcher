import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FindPlayerList } from "@/components/players/find-player-list";
import FindPlayersPage from "@/app/players/find/page";
import PlayerPublicProfilePage from "@/app/players/[username]/page";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import * as actionContext from "@/app/actions/action-context";
import type { PlayerAccountRecord } from "@/lib/domain/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}));

describe("Find Players", () => {
  const publicPlayer: PlayerAccountRecord = {
    id: "usr_pub",
    username: "pickle_ace",
    name: "Alex Champion",
    gender: "female",
    isPublic: true,
    passwordHash: "hash1",
    skillLevel: "intermediate",
    initialRating: 1000,
    rating: 1050,
    createdAt: new Date(),
  };

  const privatePlayer: PlayerAccountRecord = {
    id: "usr_priv",
    username: "stealth_drop",
    name: "Sam Secret",
    gender: "male",
    isPublic: false,
    passwordHash: "hash2",
    skillLevel: "advanced",
    initialRating: 1200,
    rating: 1240,
    createdAt: new Date(),
  };

  const groupMemberPlayer: PlayerAccountRecord = {
    id: "usr_grp",
    username: "club_regular",
    name: "Casey Club",
    gender: "female",
    isPublic: true,
    passwordHash: "hash3",
    skillLevel: "intermediate",
    initialRating: 1100,
    rating: 1150,
    visibilitySettings: {
      profile: "group_members",
      activities: "group_members",
      ratingStats: "group_members",
      chemistry: "group_members",
      groups: "group_members",
    },
    createdAt: new Date(),
  };

  it("renders public, group members only, and private players with username, display name, gender, and rating", () => {
    const html = renderToStaticMarkup(
      <FindPlayerList
        players={[publicPlayer, groupMemberPlayer, privatePlayer]}
        currentAccountId="usr_pub"
      />
    );

    // Display names
    expect(html).toContain("Alex Champion");
    expect(html).toContain("Casey Club");
    expect(html).toContain("Sam Secret");

    // Usernames
    expect(html).toContain("@pickle_ace");
    expect(html).toContain("@club_regular");
    expect(html).toContain("@stealth_drop");

    // Genders (Alex Champion is public female; Sam Secret is private male and hidden from other viewers)
    expect(html).toContain("Female");
    expect(html).not.toContain("Male");

    // Ratings (formatDupr formats Elo: 1000 -> 3.5, 1050 -> 3.625; private player's rating 1240 / 4.1 is hidden)
    expect(html).toContain("Rating:");
    expect(html).toContain("3.625");
    expect(html).not.toContain("4.1");

    // Badges
    expect(html).toContain("Everyone");
    expect(html).toContain("Group Members Only");
    expect(html).toContain("Private");
    expect(html).not.toContain("Only You");
    expect(html).toContain("You");

    // Links to profiles
    expect(html).toContain('href="/players/pickle_ace"');
    expect(html).toContain('href="/players/club_regular"');
    expect(html).toContain('href="/players/stealth_drop"');
    expect(html).toContain("View Profile");
  });

  it("renders empty state when no players match search", () => {
    const html = renderToStaticMarkup(
      <FindPlayerList players={[]} currentAccountId={null} />
    );
    expect(html).toContain("No players match that search.");
  });

  it("renders FindPlayersPage and searches correctly", async () => {
    const repo = new InMemoryRepositories({
      playerAccounts: [publicPlayer, privatePlayer],
    });
    actionContext.setActionRepository(repo);

    // Test with empty query
    const jsxAll = await FindPlayersPage({ searchParams: Promise.resolve({}) });
    const htmlAll = renderToStaticMarkup(jsxAll);
    expect(htmlAll).toContain("Find Players");
    expect(htmlAll).toContain("← Back");
    expect(htmlAll).toContain("Alex Champion");
    expect(htmlAll).toContain("Sam Secret");

    // Test with query filtering for "stealth"
    const jsxFiltered = await FindPlayersPage({
      searchParams: Promise.resolve({ q: "stealth" }),
    });
    const htmlFiltered = renderToStaticMarkup(jsxFiltered);
    expect(htmlFiltered).toContain("Sam Secret");
    expect(htmlFiltered).not.toContain("Alex Champion");

    actionContext.setActionRepository(null);
  });

  it("displays limited information for private player profile", async () => {
    const repo = new InMemoryRepositories({
      playerAccounts: [publicPlayer, privatePlayer],
    });
    actionContext.setActionRepository(repo);

    // Viewing private player as another user (or logged out)
    const jsx = await PlayerPublicProfilePage({
      params: Promise.resolve({ username: "stealth_drop" }),
    });
    const html = renderToStaticMarkup(jsx);

    // Visible things
    expect(html).toContain("Sam Secret");
    expect(html).toContain("@stealth_drop");
    expect(html).toContain("Private");
    expect(html).toContain("This Profile is Private");

    // Hidden things (not visible for private profile)
    expect(html).not.toContain("Past Sessions");
    expect(html).not.toContain("Rating over time");
    expect(html).not.toContain("Chemistry Spotlight");
    expect(html).not.toContain("My Groups");
    expect(html).not.toContain("current rating");

    actionContext.setActionRepository(null);
  });
});

