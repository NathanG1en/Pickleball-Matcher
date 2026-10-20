import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreHistoryChart } from "@/components/players/score-history-chart";
import type { PlayerSessionHistoryRecord } from "@/lib/domain/types";

describe("ScoreHistoryChart", () => {
  it("renders empty state message when history is empty", () => {
    const html = renderToStaticMarkup(<ScoreHistoryChart history={[]} />);
    expect(html).toContain("Your rating history will appear after your first session.");
  });

  it("renders SVG chart with points, line, and date labels for session records", () => {
    const history: PlayerSessionHistoryRecord[] = [
      {
        sessionId: "s1",
        groupId: "g1",
        groupName: "Club A",
        rating: 1000,
        wins: 3,
        losses: 1,
        startedAt: new Date("2026-09-01T10:00:00Z"),
      },
      {
        sessionId: "s2",
        groupId: "g1",
        groupName: "Club A",
        rating: 1050,
        wins: 4,
        losses: 0,
        startedAt: new Date("2026-09-15T10:00:00Z"),
      },
    ];

    const html = renderToStaticMarkup(<ScoreHistoryChart history={history} />);
    expect(html).toContain('role="img"');
    expect(html).toContain('data-testid="rating-point-0"');
    expect(html).toContain('data-testid="rating-point-1"');
    expect(html).toContain("3.5 → 3.625 rating");
    expect(html).toContain('aria-label="Rating 3.5 on');
    expect(html).toContain('aria-label="Rating 3.625 on');
  });

  it("handles a single session record centered at x=200", () => {
    const history: PlayerSessionHistoryRecord[] = [
      {
        sessionId: "s1",
        groupId: "g1",
        groupName: "Club A",
        rating: 1000,
        wins: 2,
        losses: 2,
        startedAt: new Date("2026-09-01T10:00:00Z"),
      },
    ];

    const html = renderToStaticMarkup(<ScoreHistoryChart history={history} />);
    expect(html).toContain('data-testid="rating-point-0"');
    expect(html).toContain('cx="200"');
  });
});

