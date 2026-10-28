import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OpenPlayManagerClient } from "@/app/g/[groupId]/sessions/[sessionId]/open-play-manager-client";
import type { AttendanceRecord, PlayerRecord, SessionRecord, StartedRoundRecord } from "@/lib/domain/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("OpenPlayManagerClient Component", () => {
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
  });

  it("removes the open play label and renders the three dots in the top right corner of the header box", () => {
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

    // Verify Session Options Menu button is rendered in the top header row
    const optionsIndex = html.indexOf('data-testid="session-options-menu-button"');
    const sessionNameIndex = html.indexOf("Open Play Session");
    const endSessionIndex = html.indexOf('data-testid="end-session-button"');

    expect(optionsIndex).toBeGreaterThan(-1);
    expect(sessionNameIndex).toBeGreaterThan(-1);
    expect(endSessionIndex).toBeGreaterThan(-1);

    // Three dots menu in the top bar appears before the session title and end session button
    expect(optionsIndex).toBeLessThan(sessionNameIndex);
    expect(optionsIndex).toBeLessThan(endSessionIndex);
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
    expect(html).toContain("Female");
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

    const html = renderToStaticMarkup(
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

    // General session info
    expect(html).toContain("Courts");
    expect(html).toContain("Total Games");
    expect(html).toContain("Players");
    expect(html).toContain("Started:");

    // Personal session view
    expect(html).toContain('data-testid="personal-session-summary"');
    expect(html).toContain("Your Session");
    expect(html).toContain("Games Won");
    expect(html).toContain("Games Lost");
    expect(html).toContain("Games Played");
    expect(html).toContain("You won 1 game and lost 0 games.");
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
});

