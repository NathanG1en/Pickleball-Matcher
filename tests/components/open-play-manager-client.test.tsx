import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OpenPlayManagerClient } from "@/app/g/[groupId]/sessions/[sessionId]/open-play-manager-client";
import type { AttendanceRecord, PlayerRecord, SessionRecord } from "@/lib/domain/types";

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
});

