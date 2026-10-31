import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionManagerClient } from "@/app/g/[groupId]/sessions/[sessionId]/session-manager-client";
import type { AttendanceRecord, PlayerRecord, RoundProposal, SessionRecord, StartedRoundRecord } from "@/lib/domain/types";

const mockStorage: Record<string, string> = {};
const storageMock: Storage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  },
  key: (index: number) => Object.keys(mockStorage)[index] || null,
  get length() {
    return Object.keys(mockStorage).length;
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("SessionManagerClient Component", () => {
  beforeEach(() => {
    storageMock.clear();
    Object.defineProperty(globalThis, "window", {
      value: {
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        localStorage: storageMock,
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storageMock,
      writable: true,
      configurable: true,
    });
  });
  const groupId = "grp_100";
  const sessionId = "ses_200";

  const completedSession: SessionRecord = {
    id: sessionId,
    groupId,
    courtCount: 2,
    status: "completed",
    startedAt: new Date("2026-10-10T14:00:00.000Z"),
    endedAt: new Date("2026-10-10T15:30:00.000Z"),
    currentRoundNumber: 1,
    version: 2,
  };

  const players: PlayerRecord[] = [
    { id: "p1", groupId, name: "Alice", active: true, initialRating: 1200, rating: 1210, ratedGamesPlayed: 1 },
    { id: "p2", groupId, name: "Bob", active: true, initialRating: 1200, rating: 1210, ratedGamesPlayed: 1 },
    { id: "p3", groupId, name: "Charlie", active: true, initialRating: 1200, rating: 1190, ratedGamesPlayed: 1 },
    { id: "p4", groupId, name: "Dave", active: true, initialRating: 1200, rating: 1190, ratedGamesPlayed: 1 },
  ];

  const attendance: AttendanceRecord[] = players.map((p) => ({
    sessionId,
    playerId: p.id,
    joinedRound: 1,
    leftRound: null,
  }));

  const startedRounds: StartedRoundRecord[] = [
    {
      round: {
        id: "rnd_1",
        sessionId,
        roundNumber: 1,
        status: "completed",
        seed: 1234,
        scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
        createdAt: new Date("2026-10-10T14:05:00.000Z"),
        startedAt: new Date("2026-10-10T14:05:00.000Z"),
        completedAt: new Date("2026-10-10T14:25:00.000Z"),
        version: 1,
      },
      matches: [
        {
          id: "m_1",
          roundId: "rnd_1",
          courtNumber: 1,
          team1Score: 11,
          team2Score: 7,
          status: "completed",
          completedAt: new Date("2026-10-10T14:25:00.000Z"),
          version: 1,
        },
      ],
      matchPlayers: [
        { matchId: "m_1", playerId: "p1", team: 1, ratingBefore: 1200, ratingAfter: 1210 },
        { matchId: "m_1", playerId: "p2", team: 1, ratingBefore: 1200, ratingAfter: 1210 },
        { matchId: "m_1", playerId: "p3", team: 2, ratingBefore: 1200, ratingAfter: 1190 },
        { matchId: "m_1", playerId: "p4", team: 2, ratingBefore: 1200, ratingAfter: 1190 },
      ],
      sits: [],
    },
  ];

  it("renders completed session summary view with stats and match results without redirecting", () => {
    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        groupName="Downtown Club"
        session={completedSession}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
      />
    );

    expect(html).toContain('data-testid="completed-session-full-view"');
    expect(html).toContain("Downtown Club");
    expect(html).toContain("Oct 10, 2026");
    expect(html).toContain("Completed Session");
    expect(html).toContain("Rounds");
    expect(html).toContain("Total Games");
    expect(html).toContain("Courts");
    expect(html).toContain("Players");
    expect(html).toContain("Player Summary");
    expect(html).toContain("Session highlights");
    expect(html).toContain("Closest game");
    expect(html).toContain("Most wins");
    expect(html).toContain("Most different partners");
    expect(html).toContain("Alice · Bob");
    expect(html).toContain("All Rounds &amp; Matchups");
    expect(html).toContain("Alice &amp; Bob");
    expect(html).toContain("Charlie &amp; Dave");
    expect(html).toContain("11");
    expect(html).toContain("7");
    expect(html).toContain("← Back to Group");
    expect(html).not.toContain('0<section data-testid="partner-requests"');
  });

  it("renders personal session view in session summary when a player is signed in", () => {
    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        groupName="Downtown Club"
        session={completedSession}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).toContain('data-testid="personal-session-summary"');
    expect(html).toContain("Your Session");
    expect(html).toContain("Games Won");
    expect(html).toContain("Games Lost");
    expect(html).toContain("Games Played");
    expect(html).toContain("You won 1 game and lost 0 games.");
  });

  it.each(["active", "empty"] as const)("does not show recap highlights for an %s session", (scenario) => {
    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={scenario === "active" ? { ...completedSession, status: "active", endedAt: null } : completedSession}
        players={players}
        startedRounds={scenario === "empty" ? [] : startedRounds}
        initialProposal={null}
      />
    );
    expect(html).not.toContain('data-testid="session-highlights"');
  });

  it("safely handles started rounds with missing matchPlayers or sits without throwing", () => {
    const partialStartedRounds = [
      {
        round: {
          id: "rnd_1",
          sessionId,
          roundNumber: 1,
          status: "completed" as const,
          seed: 1234,
          scoreBreakdown: {},
          createdAt: new Date("2026-10-10T14:05:00.000Z"),
          startedAt: new Date("2026-10-10T14:05:00.000Z"),
          completedAt: new Date("2026-10-10T14:25:00.000Z"),
          version: 1,
        },
        matches: [
          {
            id: "m_1",
            roundId: "rnd_1",
            courtNumber: 1,
            team1Score: 11,
            team2Score: 7,
            status: "completed" as const,
            completedAt: new Date("2026-10-10T14:25:00.000Z"),
            version: 1,
          },
        ],
      },
    ] as unknown as StartedRoundRecord[];

    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={completedSession}
        players={players}
        attendance={attendance}
        startedRounds={partialStartedRounds}
        initialProposal={null}
      />
    );

    expect(html).toContain('data-testid="completed-session-full-view"');
    expect(html).toContain("Completed Session");
    expect(html).toContain("Oct 10, 2026");
  });

  it("renders custom session name when provided and keeps date separate", () => {
    const namedSession = {
      ...completedSession,
      name: "Championship Finals",
    };
    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={namedSession}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        initialProposal={null}
      />
    );

    expect(html).toContain("Championship Finals");
    expect(html).toContain("October 10, 2026");
  });

  it("renders back button to profile when isFromProfile is true", () => {
    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={completedSession}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        initialProposal={null}
        isFromProfile={true}
      />
    );

    expect(html).toContain("← Back to Profile");
    expect(html).toContain('href="/players"');
  });

  it("does not include deleted players with no games played in Player Summary", () => {
    const playersWithDeleted: PlayerRecord[] = [
      ...players,
      { id: "p5", groupId, name: "Deleted Player", active: false, initialRating: 1200, rating: 1200, ratedGamesPlayed: 0 },
    ];
    const attendanceWithDeleted: AttendanceRecord[] = [
      ...attendance,
      { sessionId, playerId: "p5", joinedRound: 1, leftRound: null },
    ];

    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={completedSession}
        players={playersWithDeleted}
        attendance={attendanceWithDeleted}
        startedRounds={startedRounds}
        initialProposal={null}
      />
    );

    expect(html).not.toContain("Deleted Player");
  });

  it("renders reshuffle matchups controls for organizer in proposed round state", () => {
    const activeSession: SessionRecord = {
      ...completedSession,
      status: "active",
      endedAt: null,
      currentRoundNumber: 0,
    };
    const proposal: RoundProposal = {
      seed: 42,
      score: 0,
      scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
      courts: [
        { courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] },
      ],
      sitting: [],
    };

    const organizerHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        initialProposal={proposal}
        canManage={true}
        isOrganizer={true}
      />
    );

    expect(organizerHtml).toContain("Reshuffle");
    expect(organizerHtml).toContain('data-testid="reshuffle-matchups-button"');

    const memberHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        initialProposal={proposal}
        canManage={false}
        isOrganizer={false}
      />
    );

    expect(memberHtml).not.toContain("Reshuffle");
  });

  it("renders reshuffle matchups controls for organizer when round is in progress", () => {
    const activeSession: SessionRecord = {
      ...completedSession,
      status: "active",
      endedAt: null,
      currentRoundNumber: 1,
    };
    const inProgressRounds: StartedRoundRecord[] = [
      {
        round: {
          id: "rnd_1",
          sessionId,
          roundNumber: 1,
          status: "started",
          seed: 1234,
          scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
          createdAt: new Date("2026-10-10T14:05:00.000Z"),
          startedAt: new Date("2026-10-10T14:05:00.000Z"),
          completedAt: null,
          version: 1,
        },
        matches: [
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
        ],
        matchPlayers: [
          { matchId: "m_1", playerId: "p1", team: 1, ratingBefore: 1200, ratingAfter: 1210 },
          { matchId: "m_1", playerId: "p2", team: 1, ratingBefore: 1200, ratingAfter: 1210 },
          { matchId: "m_1", playerId: "p3", team: 2, ratingBefore: 1200, ratingAfter: 1190 },
          { matchId: "m_1", playerId: "p4", team: 2, ratingBefore: 1200, ratingAfter: 1190 },
        ],
        sits: [],
      },
    ];

    const organizerHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={attendance}
        startedRounds={inProgressRounds}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
      />
    );

    expect(organizerHtml).toContain("Reshuffle");
    expect(organizerHtml).toContain('data-testid="reshuffle-matchups-button"');
    expect(organizerHtml).toContain('data-testid="reshuffle-round-link"');

    const memberHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={attendance}
        startedRounds={inProgressRounds}
        initialProposal={null}
        canManage={false}
        isOrganizer={false}
      />
    );

    expect(memberHtml).not.toContain("Reshuffle");
  });

  it("renders Session Settings button for organizer and member in active session", () => {
    const activeSession: SessionRecord = {
      ...completedSession,
      status: "active",
      endedAt: null,
      currentRoundNumber: 0,
    };

    const organizerHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
      />
    );

    expect(organizerHtml).toContain("Session Settings");

    const memberHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        initialProposal={null}
        canManage={false}
        isOrganizer={false}
      />
    );

    expect(memberHtml).toContain("Session Settings");
  });

  it("does not treat cancelled matches in started rounds as games in progress", () => {
    const activeSession: SessionRecord = {
      ...completedSession,
      status: "active",
      endedAt: null,
      currentRoundNumber: 1,
    };

    const startedRoundsWithCancelled: StartedRoundRecord[] = [
      {
        round: {
          id: "rnd_active",
          sessionId,
          roundNumber: 1,
          status: "started",
          seed: 1234,
          scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
          createdAt: new Date("2026-10-10T14:05:00.000Z"),
          startedAt: new Date("2026-10-10T14:05:00.000Z"),
          completedAt: null,
          version: 1,
        },
        matches: [
          {
            id: "m_cancelled",
            roundId: "rnd_active",
            courtNumber: 1,
            team1Score: null,
            team2Score: null,
            status: "cancelled",
            completedAt: new Date("2026-10-10T14:10:00.000Z"),
            version: 2,
          },
        ],
        matchPlayers: [
          { matchId: "m_cancelled", playerId: "p1", team: 1, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_cancelled", playerId: "p2", team: 1, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_cancelled", playerId: "p3", team: 2, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_cancelled", playerId: "p4", team: 2, ratingBefore: 1200, ratingAfter: null },
        ],
        sits: [],
      },
    ];

    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={attendance}
        startedRounds={startedRoundsWithCancelled}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
      />
    );

    // Cancelled match badge is displayed
    expect(html).toContain("Cancelled");
    // In-progress warning modal should not be visible when no pending games remain
    expect(html).not.toContain("You have these games in progress:");
    expect(html).not.toContain('data-testid="in-progress-warning-modal"');
    // End Session button is present and not disabled by unsaved scores
    expect(html).toContain('data-testid="end-session-button"');
    expect(html).toContain("End Session");
  });

  it("renders unified attendance toggle for managers and badges for non-managers", () => {
    const activeSession: SessionRecord = {
      ...completedSession,
      status: "active",
      endedAt: null,
      currentRoundNumber: 1,
    };

    // p1 is present, p2 has left
    const mixedAttendance: AttendanceRecord[] = [
      { sessionId, playerId: "p1", joinedRound: 1, leftRound: null },
      { sessionId, playerId: "p2", joinedRound: 1, leftRound: 1 },
      { sessionId, playerId: "p3", joinedRound: 1, leftRound: null },
      { sessionId, playerId: "p4", joinedRound: 1, leftRound: null },
    ];

    const managerHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={mixedAttendance}
        startedRounds={[]}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
        initialOpenSettingsModal={true}
      />
    );

    // Manager sees unified toggle with Present and Left options in one control
    expect(managerHtml).toContain('data-testid="attendance-toggle-Alice"');
    expect(managerHtml).toContain('data-testid="attendance-present-Alice"');
    expect(managerHtml).toContain('data-testid="attendance-left-Alice"');
    // Alice is present -> Present has aria-pressed="true", Left has aria-pressed="false"
    expect(managerHtml).toMatch(/<button[^>]*aria-pressed="true"[^>]*data-testid="attendance-present-Alice"/);
    expect(managerHtml).toMatch(/<button[^>]*aria-pressed="false"[^>]*data-testid="attendance-left-Alice"/);

    // Bob has left -> Left has aria-pressed="true", Present has aria-pressed="false"
    expect(managerHtml).toContain('data-testid="attendance-toggle-Bob"');
    expect(managerHtml).toMatch(/<button[^>]*aria-pressed="false"[^>]*data-testid="attendance-present-Bob"/);
    expect(managerHtml).toMatch(/<button[^>]*aria-pressed="true"[^>]*data-testid="attendance-left-Bob"/);

    // Manager can pin players in attendance list
    expect(managerHtml).toContain('data-testid="pin-player-Alice"');
    expect(managerHtml).toContain('data-testid="pin-player-Bob"');

    // Present and Not Present sections are separated with counts
    expect(managerHtml).toContain("Present (3)");
    expect(managerHtml).toContain("Not Present / Left (1)");
    expect(managerHtml).toContain('data-testid="attendance-present-list"');
    expect(managerHtml).toContain('data-testid="attendance-not-present-list"');

    const nonManagerHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={mixedAttendance}
        startedRounds={[]}
        initialProposal={null}
        canManage={false}
        isOrganizer={false}
        initialOpenSettingsModal={true}
      />
    );

    // Non-manager cannot toggle attendance or pin players; sees read-only status
    expect(nonManagerHtml).not.toContain('data-testid="attendance-toggle-Alice"');
    expect(nonManagerHtml).not.toContain('data-testid="pin-player-Alice"');
    expect(nonManagerHtml).toContain("Present");
    expect(nonManagerHtml).toContain("Left");
  });

  it("turns the pin button black when pinned without displaying a little pin or text label next to the player name in session settings", () => {
    const activeSession: SessionRecord = {
      ...completedSession,
      status: "active",
      endedAt: null,
      currentRoundNumber: 1,
    };

    localStorage.setItem(`pickleball_pinned_players_${groupId}`, JSON.stringify([players[0].id]));

    const html = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={[]}
        startedRounds={[]}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
        initialOpenSettingsModal={true}
      />
    );

    // Pin button is styled black when pinned
    expect(html).toMatch(/<button[^>]*data-testid="pin-player-Alice"[^>]*class="[^"]*bg-black/);

    // No little pin icon or text label next to Alice's name
    expect(html).not.toContain('data-testid="pinned-indicator-Alice"');
    expect(html).not.toMatch(/Alice<\/span>\s*<span[^>]*>[^<]*Pinned<\/span>/);

    localStorage.removeItem(`pickleball_pinned_players_${groupId}`);
  });

  it("renders session settings tabs in correct order: Attendance, Court Configuration, Partners, Partner Synergies", () => {
    const activeSession: SessionRecord = {
      ...completedSession,
      status: "active",
      endedAt: null,
      currentRoundNumber: 1,
    };

    const managerHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={[]}
        startedRounds={[]}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
        initialOpenSettingsModal={true}
      />
    );

    // Verify tabs exist and labels match
    expect(managerHtml).toContain('id="tab-attendance"');
    expect(managerHtml).toContain('id="tab-court-config"');
    expect(managerHtml).toContain('id="tab-partners"');
    expect(managerHtml).toContain('id="tab-synergies"');

    // Verify modal header & tabs container is static (shrink-0) and tab content container is scrollable (overflow-y-auto flex-1)
    expect(managerHtml).toContain("shrink-0 space-y-4 bg-white");
    expect(managerHtml).toContain("flex-1 overflow-y-auto space-y-4");

    // Verify exact ordering in HTML: attendance -> court_config -> partners -> synergies
    const attendanceIndex = managerHtml.indexOf('id="tab-attendance"');
    const courtConfigIndex = managerHtml.indexOf('id="tab-court-config"');
    const partnersIndex = managerHtml.indexOf('id="tab-partners"');
    const synergiesIndex = managerHtml.indexOf('id="tab-synergies"');

    expect(attendanceIndex).toBeGreaterThan(-1);
    expect(courtConfigIndex).toBeGreaterThan(attendanceIndex);
    expect(partnersIndex).toBeGreaterThan(courtConfigIndex);
    expect(synergiesIndex).toBeGreaterThan(partnersIndex);

    // Verify non-manager only sees Attendance and Partners tabs
    const nonManagerHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={[]}
        startedRounds={[]}
        initialProposal={null}
        canManage={false}
        isOrganizer={false}
        initialOpenSettingsModal={true}
      />
    );

    expect(nonManagerHtml).toContain('id="tab-attendance"');
    expect(nonManagerHtml).toContain('id="tab-partners"');
    expect(nonManagerHtml).not.toContain('id="tab-court-config"');
    expect(nonManagerHtml).not.toContain('id="tab-synergies"');

    // Verify panels render for different tabs
    const courtConfigPanelHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={[]}
        startedRounds={[]}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
        initialOpenSettingsModal={true}
        initialSettingsModalTab="court_config"
      />
    );
    expect(courtConfigPanelHtml).toContain('id="tabpanel-court-config"');
    expect(courtConfigPanelHtml).toContain("Save Court Configuration");
    expect(courtConfigPanelHtml).toContain('aria-label="Players on court 1"');
    expect(courtConfigPanelHtml).toContain("text-xs font-bold text-black");

    const partnersPanelHtml = renderToStaticMarkup(
      <SessionManagerClient
        groupId={groupId}
        session={activeSession}
        players={players}
        attendance={[]}
        startedRounds={[]}
        initialProposal={null}
        canManage={true}
        isOrganizer={true}
        initialOpenSettingsModal={true}
        initialSettingsModalTab="partners"
      />
    );
    expect(partnersPanelHtml).toContain('id="tabpanel-partners"');
  });
});

