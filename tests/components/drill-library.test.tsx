import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DrillLibrary } from "@/components/training/drill-library";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";

let currentParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => currentParams,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/actions/training", () => ({
  recordTrainingResultAction: vi.fn(),
  deleteTrainingResultAction: vi.fn(),
  addDrillToPersonalPlanAction: vi.fn(),
}));

function drill(id: string, skillCategory: ChallengeTemplateRecord["skillCategory"]): ChallengeTemplateRecord {
  return {
    id,
    scope: "system",
    slug: id,
    title: `Drill ${id}`,
    description: "desc",
    instructions: "do it",
    skillCategory,
    participantFormat: "individual",
    trackingFormat: "highest_score",
    scoreUnit: "reps",
    higherIsBetter: true,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

const categories = [
  { key: "all", label: "All Drills" },
  { key: "dinking", label: "Dinking" },
  { key: "serving", label: "Serving" },
  { key: "strategy", label: "Strategy" },
];
const items = [{ challenge: drill("d1", "dinking") }, { challenge: drill("s1", "serving") }];

function render(query: string) {
  currentParams = new URLSearchParams(query);
  return renderToStaticMarkup(<DrillLibrary categories={categories} items={items} scopeLabel="the drill library" />);
}

describe("DrillLibrary", () => {
  it("renders filter pills as pressed/unpressed buttons, not links", () => {
    const html = render("");
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>All Drills<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Dinking<\/button>/);
    expect(html).not.toContain('href="/training?category=');
  });

  it("keeps every card mounted and hides the ones outside the active category", () => {
    const html = render("category=serving");
    expect(html).toContain('data-testid="challenge-card-d1"');
    expect(html).toContain('data-testid="challenge-card-s1"');
    // The dinking card's wrapper is hidden; the serving card's is not.
    expect(html).toMatch(/<div hidden=""[^>]*><div data-testid="challenge-card-d1"/);
    expect(html).not.toMatch(/<div hidden=""[^>]*><div data-testid="challenge-card-s1"/);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Serving<\/button>/);
  });

  it("shows an empty state with a reset button when nothing matches", () => {
    const html = render("category=strategy");
    expect(html).toContain("No Strategy drills in the drill library.");
    expect(html).toMatch(/<button[^>]*>All Drills<\/button><\/div><\/div>$/);
  });

  it("turns card category badges into in-place filter buttons", () => {
    const html = render("category=dinking");
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*title="Clear category filter"[^>]*>Dinking<\/button>/);
  });
});
