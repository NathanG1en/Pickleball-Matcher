import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PastSessionsList, type PastSessionData } from "@/components/groups/past-sessions-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/sessions", () => ({
  deleteSessionAction: vi.fn(async () => ({ ok: true, data: undefined })),
  duplicateSessionAction: vi.fn(async () => ({ ok: true, data: { id: "ses_dup" } })),
}));

describe("PastSessionsList Component", () => {
  const groupId = "grp_test";

  const sampleSession: PastSessionData = {
    id: "ses_completed_1",
    courtCount: 2,
    currentRoundNumber: 2,
    status: "completed",
    startedAt: "2026-10-10T14:00:00.000Z",
    endedAt: "2026-10-10T15:30:00.000Z",
    totalGames: 4,
    rounds: [
      {
        id: "rnd_1",
        roundNumber: 1,
        status: "completed",
        sittingNames: ["Charlie"],
        matches: [
          {
            id: "m_1",
            courtNumber: 1,
            team1Names: ["Alice", "Bob"],
            team2Names: ["Dave", "Eve"],
            team1Score: 11,
            team2Score: 9,
            status: "completed",
          },
          {
            id: "m_2",
            courtNumber: 2,
            team1Names: ["Frank", "Grace"],
            team2Names: ["Hank", "Ivy"],
            team1Score: 7,
            team2Score: 11,
            status: "completed",
          },
        ],
      },
      {
        id: "rnd_2",
        roundNumber: 2,
        status: "completed",
        sittingNames: [],
        matches: [
          {
            id: "m_3",
            courtNumber: 1,
            team1Names: ["Alice", "Dave"],
            team2Names: ["Bob", "Eve"],
            team1Score: 11,
            team2Score: 8,
            status: "completed",
          },
          {
            id: "m_4",
            courtNumber: 2,
            team1Names: ["Charlie", "Frank"],
            team2Names: ["Grace", "Hank"],
            team1Score: 5,
            team2Score: 11,
            status: "completed",
          },
        ],
      },
    ],
  };

  it("renders empty state when there are no past sessions", () => {
    const html = renderToStaticMarkup(<PastSessionsList groupId={groupId} sessions={[]} />);
    expect(html).toContain("No sessions played yet.");
  });

  it("renders past session item in collapsed state with downward arrow button and no completed badge", () => {
    const html = renderToStaticMarkup(<PastSessionsList groupId={groupId} sessions={[sampleSession]} />);

    expect(html).toContain("2 courts · 2 rounds · 4 games");
    expect(html).not.toContain("Completed");
    expect(html).not.toContain('aria-label="Session options"');
    expect(html).toContain('data-testid="expand-session-arrow-ses_completed_1"');
    expect(html).toContain('aria-label="Expand games for Oct 10, 2026"');

    // Not expanded yet
    expect(html).not.toContain('data-testid="expanded-session-content-ses_completed_1"');
    expect(html).not.toContain("Alice &amp; Bob");
  });

  it("renders session options button for hosts/organizers to the right of the expand button", () => {
    const html = renderToStaticMarkup(
      <PastSessionsList groupId={groupId} sessions={[sampleSession]} isOrganizer={true} />
    );

    expect(html).toContain("···");
    expect(html).toContain('aria-label="Session options"');
    expect(html).toContain('data-testid="session-options-menu-button-ses_completed_1"');
    expect(html).not.toContain("Completed");

    const expandIndex = html.indexOf('data-testid="expand-session-arrow-ses_completed_1"');
    const optionsIndex = html.indexOf('data-testid="session-options-menu-button-ses_completed_1"');
    expect(expandIndex).toBeGreaterThan(-1);
    expect(optionsIndex).toBeGreaterThan(-1);
    expect(optionsIndex).toBeGreaterThan(expandIndex);
  });

  it("renders custom session name when provided on past session", () => {
    const namedSession = {
      ...sampleSession,
      name: "Championship Finals",
    };
    const html = renderToStaticMarkup(
      <PastSessionsList groupId={groupId} sessions={[namedSession]} isOrganizer={true} />
    );

    expect(html).toContain("Championship Finals");
  });

  it("renders expanded state with rounds, matchups, scores, and link to full session page", () => {
    const html = renderToStaticMarkup(
      <PastSessionsList
        groupId={groupId}
        sessions={[sampleSession]}
        initialExpandedSessionIds={{ ses_completed_1: true }}
      />
    );

    // Expanded content container exists
    expect(html).toContain('data-testid="expanded-session-content-ses_completed_1"');

    // Sized to fit 5 games with scrolling
    expect(html).toContain('data-testid="session-games-scroll-container-ses_completed_1"');
    expect(html).toContain("max-h-[390px]");
    expect(html).toContain("overflow-y-auto");

    // Games categorized under rounds
    expect(html).toContain("Round 1");
    expect(html).toContain("Round 2");

    // Sitting players displayed
    expect(html).toContain("Sitting out: Charlie");

    // Matchups and who scored how much
    expect(html).toContain("Court 1");
    expect(html).toContain("Court 2");
    expect(html).toContain("Alice &amp; Bob");
    expect(html).toContain("Dave &amp; Eve");
    expect(html).toContain("11 – 9");
    expect(html).toContain("7 – 11");

    // Link to full session page
    expect(html).toContain('data-testid="view-full-session-link-ses_completed_1"');
    expect(html).toContain(`href="/g/${groupId}/sessions/ses_completed_1"`);
    expect(html).toContain("View Full Session");
    expect(html).toContain("Started Oct 10, 2026");
  });

  it("includes the date when a session has a custom name", () => {
    const namedSession: PastSessionData = {
      ...sampleSession,
      id: "ses_named_1",
      name: "Fall Championship",
    };
    const html = renderToStaticMarkup(
      <PastSessionsList groupId={groupId} sessions={[namedSession]} />
    );

    expect(html).toContain("Fall Championship · Oct 10, 2026");
    expect(html).toContain('aria-label="Fall Championship · Oct 10, 2026"');
  });
});

