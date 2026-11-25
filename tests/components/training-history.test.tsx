import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineResultLogger } from "@/components/training/inline-result-logger";
import { DrillTrendChart } from "@/components/training/drill-trend-chart";
import { buildDailyBestSeries } from "@/lib/domain/training-history";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";

vi.mock("@/app/actions/training", () => ({
  recordTrainingResultAction: vi.fn(),
  deleteTrainingResultAction: vi.fn(),
}));

const accuracyDrill: ChallengeTemplateRecord = {
  id: "ch_drop",
  scope: "system",
  slug: "drop-target",
  title: "Drop Target",
  description: "Hit drops",
  instructions: "Drop it",
  skillCategory: "third_shot",
  participantFormat: "individual",
  trackingFormat: "accuracy",
  scoreUnit: "drops",
  higherIsBetter: true,
  defaultTargetGoal: 70,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("Last time in the result logger", () => {
  it("shows the previous result and pre-fills the inputs from it", () => {
    const html = renderToStaticMarkup(
      <InlineResultLogger
        challenge={accuracyDrill}
        initialOpen
        hideToggleButton
        lastResult={{ scorePrimary: 16, scoreSecondary: 25, metricValue: 64, dateLabel: "Nov 18" }}
      />,
    );
    expect(html).toContain("Last time");
    expect(html).toContain("16/25 (64%)");
    expect(html).toContain("Nov 18");
    expect(html).toContain('href="/training/drills/ch_drop"');
    expect(html).toMatch(/id="shots-in-ch_drop"[^>]*value="16"/);
    expect(html).toMatch(/id="total-shots-ch_drop"[^>]*value="25"/);
  });

  it("keeps the group in the history link for group context", () => {
    const html = renderToStaticMarkup(
      <InlineResultLogger
        challenge={accuracyDrill}
        groupId="grp_1"
        initialOpen
        hideToggleButton
        lastResult={{ scorePrimary: 16, scoreSecondary: 25, metricValue: 64, dateLabel: "Today" }}
      />,
    );
    expect(html).toContain('href="/training/drills/ch_drop?group=grp_1"');
  });

  it("explains the first attempt becomes the starting point", () => {
    const html = renderToStaticMarkup(
      <InlineResultLogger challenge={accuracyDrill} initialOpen hideToggleButton />,
    );
    expect(html).toContain("First attempt. This will be your starting point.");
    expect(html).not.toContain("Last time");
  });
});

describe("DrillTrendChart", () => {
  const points = buildDailyBestSeries(
    [
      { id: "a", challengeId: "ch_drop", scorePrimary: 13, metricValue: 65, completed: true, recordedAt: new Date(2026, 10, 3, 9), version: 1 },
      { id: "b", challengeId: "ch_drop", scorePrimary: 16, metricValue: 80, completed: true, recordedAt: new Date(2026, 10, 24, 9), version: 1 },
    ],
    true,
  );

  it("labels dates, the target line, and an accessible summary", () => {
    const html = renderToStaticMarkup(
      <DrillTrendChart challenge={accuracyDrill} points={points} now={new Date(2026, 10, 24, 18)} />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain("Best result per day from Nov 3 to Nov 24: 65% to 80%. Target 70%.");
    expect(html).toContain("Target 70%");
    expect(html).toContain("Nov 3");
    expect(html).toContain("Nov 24");
  });

  it("renders nothing until there are two days of data", () => {
    const html = renderToStaticMarkup(
      <DrillTrendChart challenge={accuracyDrill} points={points.slice(0, 1)} />,
    );
    expect(html).toBe("");
  });
});
