import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ScoreHistoryChart,
  filterHistoryByTimeRange,
  computeYAxisTicks,
  RATING_TIME_RANGES,
} from "@/components/players/score-history-chart";
import type { PlayerSessionHistoryRecord } from "@/lib/domain/types";

describe("ScoreHistoryChart", () => {
  it("renders empty state message and disabled filter buttons when history is empty", () => {
    const html = renderToStaticMarkup(<ScoreHistoryChart history={[]} />);
    expect(html).toContain("Your rating history will appear after your first session.");
    expect(html).toContain("Rating over time");
    expect(html).toContain('data-testid="rating-timeline-filter"');
    expect(html).toContain('data-testid="rating-range-week"');
    expect(html).toContain('data-testid="rating-range-month"');
    expect(html).toContain('data-testid="rating-range-year"');
    expect(html).toContain('data-testid="rating-range-all"');
    expect(html).toContain('disabled=""');
  });

  it("renders SVG chart with points, line, date labels, and active 'All time' filter for session records", () => {
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

    // Filter controls in the top right
    expect(html).toContain('data-testid="rating-timeline-filter"');
    expect(html).toContain('aria-label="Filter rating timeline"');
    for (const range of RATING_TIME_RANGES) {
      expect(html).toContain(range.label);
      expect(html).toContain(range.shortLabel);
      expect(html).toContain(`data-testid="rating-range-${range.id}"`);
    }
    // "All time" is active by default
    expect(html).toContain('data-testid="rating-range-all" class="rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer bg-[#ccff00]');
    expect(html).toContain('top-12 sm:top-0');

    // Clearer line, dots, and larger chart dimensions
    expect(html).toContain('viewBox="0 0 400 220"');
    expect(html).toContain('stroke-width="2.25"');
    expect(html).toContain('r="3.5"');
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

  it("renders empty state when no sessions fall within truncated time range", () => {
    const referenceDate = new Date("2026-11-09T12:00:00Z");
    const history: PlayerSessionHistoryRecord[] = [
      {
        sessionId: "s1",
        groupId: "g1",
        groupName: "Club A",
        rating: 1000,
        wins: 2,
        losses: 2,
        startedAt: new Date("2026-08-01T10:00:00Z"), // > 3 months ago
      },
    ];

    const html = renderToStaticMarkup(
      <ScoreHistoryChart
        history={history}
        initialTimeRange="week"
        referenceDate={referenceDate}
      />
    );
    expect(html).toContain('data-testid="rating-chart-empty-range"');
    expect(html).toContain("No rating history in the selected time period.");
    expect(html).not.toContain('data-testid="rating-point-0"');
  });

  it("truncates timeline to only include sessions in the chosen period", () => {
    const referenceDate = new Date("2026-11-09T12:00:00Z");
    const history: PlayerSessionHistoryRecord[] = [
      {
        sessionId: "s_old",
        groupId: "g1",
        groupName: "Club A",
        rating: 1000,
        wins: 1,
        losses: 1,
        startedAt: new Date("2026-01-01T10:00:00Z"), // ~10 months ago
      },
      {
        sessionId: "s_month",
        groupId: "g1",
        groupName: "Club A",
        rating: 1050,
        wins: 2,
        losses: 0,
        startedAt: new Date("2026-10-25T10:00:00Z"), // 15 days ago
      },
      {
        sessionId: "s_week",
        groupId: "g1",
        groupName: "Club A",
        rating: 1100,
        wins: 3,
        losses: 0,
        startedAt: new Date("2026-11-06T10:00:00Z"), // 3 days ago
      },
    ];

    // Week: only s_week
    const weekHtml = renderToStaticMarkup(
      <ScoreHistoryChart
        history={history}
        initialTimeRange="week"
        referenceDate={referenceDate}
      />
    );
    expect(weekHtml).toContain('data-testid="rating-point-0"');
    expect(weekHtml).not.toContain('data-testid="rating-point-1"');
    expect(weekHtml).toContain("3.75 → 3.75 rating");

    // Month: s_month and s_week
    const monthHtml = renderToStaticMarkup(
      <ScoreHistoryChart
        history={history}
        initialTimeRange="month"
        referenceDate={referenceDate}
      />
    );
    expect(monthHtml).toContain('data-testid="rating-point-0"');
    expect(monthHtml).toContain('data-testid="rating-point-1"');
    expect(monthHtml).not.toContain('data-testid="rating-point-2"');
    expect(monthHtml).toContain("3.625 → 3.75 rating");

    // Year: all 3
    const yearHtml = renderToStaticMarkup(
      <ScoreHistoryChart
        history={history}
        initialTimeRange="year"
        referenceDate={referenceDate}
      />
    );
    expect(yearHtml).toContain('data-testid="rating-point-0"');
    expect(yearHtml).toContain('data-testid="rating-point-1"');
    expect(yearHtml).toContain('data-testid="rating-point-2"');
    expect(yearHtml).toContain("3.5 → 3.75 rating");
  });

  it("renders y-axis markings with tick marks, labels, and horizontal gridlines", () => {
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
    expect(html).toContain('data-testid="rating-y-tick-0"');
    expect(html).toContain('data-testid="rating-y-tick-1"');
    expect(html).toContain('stroke-dasharray="3 3"');
    // At least one y-axis rating label like 3.5 or 3.50 is rendered
    expect(html).toMatch(/>3\.[0-9]+/);
  });

  it("computeYAxisTicks computes clean DUPR steps within rating range", () => {
    const ticks = computeYAxisTicks(975, 1075, 100);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.some((t) => t.label === "3.5")).toBe(true);
    for (const tick of ticks) {
      expect(tick.y).toBeGreaterThanOrEqual(25);
      expect(tick.y).toBeLessThanOrEqual(180);
    }
  });
});

describe("filterHistoryByTimeRange", () => {
  const referenceDate = new Date("2026-11-09T12:00:00Z");
  const records: PlayerSessionHistoryRecord[] = [
    {
      sessionId: "s_old",
      groupId: "g1",
      groupName: "Club A",
      rating: 1000,
      wins: 1,
      losses: 1,
      startedAt: new Date("2025-01-01T10:00:00Z"), // > 1 year ago
    },
    {
      sessionId: "s_year",
      groupId: "g1",
      groupName: "Club A",
      rating: 1020,
      wins: 1,
      losses: 1,
      startedAt: new Date("2026-05-01T10:00:00Z"), // ~6 months ago
    },
    {
      sessionId: "s_month",
      groupId: "g1",
      groupName: "Club A",
      rating: 1040,
      wins: 2,
      losses: 0,
      startedAt: new Date("2026-10-25T10:00:00Z"), // 15 days ago
    },
    {
      sessionId: "s_week",
      groupId: "g1",
      groupName: "Club A",
      rating: 1080,
      wins: 3,
      losses: 0,
      startedAt: new Date("2026-11-06T10:00:00Z"), // 3 days ago
    },
  ];

  it("returns all records when range is 'all'", () => {
    const result = filterHistoryByTimeRange(records, "all", referenceDate);
    expect(result).toHaveLength(4);
  });

  it("filters to records within 7 days for 'week'", () => {
    const result = filterHistoryByTimeRange(records, "week", referenceDate);
    expect(result.map((r) => r.sessionId)).toEqual(["s_week"]);
  });

  it("filters to records within 30 days for 'month'", () => {
    const result = filterHistoryByTimeRange(records, "month", referenceDate);
    expect(result.map((r) => r.sessionId)).toEqual(["s_month", "s_week"]);
  });

  it("filters to records within 365 days for 'year'", () => {
    const result = filterHistoryByTimeRange(records, "year", referenceDate);
    expect(result.map((r) => r.sessionId)).toEqual(["s_year", "s_month", "s_week"]);
  });
});
