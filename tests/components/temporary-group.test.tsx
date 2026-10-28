import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TemporaryGroupClient, ExitWarning } from "@/components/temporary/temporary-group-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("TemporaryGroupClient Component", () => {
  it("renders header with back button and sign in button when logged out", () => {
    const html = renderToStaticMarkup(<TemporaryGroupClient accountId={null} />);
    expect(html).toContain("← Back");
    expect(html).toContain('aria-label="Go back"');
    expect(html).toContain("Sign In");
    expect(html).toContain('href="/player-login?next=%2Ftemporary%3Fsave%3D1"');
    expect(html).not.toContain(">Home<");
    expect(html).toContain("Quick Session · Browser only");
  });

  it("renders signed in badge when accountId is provided", () => {
    const html = renderToStaticMarkup(<TemporaryGroupClient accountId="act_12345" />);
    expect(html).toContain("← Back");
    expect(html).toContain("Signed In");
    expect(html).not.toContain(">Home<");
  });

  it("renders cohesive setup draft form without notification box and with info button", () => {
    const html = renderToStaticMarkup(<TemporaryGroupClient accountId={null} />);
    expect(html).toContain("Quick Session · Browser only");
    expect(html).not.toContain("Browser Storage");
    expect(html).toContain('data-testid="browser-storage-info-button"');
    expect(html).toContain('aria-label="Browser storage details"');
    expect(html).not.toContain("Group name");
    expect(html).not.toContain("Make public");
    expect(html).toContain("Player names · one per line");
    expect(html).toContain("Number of courts");
    expect(html).toContain("Start Quick Session");
    expect(html).toContain('data-hydrated="true"');
  });

  it("renders with organized userGroups prop correctly", () => {
    const groups = [
      { id: "grp_1", name: "Tuesday Night Lights", players: [{ id: "p1", name: "Alice" }] },
      { id: "grp_2", name: "Weekend Warriors", players: [] },
    ];
    const html = renderToStaticMarkup(
      <TemporaryGroupClient accountId="act_12345" userGroups={groups} />,
    );
    expect(html).toContain("Signed In");
    expect(html).toContain("Start Quick Session");
  });

  it("renders player merge options and warns about unincorporated matching names", () => {
    const groups = [
      {
        id: "grp_1",
        name: "Tuesday Night Lights",
        players: [
          { id: "ply_alice", name: "Alice" },
          { id: "ply_charlie", name: "Charlie" },
        ],
      },
    ];

    const initialStoredData = {
      group: {
        name: "Active Quick Session",
        isPublic: false,
        courtPlayerCounts: [4 as const],
        players: [
          { id: "temp_1", name: "Alice", rating: 1000 }, // Matches ply_alice
          { id: "temp_2", name: "Bob", rating: 1000 },
          { id: "temp_3", name: "Dave", rating: 1000 },
          { id: "temp_4", name: "Eve", rating: 1000 },
        ],
        rounds: [],
        currentRound: null,
      },
      draft: { groupName: "", playerNames: "", courtCount: 1, courtSizes: [4 as const], publicOnSave: false },
    };

    const html = renderToStaticMarkup(
      <TemporaryGroupClient
        accountId="act_12345"
        userGroups={groups}
        initialStoredData={initialStoredData}
      />,
    );

    // Shows merge into existing group section
    expect(html).toContain("Add to Existing Group");
    expect(html).toContain("Merge Session Players into Roster");
    expect(html).toContain('aria-label="Merge Alice"');
    expect(html).toContain('aria-label="Merge Bob"');
    expect(html).toContain("Merge into Alice");
    expect(html).toContain("Merge into Charlie");

    // Notification box for unincorporated name match
    expect(html).toContain('data-testid="unincorporated-name-matches-notice"');
    expect(html).toContain("Matching Names Not Incorporated");
    expect(html).toContain("&quot;Alice&quot;");
  });

  it("renders sign in and sign up above keep playing in exit warning modal", () => {
    const html = renderToStaticMarkup(
      <ExitWarning accountId={null} onStay={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain("Leave quick session?");
    expect(html).toContain("Sign in to save");
    expect(html).toContain("Sign up");
    expect(html).toContain("Keep playing");
    expect(html).toContain("Leave without saving");

    const signInIdx = html.indexOf("Sign in to save");
    const signUpIdx = html.indexOf("Sign up");
    const keepPlayingIdx = html.indexOf("Keep playing");
    const leaveIdx = html.indexOf("Leave without saving");

    // Sign in and sign up must appear above keep playing
    expect(signInIdx).toBeLessThan(keepPlayingIdx);
    expect(signUpIdx).toBeLessThan(keepPlayingIdx);
    expect(keepPlayingIdx).toBeLessThan(leaveIdx);
  });

  it("renders reshuffle button when an active round is in progress", () => {
    const initialStoredData = {
      group: {
        name: "Pickup Session",
        isPublic: false,
        courtPlayerCounts: [4 as const],
        players: [
          { id: "p1", name: "Alice", rating: 1000 },
          { id: "p2", name: "Bob", rating: 1000 },
          { id: "p3", name: "Charlie", rating: 1000 },
          { id: "p4", name: "Dave", rating: 1000 },
        ],
        rounds: [],
        currentRound: {
          roundNumber: 1,
          seed: 42,
          courts: [
            {
              courtNumber: 1,
              team1: ["p1", "p2"],
              team2: ["p3", "p4"],
              team1Score: null,
              team2Score: null,
            },
          ],
          sitting: [],
        },
      },
      draft: { groupName: "", playerNames: "", courtCount: 1, courtSizes: [4 as const], publicOnSave: false },
    };

    const html = renderToStaticMarkup(
      <TemporaryGroupClient accountId={null} initialStoredData={initialStoredData} />,
    );
    expect(html).toContain("Reshuffle");
    expect(html).toContain('data-testid="reshuffle-round-button"');
    expect(html).toContain('aria-label="Reshuffle matchups"');
  });
});
