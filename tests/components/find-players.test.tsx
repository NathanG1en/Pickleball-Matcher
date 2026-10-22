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

  it("renders public and private players with username, display name, gender, and rating", () => {
    const html = renderToStaticMarkup(
      <FindPlayerList
        players={[publicPlayer, privatePlayer]}
        currentAccountId="usr_pub"
      />
    );

    // Display names
    expect(html).toContain("Alex Champion");
    expect(html).toContain("Sam Secret");

    // Usernames
    expect(html).toContain("@pickle_ace");
    expect(html).toContain("@stealth_drop");

    // Genders
    expect(html).toContain("Female");
    expect(html).toContain("Male");

    // Ratings (formatDupr formats Elo: 1000 -> 3.5, 1050 -> 3.625, 1240 -> 4.1)
    expect(html).toContain("Rating:");
    expect(html).toContain("3.625");
    expect(html).toContain("4.1");

    // Badges
    expect(html).toContain("Public");
    expect(html).toContain("Private");
    expect(html).toContain("You");

    // Links to profiles
    expect(html).toContain('href="/players/pickle_ace"');
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

