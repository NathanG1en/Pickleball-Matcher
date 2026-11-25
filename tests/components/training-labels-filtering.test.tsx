import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChallengeCard } from "@/components/training/challenge-card";
import { PersonalPlanForm } from "@/app/training/plan/new/personal-plan-form";
import { NewPlanForm } from "@/app/g/[groupId]/training/plan/new/new-plan-form";
import { PersonalTrainingPlanCard } from "@/components/training/personal-training-plan-card";
import { WeeklyTrainingCard } from "@/components/training/weekly-training-card";
import { GroupWeeklyPlanCard } from "@/components/training/group-weekly-plan-card";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock action functions
vi.mock("@/app/actions/training", () => ({
  recordChallengeAttemptAction: vi.fn(),
  savePersonalWeeklyPlanAction: vi.fn().mockResolvedValue({ ok: true }),
  publishWeeklyPlanAction: vi.fn().mockResolvedValue({ ok: true }),
}));

const mockChallenges: ChallengeTemplateRecord[] = [
  {
    id: "ch_dink_1",
    scope: "system",
    slug: "kitchen-dink-50",
    title: "Kitchen Dink 50",
    description: "Sustain continuous kitchen dinks",
    skillCategory: "dinking",
    participantFormat: "partner",
    trackingFormat: "highest_score",
    scoreUnit: "dinks",
    higherIsBetter: true,
    defaultTargetGoal: 50,
    instructions: "Stay low and keep knees bent",
    recommendedDurationMinutes: 10,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "ch_serve_1",
    scope: "system",
    slug: "deep-serve-accuracy",
    title: "Deep Serve Accuracy",
    description: "Hit deep quadrant serves",
    skillCategory: "serving",
    participantFormat: "individual",
    trackingFormat: "accuracy",
    scoreUnit: "% in",
    higherIsBetter: true,
    defaultTargetGoal: 80,
    instructions: "Aim deep past transition zone",
    recommendedDurationMinutes: 15,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "ch_strat_1",
    scope: "system",
    slug: "seven-shot-patience",
    title: "Seven-Shot Patience",
    description: "Group patience drill",
    skillCategory: "strategy",
    participantFormat: "group",
    trackingFormat: "completion",
    scoreUnit: "rallies",
    higherIsBetter: true,
    instructions: "Play 7 shots before attack",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];

describe("Training Labels and Filtering", () => {
  describe("ChallengeCard in drill browser", () => {
    it("renders the category label as a clickable filter link and omits unfilterable format labels", () => {
      const html = renderToStaticMarkup(
        <ChallengeCard
          challenge={mockChallenges[0]}
          personalBest={45}
        />
      );

      // Category label must be an anchor link to filter by that category
      expect(html).toContain('href="/training?category=dinking"');
      expect(html).toContain("Dinking");

      // Unfilterable labels (participant format "partner" and tracking format "Streak / High Score") must NOT be rendered as labels
      expect(html).not.toContain(">partner<");
      expect(html).not.toContain("Streak / High Score");
      expect(html).not.toContain(">highest_score<");
    });

    it("toggles back to /training when the active category is clicked", () => {
      const html = renderToStaticMarkup(
        <ChallengeCard
          challenge={mockChallenges[0]}
          activeCategory="dinking"
        />
      );

      expect(html).toContain('href="/training"');
      expect(html).toContain('title="Clear category filter"');
    });

    it("preserves group context in the category filter link when groupId is passed", () => {
      const html = renderToStaticMarkup(
        <ChallengeCard
          challenge={mockChallenges[0]}
          groupId="grp_test_abc"
        />
      );

      expect(html).toContain('href="/training?group=grp_test_abc&amp;category=dinking"');
    });
  });

  describe("PersonalPlanForm", () => {
    it("renders category filter pills, interactive category buttons, and omits unfilterable labels and group drills", () => {
      const html = renderToStaticMarkup(
        <PersonalPlanForm
          challenges={mockChallenges}
          defaultWeekNumber={47}
          defaultYear={2026}
        />
      );

      // Verify individual and partner drills visible, group drills excluded
      expect(html).toContain("Kitchen Dink 50");
      expect(html).toContain("Deep Serve Accuracy");
      expect(html).not.toContain("Seven-Shot Patience");

      // Verify category filter pills rendered
      expect(html).toContain("All Drills");
      expect(html).toContain("Dinking");
      expect(html).toContain("Third Shot");
      expect(html).toContain("Serving");
      expect(html).toContain("Volleys");
      expect(html).toContain("Resets");
      expect(html).toContain("Conditioning");

      // Verify drill items have category filter buttons with title
      expect(html).toContain('title="Filter by Dinking"');
      expect(html).toContain('title="Filter by Serving"');

      // Verify unfilterable format labels are NOT displayed
      expect(html).not.toContain(">accuracy<");
      expect(html).not.toContain(">highest_score<");
      expect(html).not.toContain(">partner<");

      // Verify week selector uses Target Week with "Week of" format instead of raw week numbers
      expect(html).toContain("Target Week");
      expect(html).toContain("Week of");
      expect(html).not.toContain("Week Number (1–53)");
    });
  });

  describe("NewPlanForm (group plan)", () => {
    it("renders category filter pills, interactive category buttons, and omits individual drills", () => {
      const html = renderToStaticMarkup(
        <NewPlanForm
          groupId="grp_test_123"
          challenges={mockChallenges}
          defaultWeekNumber={47}
          defaultYear={2026}
        />
      );

      // Verify group and partner drills visible, individual drills excluded
      expect(html).toContain("Kitchen Dink 50");
      expect(html).toContain("Seven-Shot Patience");
      expect(html).not.toContain("Deep Serve Accuracy");

      // Verify category filter pills rendered
      expect(html).toContain("All Drills");
      expect(html).toContain("Dinking");
      expect(html).toContain("Strategy");

      // Verify drill items have category filter buttons with title
      expect(html).toContain('title="Filter by Dinking"');
      expect(html).toContain('title="Filter by Strategy"');

      // Verify unfilterable format labels are NOT displayed
      expect(html).not.toContain(">accuracy<");
      expect(html).not.toContain(">highest_score<");

      // Verify week selector uses Target Week with "Week of" format
      expect(html).toContain("Target Week");
      expect(html).toContain("Week of");
      expect(html).not.toContain("Week Number (1–53)");
    });
  });

  describe("Week Display on Plan Cards", () => {
    it("displays Week of (Sunday date) on PersonalTrainingPlanCard", () => {
      const html = renderToStaticMarkup(
        <PersonalTrainingPlanCard
          isSignedIn={true}
          currentPlan={{
            plan: {
              id: "ptp_1",
              accountId: "acc_1",
              year: 2026,
              weekNumber: 48,
              title: "My Custom Plan",
              focusNotes: null,
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            items: [],
          }}
        />
      );

      expect(html).toContain("Week of Nov 22, 2026");
      expect(html).not.toContain("Week 48");
      // A custom title is shown as the heading
      expect(html).toContain("My Custom Plan");
    });

    it("displays Week of (Sunday date) on WeeklyTrainingCard", () => {
      const html = renderToStaticMarkup(
        <WeeklyTrainingCard
          groupId="grp_1"
          isOrganizer={true}
          currentPlan={{
            plan: {
              id: "gtp_1",
              groupId: "grp_1",
              year: 2026,
              weekNumber: 48,
              title: "Group Focus",
              focusNotes: null,
              status: "published",
              publishedAt: new Date(),
              createdByAccountId: "acc_1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            items: [],
          }}
        />
      );

      expect(html).toContain("Week of Nov 22, 2026 · Training");
      expect(html).not.toContain("Week 48 Training");
    });

    it("does not render top-right + Create Plan button in WeeklyTrainingCard empty state", () => {
      const html = renderToStaticMarkup(
        <WeeklyTrainingCard
          groupId="grp_1"
          isOrganizer={true}
          currentPlan={null}
        />
      );

      expect(html).not.toContain("+ Create Plan");
      expect(html).toContain("Create Weekly Plan →");
    });
  });

  describe("System Challenge Templates Library (30 Drills)", () => {
    it("incorporates all 30 drills across all 6 skill categories including Strategy", async () => {
      const { SYSTEM_CHALLENGE_TEMPLATES } = await import("@/lib/domain/default-challenges");
      expect(SYSTEM_CHALLENGE_TEMPLATES).toHaveLength(30);

      const titles = SYSTEM_CHALLENGE_TEMPLATES.map((c) => c.title);
      expect(titles).toContain("Crosscourt Dink Streak");
      expect(titles).toContain("Dink Target Practice");
      expect(titles).toContain("Backhand Dink Challenge");
      expect(titles).toContain("Dink and Speed Up");
      expect(titles).toContain("Dink Under Pressure");
      expect(titles).toContain("Short and Deep Dinks");
      expect(titles).toContain("Third-Shot Drop Repetition");
      expect(titles).toContain("Drop and Advance");
      expect(titles).toContain("Third-Shot Drop Placement");
      expect(titles).toContain("Drop vs. Drive Decision");
      expect(titles).toContain("Five-Ball Transition Drill");
      expect(titles).toContain("Return, Drop, and Dink");
      expect(titles).toContain("Reset Master");
      expect(titles).toContain("Transition Zone Resets");
      expect(titles).toContain("Reset Under Pressure");
      expect(titles).toContain("Block and Counter");
      expect(titles).toContain("Defensive Footwork");
      expect(titles).toContain("Volley Rally Challenge");
      expect(titles).toContain("Hand Speed Battle");
      expect(titles).toContain("Body Bag Defense");
      expect(titles).toContain("Attack and Counter");
      expect(titles).toContain("Alternating Volley Targets");
      expect(titles).toContain("Deep Serve Challenge");
      expect(titles).toContain("Serve Placement Challenge");
      expect(titles).toContain("Deep Return Challenge");
      expect(titles).toContain("Return Placement Challenge");
      expect(titles).toContain("Seven-Shot Patience");
      expect(titles).toContain("Skinny Singles");
      expect(titles).toContain("Attack vs. Defense");
      expect(titles).toContain("Situational Doubles");

      const categories = new Set(SYSTEM_CHALLENGE_TEMPLATES.map((c) => c.skillCategory));
      expect(categories).toContain("dinking");
      expect(categories).toContain("third_shot");
      expect(categories).toContain("resets");
      expect(categories).toContain("volleys");
      expect(categories).toContain("serving");
      expect(categories).toContain("strategy");
    });

    it("renders Strategy filter pill in PersonalPlanForm and NewPlanForm", () => {
      const personalHtml = renderToStaticMarkup(
        <PersonalPlanForm
          challenges={mockChallenges}
          defaultWeekNumber={47}
          defaultYear={2026}
        />
      );
      expect(personalHtml).toContain("Strategy");

      const groupHtml = renderToStaticMarkup(
        <NewPlanForm
          groupId="grp_test_123"
          challenges={mockChallenges}
          defaultWeekNumber={47}
          defaultYear={2026}
        />
      );
      expect(groupHtml).toContain("Strategy");
    });
  });

  describe("Direct Result Recording in Plan and Adding Drills", () => {
    it("renders + Record button on drill items in PersonalTrainingPlanCard and WeeklyTrainingCard", () => {
      const personalHtml = renderToStaticMarkup(
        <PersonalTrainingPlanCard
          isSignedIn={true}
          currentPlan={{
            plan: {
              id: "ptp_1",
              accountId: "acc_1",
              year: 2026,
              weekNumber: 48,
              title: "My Custom Plan",
              focusNotes: null,
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            items: [
              {
                id: "item_1",
                planId: "ptp_1",
                challengeId: "ch_dink_1",
                customGoalDescription: "50 dinks",
                targetBenchmark: 50,
                sortOrder: 0,
                challenge: mockChallenges[0],
              },
            ],
          }}
        />
      );

      expect(personalHtml).toContain("+ Record");
      expect(personalHtml).toContain("+ Add Drills");
      expect(personalHtml).toContain("Edit Plan");
      expect(personalHtml).not.toContain("+ Add Drill from Library");
      expect(personalHtml).toContain("0 of 1 drill practiced");
      expect(personalHtml).not.toContain("Goals Met");

      const groupHtml = renderToStaticMarkup(
        <WeeklyTrainingCard
          groupId="grp_1"
          isOrganizer={true}
          currentPlan={{
            plan: {
              id: "gtp_1",
              groupId: "grp_1",
              year: 2026,
              weekNumber: 48,
              title: "Group Focus",
              focusNotes: null,
              status: "published",
              publishedAt: new Date(),
              createdByAccountId: "acc_1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            items: [
              {
                id: "gitem_1",
                planId: "gtp_1",
                challengeId: "ch_dink_1",
                customGoalDescription: null,
                targetBenchmark: null,
                sortOrder: 0,
                challenge: mockChallenges[0],
              },
            ],
          }}
        />
      );

      expect(groupHtml).toContain("+ Record");
    });

    it("renders + Add to Plan and In Plan badges on ChallengeCard", () => {
      const cardNotInPlan = renderToStaticMarkup(
        <ChallengeCard
          challenge={mockChallenges[0]}
          currentUserId="acc_1"
          isInPersonalPlan={false}
        />
      );
      expect(cardNotInPlan).toContain("+ Add to Plan");

      const cardInPlan = renderToStaticMarkup(
        <ChallengeCard
          challenge={mockChallenges[0]}
          currentUserId="acc_1"
          isInPersonalPlan={true}
        />
      );
      expect(cardInPlan).toContain("In Plan ✓");
    });

    it("renders Group Drill badge for group format drills and excludes them from personal add button", () => {
      const groupChallenge: ChallengeTemplateRecord = {
        ...mockChallenges[0],
        id: "ch_group_format",
        participantFormat: "group",
      };

      const html = renderToStaticMarkup(
        <ChallengeCard
          challenge={groupChallenge}
          currentUserId="acc_1"
        />
      );

      expect(html).toContain("Group Drill");
      expect(html).not.toContain("+ Add to Plan");
    });

    it("renders default empty weekly plan with expand button when user has no plan", () => {
      const html = renderToStaticMarkup(
        <PersonalTrainingPlanCard
          isSignedIn={true}
          currentPlan={null}
          availableChallenges={mockChallenges}
          currentYear={2026}
          currentWeekNumber={48}
        />
      );

      expect(html).toContain("Week of");
      expect(html).toContain("My Weekly Plan");
      expect(html).toContain("No drills yet");
      expect(html).toContain("+ Add Drills");
      expect(html).not.toContain("drills practiced");
      expect(html).not.toContain("+ Build My Weekly Plan →");
    });

    it("renders GroupWeeklyPlanCard with group name tag and drill details", () => {
      const html = renderToStaticMarkup(
        <GroupWeeklyPlanCard
          group={{ id: "grp_tuesday", name: "Tuesday Picklers" }}
          plan={{
            id: "gtp_1",
            groupId: "grp_tuesday",
            year: 2026,
            weekNumber: 48,
            title: "Tuesday Kitchen Control",
            focusNotes: "Keep balls low",
            status: "published",
            publishedAt: new Date(),
            createdByAccountId: "acc_1",
            createdAt: new Date(),
            updatedAt: new Date(),
          }}
          items={[
            {
              id: "item_1",
              planId: "gtp_1",
              challengeId: "ch_dink_1",
              customGoalDescription: "50 continuous dinks",
              targetBenchmark: 50,
              sortOrder: 0,
              challenge: mockChallenges[0],
            },
          ]}
        />
      );

      // Verify group name tag
      expect(html).toContain("Tuesday Picklers");
      expect(html).toContain("Tuesday Kitchen Control");
      expect(html).toContain("0 of 1 drill practiced");
      expect(html).toContain("Coach Focus Notes:");
      expect(html).toContain("+ Record");
      expect(html).toContain("Open Group Drills →");
      expect(html).not.toContain("Leaderboard");
    });
  });
  it("replaces auto-generated plan titles that repeat the week", async () => {
    const { isGeneratedPlanTitle } = await import("@/components/training/plan-progress");
    expect(isGeneratedPlanTitle("Week of Nov 22, 2026 Training Plan")).toBe(true);
    expect(isGeneratedPlanTitle("Week of Nov 22, 2026 Challenge Plan")).toBe(true);
    expect(isGeneratedPlanTitle("Week of Nov 22, 2026 Weekly Training")).toBe(true);
    expect(isGeneratedPlanTitle("Kitchen focus week")).toBe(false);
    expect(isGeneratedPlanTitle(null)).toBe(true);
  });
});
