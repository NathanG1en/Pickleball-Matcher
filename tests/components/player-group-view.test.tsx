import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GroupDashboardPage from "@/app/g/[groupId]/page";
import GroupPlayersPage from "@/app/g/[groupId]/players/page";
import ActiveSessionPage from "@/app/g/[groupId]/sessions/[sessionId]/page";
import NewSessionPage from "@/app/g/[groupId]/sessions/new/page";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import * as actionContext from "@/app/actions/action-context";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActivePlayerAccountId: vi.fn(),
    getActiveOrganizerSession: vi.fn(),
    requireOrganizer: vi.fn(),
    requirePlayer: vi.fn(),
  };
});

describe("Player View for Groups and Sessions", () => {
  const hostAccountId = "acc_host";
  const memberAccountId = "acc_member";
  const nonMemberAccountId = "acc_outsider";
  const groupId = "grp_test";
  const activeSessionId = "ses_active";

  beforeEach(() => {
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(memberAccountId);
    vi.mocked(actionContext.getActiveOrganizerSession).mockResolvedValue(null);
  });

  afterEach(() => {
    setActionRepository(null);
    vi.clearAllMocks();
  });

  function createTestRepository(options?: { activeSession?: boolean; activeRound?: boolean }) {
    return new InMemoryRepositories({
      groups: [
        {
          id: groupId,
          name: "Pickleball Squad",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: hostAccountId,
        },
      ],
      playerAccounts: [
        {
          id: hostAccountId,
          username: "host_pro",
          name: "Host Pro",
          passwordHash: "hash",
          skillLevel: "advanced",
          initialRating: 1200,
          createdAt: new Date(),
        },
        {
          id: memberAccountId,
          username: "member_joe",
          name: "Member Joe",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: nonMemberAccountId,
          username: "outsider_bob",
          name: "Outsider Bob",
          passwordHash: "hash",
          skillLevel: "beginner",
          initialRating: 900,
          createdAt: new Date(),
        },
      ],
      players: [
        {
          id: "p_host",
          groupId,
          name: "Host Pro",
          initialRating: 1200,
          rating: 1200,
          ratedGamesPlayed: 10,
          active: true,
          accountId: hostAccountId,
          username: "host_pro",
        },
        {
          id: "p_member",
          groupId,
          name: "Member Joe",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 5,
          active: true,
          accountId: memberAccountId,
          username: "member_joe",
        },
        {
          id: "p_other",
          groupId,
          name: "Other Player",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 2,
          active: true,
          accountId: null,
        },
      ],
      sessions: options?.activeSession
        ? [
            {
              id: activeSessionId,
              groupId,
              startedAt: new Date(),
              endedAt: null,
              status: "active",
              courtCount: 2,
              currentRoundNumber: 1,
              version: 1,
            },
          ]
        : [],
      rounds: options?.activeRound
        ? [
            {
              id: "rnd_1",
              sessionId: activeSessionId,
              roundNumber: 1,
              status: "started",
              seed: 1234,
              scoreBreakdown: {
                playingTime: 0,
                consecutiveSit: 0,
                partnerRepeat: 0,
                skillBalance: 0,
                opponentRepeat: 0,
                tieBreak: 0,
                total: 0,
              },
              createdAt: new Date(),
              startedAt: new Date(),
              completedAt: null,
              version: 1,
            },
          ]
        : [],
      matches: options?.activeRound
        ? [
            {
              id: "m_1",
              roundId: "rnd_1",
              courtNumber: 1,
              team1Score: null,
              team2Score: null,
              status: "pending",
              completedAt: null,
              version: 1,
            },
          ]
        : [],
      matchPlayers: options?.activeRound
        ? [
            {
              matchId: "m_1",
              playerId: "p_host",
              team: 1,
              ratingBefore: null,
              ratingAfter: null,
            },
            {
              matchId: "m_1",
              playerId: "p_member",
              team: 2,
              ratingBefore: null,
              ratingAfter: null,
            },
          ]
        : [],
    });
  }

  describe("GroupDashboardPage", () => {
    it("allows a group member to view the dashboard with read-only permissions", async () => {
      const repo = createTestRepository();
      setActionRepository(repo);

      const pageJsx = await GroupDashboardPage({ params: Promise.resolve({ groupId }) });
      const html = renderToStaticMarkup(pageJsx);

      // Can see group info and roster
      expect(html).toContain("Pickleball Squad");
      expect(html).toContain("Member Joe");
      expect(html).toContain("Host Pro");
      expect(html).toContain("Other Player");

      // Cannot see group ID
      expect(html).not.toContain("Group ID");
      expect(html).not.toContain("••••••••••••••••");

      // Cannot change privacy settings
      expect(html).not.toContain("Player discovery");
      expect(html).not.toContain("Make private");
      expect(html).not.toContain("Make public");

      // Cannot see delete group menu
      expect(html).not.toContain("Delete Group");

      // Cannot start sessions
      expect(html).not.toContain("Start New Session");
      expect(html).toContain("No Active Session");

      // Cannot add people via username form
      expect(html).not.toContain("Find player by username");
      expect(html).not.toContain("Find &amp; Add");

      // Group name editor is not editable
      expect(html).not.toContain("Edit group name");
    });

    it("allows organizers to see organizer controls and start sessions", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(hostAccountId);
      const repo = createTestRepository();
      setActionRepository(repo);

      const pageJsx = await GroupDashboardPage({ params: Promise.resolve({ groupId }) });
      const html = renderToStaticMarkup(pageJsx);

      // Organizer controls visible
      expect(html).toContain("Group ID");
      expect(html).toContain("Player discovery");
      expect(html).toContain("Start New Session");
      expect(html).toContain("Find player by username");
      expect(html).toContain("Edit group name");
    });

    it("displays active session and current matchups to members", async () => {
      const repo = createTestRepository({ activeSession: true, activeRound: true });
      setActionRepository(repo);

      const pageJsx = await GroupDashboardPage({ params: Promise.resolve({ groupId }) });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain("Session In Progress");
      expect(html).toContain("Current Matchups");
      expect(html).toContain("Court 1");
      expect(html).toContain("Host Pro vs Member Joe");
      expect(html).toContain("View Live Session →");
      expect(html).not.toContain("Resume Session →");
    });

    it("redirects non-members to /players", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(nonMemberAccountId);
      const repo = createTestRepository();
      setActionRepository(repo);

      await expect(
        GroupDashboardPage({ params: Promise.resolve({ groupId }) })
      ).rejects.toThrow("REDIRECT:/players");
    });

    it("redirects unauthenticated visitors to /g/[groupId]/login", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(null);
      const repo = createTestRepository();
      setActionRepository(repo);

      await expect(
        GroupDashboardPage({ params: Promise.resolve({ groupId }) })
      ).rejects.toThrow(`REDIRECT:/g/${groupId}/login`);
    });
  });

  describe("ActiveSessionPage", () => {
    it("allows group members to view live session without management controls", async () => {
      const repo = createTestRepository({ activeSession: true, activeRound: true });
      setActionRepository(repo);

      const pageJsx = await ActiveSessionPage({
        params: Promise.resolve({ groupId, sessionId: activeSessionId }),
      });
      const html = renderToStaticMarkup(pageJsx);

      // Shows current games and matchups
      expect(html).toContain("Court 1");
      expect(html).toContain("Host Pro");
      expect(html).toContain("Member Joe");
      expect(html).toContain("Live Games");

      // No attendance or end session buttons
      expect(html).not.toContain("Attendance");
      expect(html).not.toContain("End Session");

      // No score input fields or save buttons
      expect(html).not.toContain('type="number"');
      expect(html).not.toContain("Save Result");
      expect(html).not.toContain("Cancel match");
      expect(html).not.toContain("Next Round");
      expect(html).not.toContain("Undo Round");
    });

    it("redirects unauthorized users", async () => {
      vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(nonMemberAccountId);
      const repo = createTestRepository({ activeSession: true });
      setActionRepository(repo);

      await expect(
        ActiveSessionPage({
          params: Promise.resolve({ groupId, sessionId: activeSessionId }),
        })
      ).rejects.toThrow("REDIRECT:/players");
    });
  });

  describe("GroupPlayersPage", () => {
    it("renders roster in read-only mode for members", async () => {
      const repo = createTestRepository();
      setActionRepository(repo);

      const pageJsx = await GroupPlayersPage({ params: Promise.resolve({ groupId }) });
      const html = renderToStaticMarkup(pageJsx);

      // Shows roster
      expect(html).toContain("Pickleball Squad Roster");
      expect(html).toContain("Member Joe");
      expect(html).toContain("Host Pro");

      // No Add Player form
      expect(html).not.toContain("Add Player");
      expect(html).not.toContain("player-name-input");

      // No Delete button
      expect(html).not.toContain("Delete");
    });
  });

  describe("NewSessionPage", () => {
    it("redirects non-organizer player back to group dashboard", async () => {
      const repo = createTestRepository();
      setActionRepository(repo);
      vi.mocked(actionContext.requireOrganizer).mockRejectedValue(new Error("Unauthorized"));

      await expect(
        NewSessionPage({ params: Promise.resolve({ groupId }) })
      ).rejects.toThrow(`REDIRECT:/g/${groupId}`);
    });
  });
});
