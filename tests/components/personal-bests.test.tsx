import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChallengeTemplateRecord, TrainingResultRecord } from "@/lib/domain/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/actions/training", () => ({
  deleteTrainingResultAction: vi.fn(),
  recordTrainingResultAction: vi.fn(),
}));

const { PersonalBests } = await import("@/components/training/personal-bests");
const { PickleballMedal } = await import("@/components/training/pickleball-medal");

const drill: ChallengeTemplateRecord = {
  id: "ch_wall",
  scope: "system",
  slug: "wall",
  title: "Wall Dink Rally Streak",
  description: "",
  instructions: "",
  skillCategory: "dinking",
  participantFormat: "individual",
  trackingFormat: "highest_score",
  scoreUnit: "dinks",
  higherIsBetter: true,
  defaultTargetGoal: 50,
  isActive: true,
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 0, 1),
};

const r = (id: string, value: number, notes: string | null = null): TrainingResultRecord => ({
  id,
  challengeId: drill.id,
  scorePrimary: value,
  metricValue: value,
  completed: true,
  notes,
  recordedAt: new Date(2026, 10, 25, 14, 39),
  version: 1,
});

describe("PickleballMedal", () => {
  it("labels the best result PB and the runners-up 2 and 3", () => {
    expect(renderToStaticMarkup(<PickleballMedal rank={1} />)).toMatch(/aria-label="Personal best".*>PB<\/text>/s);
    expect(renderToStaticMarkup(<PickleballMedal rank={2} />)).toMatch(/aria-label="2nd best".*>2<\/text>/s);
    expect(renderToStaticMarkup(<PickleballMedal rank={3} />)).toMatch(/aria-label="3rd best".*>3<\/text>/s);
  });
});

describe("PersonalBests", () => {
  const ranked = [r("a", 42, "Wind from the left"), r("b", 38), r("c", 35)];

  it("opens the personal best with rays and keeps the runners-up collapsed", () => {
    const html = renderToStaticMarkup(
      <PersonalBests challenge={drill} ranked={ranked} ownResultIds={["a", "b"]} />,
    );
    expect(html).toContain("Personal Bests");
    expect(html).toMatch(/<details open="" class="group\/pb" data-testid="personal-best-1"/);
    expect(html).toMatch(/<details class="group\/pb" data-testid="personal-best-2"/);
    expect(html).toMatch(/<details class="group\/pb" data-testid="personal-best-3"/);
    expect(html).toContain("#facc15"); // rays around the top medal
    expect(html).toContain(">42</span>");
    expect(html).toContain("Wind from the left");
    // Delete only on results the viewer logged
    expect((html.match(/Delete attempt/g) ?? []).length).toBe(2);
  });

  it("renders nothing without results", () => {
    expect(renderToStaticMarkup(<PersonalBests challenge={drill} ranked={[]} ownResultIds={[]} />)).toBe("");
  });
});
