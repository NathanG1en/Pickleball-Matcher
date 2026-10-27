import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import PlayerProfilePage from "@/app/players/page";
import PlayerPublicProfilePage from "@/app/players/[username]/page";
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
  notFound: vi.fn(),
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
    expect(htmlPublic).not.toContain("Account Visibility");
    expect(htmlPublic).toContain('aria-label="Account visibility details"');

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
    expect(htmlPrivate).not.toContain("Account Visibility");
    expect(htmlPrivate).toContain('aria-label="Account visibility details"');
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
    expect(html).toContain("+80 Synergy");
    expect(html).toContain("8 matches");
  });

  it("PlayerProfilePage renders encouraging Doubles Synergy empty state when no partner exists yet", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "solo_player",
          name: "Solo Player",
          isPublic: true,
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    const PageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(PageElement);

    expect(html).toContain("Doubles Synergy");
    expect(html).toContain("Play doubles matches with other registered accounts");
  });

  describe("PlayerPublicProfilePage (/players/[username])", () => {
    it("renders full profile when target is public", async () => {
      const repository = new InMemoryRepositories({
        playerAccounts: [
          {
            id: "target_1",
            username: "public_star",
            name: "Star Player",
            isPublic: true,
            passwordHash: "hash",
            skillLevel: "advanced",
            initialRating: 1200,
            rating: 1250,
            gender: "male",
            createdAt: new Date(),
          },
          {
            id: "partner_1",
            username: "chem_partner",
            name: "Partner Player",
            isPublic: true,
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1100,
            createdAt: new Date(),
          },
        ],
        synergies: [
          {
            accountId1: "partner_1",
            accountId2: "target_1",
            matchesPlayed: 10,
            wins: 9,
            synergyScore: 0.83,
            updatedAt: new Date(),
          },
        ],
      });
      setActionRepository(repository);

      // Viewer is another user
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("viewer_other");

      const PageElement = await PlayerPublicProfilePage({
        params: Promise.resolve({ username: "public_star" }),
      });
      const html = renderToStaticMarkup(PageElement);

      expect(html).toContain("Star Player");
      expect(html).toContain("@public_star");
      expect(html).toContain("Male");
      expect(html).toContain("Competitive");
      expect(html).toContain("Public");
      expect(html).toContain("Best Partner");
      expect(html).toContain("@chem_partner");
      expect(html).toContain("+83 Synergy");
      expect(html).toContain("Rating over time");
      expect(html).toContain("Past Sessions");
      expect(html).not.toContain("This Profile is Private");
    });

    it("renders only display name and username when target is private and viewer is another user", async () => {
      const repository = new InMemoryRepositories({
        playerAccounts: [
          {
            id: "target_private",
            username: "secret_ace",
            name: "Secret Ace",
            isPublic: false,
            passwordHash: "hash",
            skillLevel: "advanced",
            initialRating: 1300,
            rating: 1350,
            gender: "female",
            createdAt: new Date(),
          },
        ],
      });
      setActionRepository(repository);

      // Viewer is another user
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("viewer_other");

      const PageElement = await PlayerPublicProfilePage({
        params: Promise.resolve({ username: "secret_ace" }),
      });
      const html = renderToStaticMarkup(PageElement);

      // Should contain display name and username
      expect(html).toContain("Secret Ace");
      expect(html).toContain("@secret_ace");
      expect(html).toContain("Private");
      expect(html).toContain("This Profile is Private");

      // Should NOT contain private stats, rating, gender, etc.
      expect(html).not.toContain("Female");
      expect(html).not.toContain("Competitive");
      expect(html).not.toContain("Best Partner");
      expect(html).not.toContain("Rating over time");
      expect(html).not.toContain("Past Sessions");
      expect(html).not.toContain("current rating");
    });

    it("renders full profile when viewer is the owner even if account is private", async () => {
      const repository = new InMemoryRepositories({
        playerAccounts: [
          {
            id: "owner_private_acc",
            username: "my_stealth_acc",
            name: "My Stealth Name",
            isPublic: false,
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            rating: 1050,
            createdAt: new Date(),
          },
        ],
      });
      setActionRepository(repository);

      // Viewer is the owner
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("owner_private_acc");

      const PageElement = await PlayerPublicProfilePage({
        params: Promise.resolve({ username: "my_stealth_acc" }),
      });
      const html = renderToStaticMarkup(PageElement);

      expect(html).toContain("My Stealth Name");
      expect(html).toContain("@my_stealth_acc");
      expect(html).toContain("Advanced Intermediate");
      expect(html).toContain("Rating over time");
      expect(html).toContain("Past Sessions");
      expect(html).not.toContain("This Profile is Private");
    });

    it("shows wins and losses for past sessions but hides the 'Go to session' button when viewing another player's profile", async () => {
      const repository = new InMemoryRepositories({
        playerAccounts: [
          {
            id: "target_public_user",
            username: "charlie_pb",
            name: "Charlie Pickle",
            isPublic: true,
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            rating: 1050,
            createdAt: new Date(),
          },
        ],
        groups: [
          { id: "grp-1", name: "Metro Club", organizerPinHash: "hash", createdAt: new Date(), isPublic: true },
        ],
        players: [
          { id: "p-charlie", groupId: "grp-1", accountId: "target_public_user", name: "Charlie Pickle", initialRating: 1000, rating: 1050, ratedGamesPlayed: 1, active: true },
        ],
      });

      repository.state.sessions.push({
        id: "sess-1",
        groupId: "grp-1",
        name: "Morning Open Play",
        courtCount: 2,
        currentRoundNumber: 1,
        status: "completed",
        type: "open_play",
        startedAt: new Date(),
        endedAt: new Date(),
        version: 1,
      });
      repository.state.attendance.push({
        sessionId: "sess-1",
        playerId: "p-charlie",
        joinedRound: 1,
        leftRound: null,
      });
      repository.state.rounds.push({
        id: "r-1",
        sessionId: "sess-1",
        roundNumber: 1,
        status: "completed",
        seed: 1,
        scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        version: 1,
      });
      repository.state.matches.push({
        id: "m-1",
        roundId: "r-1",
        courtNumber: 1,
        status: "completed",
        team1Score: 11,
        team2Score: 7,
        completedAt: new Date(),
        version: 1,
      });
      repository.state.matchPlayers.push({
        matchId: "m-1",
        playerId: "p-charlie",
        team: 1,
        ratingBefore: 1000,
        ratingAfter: 1050,
      });

      setActionRepository(repository);

      // Viewer is another user (not the owner)
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("viewer_other_user");

      const PageElement = await PlayerPublicProfilePage({
        params: Promise.resolve({ username: "charlie_pb" }),
      });
      const html = renderToStaticMarkup(PageElement);

      // Past sessions and wins/losses should be visible
      expect(html).toContain("Past Sessions");
      expect(html).toContain("Morning Open Play");
      expect(html).toContain("Metro Club (Open Play)");
      expect(html).toContain("1W – 0L");

      // Go to session button and session links should NOT be present for other players
      expect(html).not.toContain("Go to session");
      expect(html).not.toContain('href="/g/grp-1/sessions/sess-1');
    });

    it("shows the 'Go to session' button when a player views their own profile at /players/[username]", async () => {
      const repository = new InMemoryRepositories({
        playerAccounts: [
          {
            id: "target_public_user",
            username: "charlie_pb",
            name: "Charlie Pickle",
            isPublic: true,
            passwordHash: "hash",
            skillLevel: "intermediate",
            initialRating: 1000,
            rating: 1050,
            createdAt: new Date(),
          },
        ],
        groups: [
          { id: "grp-1", name: "Metro Club", organizerPinHash: "hash", createdAt: new Date(), isPublic: true },
        ],
        players: [
          { id: "p-charlie", groupId: "grp-1", accountId: "target_public_user", name: "Charlie Pickle", initialRating: 1000, rating: 1050, ratedGamesPlayed: 1, active: true },
        ],
      });

      repository.state.sessions.push({
        id: "sess-1",
        groupId: "grp-1",
        name: "Morning Open Play",
        courtCount: 2,
        currentRoundNumber: 1,
        status: "completed",
        type: "open_play",
        startedAt: new Date(),
        endedAt: new Date(),
        version: 1,
      });
      repository.state.attendance.push({
        sessionId: "sess-1",
        playerId: "p-charlie",
        joinedRound: 1,
        leftRound: null,
      });
      repository.state.rounds.push({
        id: "r-1",
        sessionId: "sess-1",
        roundNumber: 1,
        status: "completed",
        seed: 1,
        scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        version: 1,
      });
      repository.state.matches.push({
        id: "m-1",
        roundId: "r-1",
        courtNumber: 1,
        status: "completed",
        team1Score: 11,
        team2Score: 7,
        completedAt: new Date(),
        version: 1,
      });
      repository.state.matchPlayers.push({
        matchId: "m-1",
        playerId: "p-charlie",
        team: 1,
        ratingBefore: 1000,
        ratingAfter: 1050,
      });

      setActionRepository(repository);

      // Viewer IS the owner
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("target_public_user");

      const PageElement = await PlayerPublicProfilePage({
        params: Promise.resolve({ username: "charlie_pb" }),
      });
      const html = renderToStaticMarkup(PageElement);

      // Past sessions and wins/losses should be visible
      expect(html).toContain("Past Sessions");
      expect(html).toContain("Morning Open Play");
      expect(html).toContain("Metro Club (Open Play)");
      expect(html).toContain("1W – 0L");

      // Go to session button and link SHOULD be present for the owner
      expect(html).toContain("Go to session");
      expect(html).toContain('href="/g/grp-1/sessions/sess-1?from=profile"');
    });
  });
});

