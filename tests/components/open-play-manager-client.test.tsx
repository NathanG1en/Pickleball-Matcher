import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OpenPlayManagerClient } from "@/app/g/[groupId]/sessions/[sessionId]/open-play-manager-client";
import type { AttendanceRecord, PlayerRecord, SessionRecord, StartedRoundRecord } from "@/lib/domain/types";

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

describe("OpenPlayManagerClient Component", () => {
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
  const sessionId = "ses_open_play_1";

  const session: SessionRecord = {
    id: sessionId,
    groupId,
    name: "Open Play Session",
    type: "open_play",
    courtCount: 2,
    status: "active",
    startedAt: new Date("2026-10-10T14:00:00.000Z"),
    endedAt: null,
    currentRoundNumber: 1,
    version: 1,
  };

  const players: PlayerRecord[] = [
    { id: "p1", groupId, name: "Alice", active: true, initialRating: 1200, rating: 1200, ratedGamesPlayed: 0 },
    { id: "p2", groupId, name: "Bob", active: true, initialRating: 1200, rating: 1200, ratedGamesPlayed: 0 },
    { id: "p3", groupId, name: "Charlie", active: true, initialRating: 1200, rating: 1200, ratedGamesPlayed: 0 },
    { id: "p4", groupId, name: "Dave", active: true, initialRating: 1200, rating: 1200, ratedGamesPlayed: 0 },
  ];

  const attendance: AttendanceRecord[] = players.map((p) => ({
    sessionId,
    playerId: p.id,
    joinedRound: 1,
    leftRound: null,
  }));

  it("renders match type switcher with responsive smaller text to ensure singles option is not cut off", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // Verify both Doubles and Singles options are rendered
    expect(html).toContain("Doubles (2v2)");
    expect(html).toContain("Singles (1v1)");

    // Verify smaller text and shrink-0 classes are applied for mobile fit
    expect(html).toContain("text-[10px]");
    expect(html).toContain("sm:text-xs");
    expect(html).toContain("shrink-0");
    expect(html).toContain("whitespace-nowrap");
    expect(html).not.toContain("Record a match played between session players.");
    expect(html).not.toContain("Record an additional match for this ended session.");
  });

  it("renders the three dots options menu inside the session card matching normal sessions", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // Verify Open Play badge is not rendered
    expect(html).not.toContain("bg-black text-[#ccff00]");

    // Verify Session Options Menu button and title positions
    const optionsIndex = html.indexOf('data-testid="session-options-menu-button"');
    const sessionNameIndex = html.indexOf("Open Play Session");
    const endSessionIndex = html.indexOf('data-testid="end-session-button"');

    expect(optionsIndex).toBeGreaterThan(-1);
    expect(sessionNameIndex).toBeGreaterThan(-1);
    expect(endSessionIndex).toBeGreaterThan(-1);

    // End session is in the top header controls before the session card
    expect(endSessionIndex).toBeLessThan(sessionNameIndex);
    // Three dots menu is in the session card alongside/after the session title
    expect(sessionNameIndex).toBeLessThan(optionsIndex);

    // End session button matches normal session styling
    expect(html).toContain("bg-[#ff6b6b]");
    expect(html).toContain("border-2 border-black font-black uppercase text-[10px] sm:text-xs text-black");
    expect(html).not.toContain("bg-red-500 hover:bg-red-600 text-white");

    // "In Progress" badge is removed
    expect(html).not.toContain("In Progress");
  });

  it("renders Add Existing Group Member dropdown directly without a separate submit button", () => {
    // Attendance with Dave missing, so Dave is an available roster player
    const attendanceWithoutDave: AttendanceRecord[] = [
      { sessionId, playerId: "p1", joinedRound: 1, leftRound: null },
      { sessionId, playerId: "p2", joinedRound: 1, leftRound: null },
      { sessionId, playerId: "p3", joinedRound: 1, leftRound: null },
    ];

    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendanceWithoutDave}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).toContain("Add Existing Group Member");
    expect(html).toContain('data-testid="roster-player-select"');
    // Ensure there is no separate submit button for adding from roster
    expect(html).not.toContain('disabled="" class="px-4 py-2 rounded-xl bg-black text-white font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]');
  });

  it("renders game score inputs with font-bold text-sm styling", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).toContain('aria-label="Team 1 Score"');
    expect(html).toContain('aria-label="Team 2 Score"');
    expect(html).toContain("font-mono font-bold text-sm text-center");
    expect(html).not.toContain("font-mono font-black text-lg text-center");
  });

  it("renders guest player form with gender select options", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).toContain('id="guest-name-input"');
    expect(html).toContain('aria-label="Guest Gender"');
    expect(html).toContain('id="open-play-guest-gender"');
    expect(html).toContain("Male");
    expect(html).toContain('data-testid="guest-description-banner"');
    expect(html).toContain("Adding a guest here will add them to your roster.");
    expect(html).toContain('data-testid="dismiss-guest-desc-button"');
  });

  it("hides open play guest description banner when dismissed in sessionStorage", () => {
    const originalSessionStorage = globalThis.sessionStorage;
    const storageMap = new Map<string, string>();
    storageMap.set("pickleball_dismiss_guest_desc", "true");

    Object.defineProperty(globalThis, "sessionStorage", {
      value: {
        getItem: (key: string) => storageMap.get(key) ?? null,
        setItem: (key: string, val: string) => storageMap.set(key, val),
        removeItem: (key: string) => storageMap.delete(key),
      },
      writable: true,
      configurable: true,
    });

    try {
      const html = renderToStaticMarkup(
        <OpenPlayManagerClient
          groupId={groupId}
          groupName="Test Group"
          session={session}
          players={players}
          attendance={attendance}
          startedRounds={[]}
          isOrganizer={true}
          isHost={true}
          isMember={true}
          currentViewerPlayerId="p1"
        />
      );

      expect(html).not.toContain('data-testid="guest-description-banner"');
    } finally {
      Object.defineProperty(globalThis, "sessionStorage", {
        value: originalSessionStorage,
        writable: true,
        configurable: true,
      });
    }
  });

  it("renders general session info and personal session view with games won and lost in open play", () => {
    const startedRounds: StartedRoundRecord[] = [
      {
        round: {
          id: "rnd_1",
          sessionId,
          roundNumber: 1,
          status: "started",
          seed: 1,
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
            team1Score: 11,
            team2Score: 8,
            status: "completed",
            completedAt: new Date("2026-10-10T14:20:00.000Z"),
            version: 1,
          },
        ],
        matchPlayers: [
          { matchId: "m_1", playerId: "p1", team: 1, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_1", playerId: "p2", team: 1, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_1", playerId: "p3", team: 2, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_1", playerId: "p4", team: 2, ratingBefore: 1200, ratingAfter: null },
        ],
        sits: [],
      },
    ];

    const activeHtml = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // Session summary should NOT be present when session has not ended
    expect(activeHtml).not.toContain('data-testid="personal-session-summary"');
    expect(activeHtml).not.toContain("Total Games");
    expect(activeHtml).not.toContain("Your Session");

    // Session summary SHOULD be present when session is completed
    const completedSession: SessionRecord = {
      ...session,
      status: "completed",
      endedAt: new Date("2026-10-10T15:30:00.000Z"),
    };

    const completedHtml = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={completedSession}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // General session info on completed session
    expect(completedHtml).not.toContain("Courts");
    expect(completedHtml).toContain("Total Games");
    expect(completedHtml).toContain("Players");

    // Personal session view on completed session
    expect(completedHtml).toContain('data-testid="personal-session-summary"');
    expect(completedHtml).toContain("Your Session");
    expect(completedHtml).toContain("Games Won");
    expect(completedHtml).toContain("Games Lost");
    expect(completedHtml).toContain("Games Played");
    expect(completedHtml).toContain("You won 1 game and lost 0 games.");
  });

  it("renders Player Summary leaderboard when open play session is completed", () => {
    const completedSession: SessionRecord = {
      ...session,
      status: "completed",
      endedAt: new Date("2026-10-10T15:30:00.000Z"),
    };

    const startedRounds: StartedRoundRecord[] = [
      {
        round: {
          id: "rnd_1",
          sessionId,
          roundNumber: 1,
          status: "completed",
          seed: 1,
          scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
          createdAt: new Date("2026-10-10T14:05:00.000Z"),
          startedAt: new Date("2026-10-10T14:05:00.000Z"),
          completedAt: new Date("2026-10-10T14:20:00.000Z"),
          version: 1,
        },
        matches: [
          {
            id: "m_1",
            roundId: "rnd_1",
            courtNumber: 1,
            team1Score: 11,
            team2Score: 8,
            status: "completed",
            completedAt: new Date("2026-10-10T14:20:00.000Z"),
            version: 1,
          },
        ],
        matchPlayers: [
          { matchId: "m_1", playerId: "p1", team: 1, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_1", playerId: "p2", team: 1, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_1", playerId: "p3", team: 2, ratingBefore: 1200, ratingAfter: null },
          { matchId: "m_1", playerId: "p4", team: 2, ratingBefore: 1200, ratingAfter: null },
        ],
        sits: [],
      },
    ];

    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={completedSession}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).toContain("Player Summary");
    expect(html).toContain("1W – 0L");
    expect(html).toContain("0W – 1L");
    expect(html).toContain("Ended:");
    expect(html).toContain("Duration:");
  });

  it("pins players for check in (roster dropdown) but does not pin for in-game selection", () => {
    // 5 players on roster: Alice (p1), Bob (p2), Charlie (p3), Dave (p4), Evan (p5)
    const fivePlayers: PlayerRecord[] = [
      ...players,
      { id: "p5", groupId, name: "Evan", active: true, initialRating: 1200, rating: 1200, ratedGamesPlayed: 0 },
    ];

    // Only Alice, Bob, Charlie, Dave are checked in; Evan is not checked in
    const attendanceWithoutEvan: AttendanceRecord[] = [
      { sessionId, playerId: "p1", joinedRound: 1, leftRound: null },
      { sessionId, playerId: "p2", joinedRound: 1, leftRound: null },
      { sessionId, playerId: "p3", joinedRound: 1, leftRound: null },
      { sessionId, playerId: "p4", joinedRound: 1, leftRound: null },
    ];

    // Pin Evan (un-checked-in) and Dave (checked-in)
    localStorage.setItem(`pickleball_pinned_players_${groupId}`, JSON.stringify(["p5", "p4"]));

    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={fivePlayers}
        attendance={attendanceWithoutEvan}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // 1. Check in: Evan is available on roster and is marked with isPinned: true (not emoji 📌)
    expect(html).toContain("Evan (4)");
    expect(html).not.toContain("📌");
    expect(html).toContain('&quot;name&quot;:&quot;Evan (4)&quot;,&quot;isPinned&quot;:true');

    // 2. In-game selection: Dave is pinned, but options in slot selection must NOT have pin icon
    // and must remain alphabetical (Alice, Bob, Charlie, Dave)
    expect(html).toContain('aria-label="Team 1 Player 1"');
    const selectSection = html.slice(html.indexOf('aria-label="Team 1 Player 1"'), html.indexOf("Team 1 Points"));
    expect(selectSection).not.toContain('data-testid="black-pin-icon"');

    // Option to pin players is not present in open play player management chips
    expect(html).not.toContain('data-testid="pin-player-Dave"');
    expect(html).not.toContain('aria-label="Unpin Dave"');

    localStorage.removeItem(`pickleball_pinned_players_${groupId}`);
  });

  it("renders rotate partners, swap sides, and clear buttons in game submission card without rematch or next waiting option", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).not.toContain('data-testid="rematch-button"');
    expect(html).not.toContain("Rematch");
    expect(html).toContain('data-testid="rotate-partners-button"');
    expect(html).toContain("Rotate Partners");
    expect(html).toContain('data-testid="swap-sides-button"');
    expect(html).toContain("Swap Sides");
    expect(html).not.toContain('data-testid="next-waiting-button"');
    expect(html).not.toContain("Next Waiting");
    expect(html).toContain('data-testid="clear-slots-button"');
    expect(html).toContain("Clear");
  });

  it("renders Team 1 and Team 2 Winner selection buttons in game submission cards with prominent styling", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).toContain('data-testid="team-1-winner-button"');
    expect(html).toContain('data-testid="team-2-winner-button"');
    expect(html).toContain("Select Winner");
    expect(html).toContain("bg-[#fde047]");
    expect(html).not.toContain("Winner (11)");
    expect(html).toContain("whitespace-nowrap");
  });

  it("does not render quick score preset buttons in open play", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).not.toContain("Quick Scores:");
    expect(html).not.toContain("11–9");
    expect(html).not.toContain("15–13");
  });

  it("does not render live label badge in open play header", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).not.toContain('data-testid="live-sync-indicator"');
    expect(html).not.toContain("Live");
    expect(html).not.toContain("Checked In");
    expect(html).not.toContain("In Progress");
  });

  it("replaces emojis in open play toolbar and winner buttons with clean svg icons", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // Verify emojis are not present
    expect(html).not.toContain("⚔️");
    expect(html).not.toContain("🔄");
    expect(html).not.toContain("👑");

    // Verify action buttons exist
    expect(html).not.toContain('data-testid="rematch-button"');
    expect(html).toContain('data-testid="rotate-partners-button"');
    expect(html).toContain('data-testid="swap-sides-button"');
    expect(html).toContain('data-testid="team-1-winner-button"');
    expect(html).toContain('data-testid="team-2-winner-button"');
  });

  it("renders a collapsible drawer toggle button to hide or show checked-in players", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // Verify drawer toggle button is rendered inside its own box
    expect(html).toContain('data-testid="checked-in-players-box"');
    expect(html).toContain('data-testid="toggle-players-drawer-button"');
    expect(html).toContain("Hide Players");
    expect(html).toContain('aria-controls="checked-in-players-drawer"');
    expect(html).toContain('data-testid="checked-in-players-drawer"');
    expect(html).toContain('data-testid="open-play-attendees"');
  });

  it("renders mode switch tabs matching roster style for adding existing members and guests", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // Verify tabs are rendered inside add-players-box
    expect(html).toContain('data-testid="add-players-box"');
    expect(html).toContain('data-testid="tab-add-member"');
    expect(html).toContain('data-testid="tab-add-guest"');
    expect(html).toContain("Existing Member");
    expect(html).toContain("Add Guest");
    expect(html).toContain('role="tablist"');
  });

  it("renders swap sides button with doubles title when matchType is doubles", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    expect(html).toContain('title="Swap sides between Team 1 and Team 2"');
    expect(html).toContain('data-testid="swap-sides-button"');
  });

  it("says Player 1 and Player 2 instead of Team 1 and Team 2 for singles in open play", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
        initialMatchType="singles"
      />
    );

    // Verify Player 1 and Player 2 headings
    expect(html).toContain("Player 1");
    expect(html).toContain("Player 2");

    // Verify Points labels
    expect(html).toContain("Player 1 Points");
    expect(html).toContain("Player 2 Points");
    expect(html).not.toContain("Team 1 Points");
    expect(html).not.toContain("Team 2 Points");

    // Verify score inputs and winner button aria labels
    expect(html).toContain('aria-label="Player 1 Score"');
    expect(html).toContain('aria-label="Player 2 Score"');
    expect(html).toContain('aria-label="Select Player 1 as Winner"');
    expect(html).toContain('aria-label="Select Player 2 as Winner"');

    // Verify toolbar tooltip for swap sides
    expect(html).toContain('title="Swap sides between Player 1 and Player 2"');
  });

  it("does not render Players in Session header and places Add Players above Checked-in Players", () => {
    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={players}
        attendance={attendance}
        startedRounds={[]}
        isOrganizer={true}
        isHost={true}
        isMember={true}
        currentViewerPlayerId="p1"
      />
    );

    // Verify outer Players in Session header is removed
    expect(html).not.toContain("Players in Session");

    // Verify both sections exist
    expect(html).toContain('data-testid="add-players-box"');
    expect(html).toContain('data-testid="checked-in-players-box"');

    // Verify Add Players appears before Checked-in Players in DOM order
    const addPlayersIdx = html.indexOf('data-testid="add-players-box"');
    const checkedInIdx = html.indexOf('data-testid="checked-in-players-box"');
    expect(addPlayersIdx).toBeGreaterThan(-1);
    expect(checkedInIdx).toBeGreaterThan(-1);
    expect(addPlayersIdx).toBeLessThan(checkedInIdx);
  });

  it("renders prominent Join Open Play banner outside player boxes when member is not checked in", () => {
    // Viewer p5 is a member but not in attendance
    const nonCheckedInViewerId = "p5";
    const membersWithViewer = [
      ...players,
      { id: nonCheckedInViewerId, groupId, name: "Eve", active: true, initialRating: 1200, rating: 1200, ratedGamesPlayed: 0 },
    ];

    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={membersWithViewer}
        attendance={attendance} // Eve is not in attendance
        startedRounds={[]}
        isOrganizer={false}
        isHost={false}
        isMember={true}
        currentViewerPlayerId={nonCheckedInViewerId}
      />
    );

    expect(html).toContain('data-testid="join-open-play-button"');
    expect(html).toContain("Join Open Play");

    // The join open play button is rendered before the Add Players box
    const joinBtnIdx = html.indexOf('data-testid="join-open-play-button"');
    const addPlayersIdx = html.indexOf('data-testid="add-players-box"');
    expect(joinBtnIdx).toBeGreaterThan(-1);
    expect(addPlayersIdx).toBeGreaterThan(-1);
    expect(joinBtnIdx).toBeLessThan(addPlayersIdx);
  });

  it("does not allow recording games and shows check-in notice in submit game card when viewer is not checked in", () => {
    const nonCheckedInViewerId = "p5";
    const membersWithViewer = [
      ...players,
      { id: nonCheckedInViewerId, groupId, name: "Eve", active: true, initialRating: 1200, rating: 1200, ratedGamesPlayed: 0 },
    ];

    const html = renderToStaticMarkup(
      <OpenPlayManagerClient
        groupId={groupId}
        groupName="Test Group"
        session={session}
        players={membersWithViewer}
        attendance={attendance} // Eve is not checked in
        startedRounds={[]}
        isOrganizer={false}
        isHost={false}
        isMember={true}
        currentViewerPlayerId={nonCheckedInViewerId}
      />
    );

    // submit game card should indicate check-in is required
    expect(html).toContain('data-testid="submit-game-card"');
    expect(html).toContain("You must be checked in to this session to record games.");
    // Should not render the match inputs / score inputs for recording
    expect(html).not.toContain('aria-label="Team 1 Points"');
    expect(html).not.toContain('aria-label="Player 1 Score"');
  });
});

