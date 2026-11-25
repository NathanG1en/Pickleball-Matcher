import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PracticeProfile, PracticeSkillScore } from "@/lib/domain/practice-profile";
import { PRACTICE_SKILLS } from "@/lib/domain/practice-profile";

vi.mock("@/app/actions/action-context", () => ({ getActionRepository: vi.fn() }));

const { PracticeProfileCard } = await import("@/components/players/practice-profile-card");

function profileWith(scores: Partial<Record<string, number>>, extra: Partial<PracticeProfile> = {}): PracticeProfile {
  const skills: PracticeSkillScore[] = PRACTICE_SKILLS.map(({ key, label }) => {
    const score = scores[key];
    return score === undefined
      ? { key, label, score: null, drillsTried: 0, attempts: 0, lowConfidence: false }
      : { key, label, score, drillsTried: 2, attempts: 5, lowConfidence: false };
  });
  const tested = skills.filter((s) => s.score !== null);
  return {
    skills,
    testedCount: tested.length,
    weakest: tested.length ? tested.reduce((a, b) => ((b.score ?? 1) < (a.score ?? 1) ? b : a)) : null,
    daysSinceLastPractice: 3,
    ...extra,
  };
}

describe("PracticeProfileCard", () => {
  it("is collapsed by default with a one-line summary in the toggle", () => {
    const html = renderToStaticMarkup(
      <PracticeProfileCard profile={profileWith({ dinking: 0.82, resets: 0.48, volleys: 0.7 })} />,
    );
    expect(html).toMatch(/^<details data-testid="practice-profile"/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toMatch(/<summary[^>]*>.*Practice Profile.*3 of 6 skills tested · Focus: Resets 48%.*<\/summary>/s);
  });

  it("summarizes an empty profile when collapsed", () => {
    const html = renderToStaticMarkup(<PracticeProfileCard profile={profileWith({}, { daysSinceLastPractice: null })} />);
    expect(html).toContain("No skills tested yet");
  });

  it("shows % of target, untested skills, and links each skill to filtered drills", () => {
    const html = renderToStaticMarkup(
      <PracticeProfileCard profile={profileWith({ dinking: 0.82, resets: 0.48, volleys: 0.7 })} />,
    );
    expect(html).toContain("Practice Profile");
    expect(html).not.toContain("Only you");
    expect(html).toContain("82%");
    expect(html).toContain("Not tested");
    expect(html).toContain('href="/training?category=dinking"');
    expect(html).toContain('href="/training?category=serving"');
    expect(html).toContain("<polygon");
    expect(html).toContain('role="img"');
    expect(html).toContain("Dinking 82% of target");
    expect(html).toContain("Last practiced 3 days ago.");
  });

  it("suggests the weakest tested skill as the next focus", () => {
    const html = renderToStaticMarkup(
      <PracticeProfileCard profile={profileWith({ dinking: 0.82, resets: 0.48, volleys: 0.7 })} />,
    );
    expect(html).toContain("Focus next: Resets");
    expect(html).toContain("48% of target, your lowest tested skill.");
    expect(html).toContain("Practice Resets");
  });

  it("suggests an untested skill once every tested skill is at target", () => {
    const html = renderToStaticMarkup(<PracticeProfileCard profile={profileWith({ dinking: 1 })} />);
    expect(html).toContain("Try Third Shot next");
  });

  it("invites a first drill when nothing is tested and skips the shape", () => {
    const html = renderToStaticMarkup(
      <PracticeProfileCard profile={profileWith({}, { daysSinceLastPractice: null })} />,
    );
    expect(html).toContain("Start your practice profile");
    expect(html).toContain('href="/training"');
    expect(html).not.toContain("<polygon");
    expect(html).toContain("No drills logged yet.");
  });
});
