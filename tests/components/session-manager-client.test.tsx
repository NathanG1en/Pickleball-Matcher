import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionManagerClient } from "@/app/g/[groupId]/sessions/[sessionId]/session-manager-client";
import type { AttendanceRecord, PlayerRecord, SessionRecord, StartedRoundRecord } from "@/lib/domain/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("SessionManagerClient Component", () => {
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
    expect(html).toContain("All Rounds &amp; Matchups");
    expect(html).toContain("Alice &amp; Bob");
    expect(html).toContain("Charlie &amp; Dave");
    expect(html).toContain("11");
    expect(html).toContain("7");
    expect(html).toContain("← Back to Group");
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
    expect(html).toContain("Oct 10, 2026");
  });

  it("renders custom session name when provided", () => {
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
});
