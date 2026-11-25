import React from "react";
import Link from "next/link";
import {
  getActionRepository,
  getActivePlayerAccountId,
  getActiveGuestPlayerId,
} from "@/app/actions/action-context";
import { ChallengeCard } from "@/components/training/challenge-card";
import { PersonalTrainingPlanCard } from "@/components/training/personal-training-plan-card";
import { GroupWeeklyPlanCard } from "@/components/training/group-weekly-plan-card";
import { TargetIcon } from "@/components/ui/icons";
import { PlanProgress, isGeneratedPlanTitle } from "@/components/training/plan-progress";
import type {
  ChallengeSkillCategory,
  GroupRecord,
  GroupTrainingPlanRecord,
  GroupTrainingPlanItemRecord,
} from "@/lib/domain/types";
import { formatWeekOf, getWeekNumberFromDate } from "@/lib/domain/training-calculator";
import { toLastResultRecord } from "@/lib/domain/training-history";

export default async function TrainingHubPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; category?: string }>;
}) {
  const { group: selectedGroupId, category: selectedCategory } = await searchParams;
  const repo = getActionRepository();

  const accountId = await getActivePlayerAccountId();
  const { year: currentYear, weekNumber: currentWeekNumber } = getWeekNumberFromDate();

  let group: GroupRecord | null = null;
  let isGroupOrganizer = false;
  let selectedGroupPlan: {
    readonly plan: GroupTrainingPlanRecord;
    readonly items: readonly GroupTrainingPlanItemRecord[];
  } | null = null;

  if (selectedGroupId) {
    const [fetchedGroup, fetchedPlan] = await Promise.all([
      repo.getGroup(selectedGroupId),
      repo.getWeeklyTrainingPlan(selectedGroupId, currentYear, currentWeekNumber),
    ]);
    group = fetchedGroup;
    selectedGroupPlan = fetchedPlan;
    if (accountId && group) {
      isGroupOrganizer =
        group.ownerAccountId === accountId ||
        (await repo.isGroupOrganizer(selectedGroupId, accountId));
    }
  }

  const [challenges, accountGroups] = await Promise.all([
    repo.listChallengeTemplates(selectedGroupId),
    accountId ? repo.listAccountGroups(accountId) : Promise.resolve([]),
  ]);

  let guestPlayerId: string | null = null;
  if (selectedGroupId && !accountId) {
    guestPlayerId = await getActiveGuestPlayerId(selectedGroupId);
  }

  const [personalBests, latestResults, progressSummary, currentPersonalPlan] = await Promise.all([
    repo.getPlayerPersonalBests(accountId ?? undefined, guestPlayerId ?? undefined),
    repo.getPlayerLatestTrainingResults(accountId ?? undefined, guestPlayerId ?? undefined),
    repo.getPlayerTrainingProgress(accountId ?? undefined, guestPlayerId ?? undefined),
    accountId && !selectedGroupId
      ? repo.getPersonalWeeklyTrainingPlan(accountId, currentYear, currentWeekNumber)
      : Promise.resolve(null),
  ]);

  const lastResults = toLastResultRecord(latestResults);

  let personalCompletedChallengeIds: string[] = [];
  let personalPlanChallengeIds = new Set<string>();
  if (currentPersonalPlan) {
    const planResults = await repo.listTrainingResultsForPersonalPlan(currentPersonalPlan.plan.id);
    personalCompletedChallengeIds = Array.from(new Set(planResults.map((r) => r.challengeId)));
    personalPlanChallengeIds = new Set(currentPersonalPlan.items.map((i) => i.challengeId));
  }

  let groupCompletedChallengeIds: string[] = [];
  if (selectedGroupPlan && (accountId || guestPlayerId)) {
    const gResults = await repo.listTrainingResultsForPlan(selectedGroupPlan.plan.id);
    groupCompletedChallengeIds = gResults
      .filter((r) => (accountId && r.accountId === accountId) || (guestPlayerId && r.loggedByPlayerId === guestPlayerId))
      .map((r) => r.challengeId);
  }

  const userGroupPlans =
    !selectedGroupId && accountGroups.length > 0
      ? await Promise.all(
          accountGroups.map(async (g) => {
            const [planData, players] = await Promise.all([
              repo.getWeeklyTrainingPlan(g.id, currentYear, currentWeekNumber),
              repo.listPlayers(g.id, { includeInactive: false }),
            ]);
            if (!planData || planData.items.length === 0) return null;

            let compIds: string[] = [];
            if (accountId) {
              const gResults = await repo.listTrainingResultsForPlan(planData.plan.id);
              compIds = gResults
                .filter((r) => r.accountId === accountId)
                .map((r) => r.challengeId);
            }

            const isOrg = Boolean(g.isHost || g.isOrganizer);

            const roster = players.map((p) => ({
              id: p.id,
              name: p.name,
              username: p.username,
            }));

            return {
              group: g,
              plan: planData.plan,
              items: planData.items,
              completedChallengeIds: compIds,
              isOrganizer: isOrg,
              rosterPlayers: roster,
            };
          }),
        ).then((res) => res.filter((r): r is NonNullable<typeof r> => r !== null))
      : [];

  let rosterPlayers: { id: string; name: string; username?: string | null }[] = [];
  if (selectedGroupId) {
    const players = await repo.listPlayers(selectedGroupId, { includeInactive: false });
    rosterPlayers = players.map((p) => ({ id: p.id, name: p.name, username: p.username }));
  }

  const planItemMap = new Map<string, GroupTrainingPlanItemRecord>(
    selectedGroupPlan?.items.map((i) => [i.challengeId, i]) ?? []
  );

  const targetChallenges = selectedGroupId
    ? selectedGroupPlan
      ? challenges.filter((c) => planItemMap.has(c.id))
      : []
    : challenges;

  const filteredChallenges = selectedCategory && selectedCategory !== "all"
    ? targetChallenges.filter((c) => c.skillCategory === selectedCategory)
    : targetChallenges;

  const allCategories: { key: ChallengeSkillCategory; label: string }[] = [
    { key: "dinking", label: "Dinking" },
    { key: "third_shot", label: "Third Shot" },
    { key: "serving", label: "Serving" },
    { key: "volleys", label: "Volleys" },
    { key: "resets", label: "Resets" },
    { key: "conditioning", label: "Conditioning" },
    { key: "strategy", label: "Strategy" },
  ];

  const availableCategories = selectedGroupId && selectedGroupPlan
    ? allCategories.filter((cat) => targetChallenges.some((c) => c.skillCategory === cat.key))
    : allCategories;

  const categories = [
    { key: "all" as const, label: selectedGroupId && selectedGroupPlan ? "All Plan Drills" : "All Drills" },
    ...availableCategories,
  ];

  const planCompletedCount = selectedGroupPlan
    ? selectedGroupPlan.items.filter((item) => groupCompletedChallengeIds.includes(item.challengeId)).length
    : 0;
  const planTotalCount = selectedGroupPlan?.items.length ?? 0;

  return (
    <main className="min-h-screen p-4 sm:p-6 w-full max-w-4xl mx-auto space-y-6 text-black pb-28 sm:pb-24 md:pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] shrink-0">
            <TargetIcon className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
          </span>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-black leading-tight">
              {selectedGroupId ? "Weekly Training" : "Training & Challenges"}
            </h1>
            {selectedGroupId && group && (
              <span className="text-xs font-bold text-neutral-600 block">{group.name}</span>
            )}
          </div>
        </div>

        {selectedGroupId && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Link
              href={`/g/${selectedGroupId}`}
              className="inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              ← Back to Group
            </Link>
            <Link
              href="/training"
              className="inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Browse All Drills
            </Link>
          </div>
        )}
      </div>

      {/* Group Weekly Training Header Banner */}
      {selectedGroupId && selectedGroupPlan && (
        <section
          data-testid="group-training-header"
          className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 sm:p-6 lg:p-7 shadow-[4px_4px_0px_0px_#000] space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] shrink-0">
                <TargetIcon className="w-4 h-4 text-black" />
              </span>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">
                  Week of {formatWeekOf(selectedGroupPlan.plan.year, selectedGroupPlan.plan.weekNumber)}
                </span>
                <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
                  {isGeneratedPlanTitle(selectedGroupPlan.plan.title) ? "This Week's Drills" : selectedGroupPlan.plan.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isGroupOrganizer && (
                <Link
                  href={`/g/${selectedGroupId}/training/plan/new`}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  Edit Plan
                </Link>
              )}
            </div>
          </div>

          {selectedGroupPlan.plan.focusNotes && (
            <p className="text-xs sm:text-sm font-medium text-neutral-700 bg-white/80 p-3 rounded-xl border border-black/10">
              💡 <span className="font-bold">Coach Focus Notes:</span> {selectedGroupPlan.plan.focusNotes}
            </p>
          )}

          <PlanProgress completed={planCompletedCount} total={planTotalCount} />
        </section>
      )}

      {/* Empty State when group has no plan */}
      {selectedGroupId && !selectedGroupPlan && (
        <section
          data-testid="group-training-empty"
          className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-[4px_4px_0px_0px_#000]"
        >
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 border-2 border-black flex items-center justify-center mx-auto">
            <TargetIcon className="w-6 h-6 text-neutral-500" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black uppercase text-black">
              No Weekly Plan Active
            </h2>
            <p className="text-sm font-medium text-neutral-600 mt-1 max-w-md mx-auto">
              {group?.name ?? "This group"} has not published a weekly training plan for Week of {formatWeekOf(currentYear, currentWeekNumber)}.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {isGroupOrganizer && (
              <Link
                href={`/g/${selectedGroupId}/training/plan/new`}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center"
              >
                Create Weekly Plan →
              </Link>
            )}
            <Link
              href="/training"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center"
            >
              Browse All Drills →
            </Link>
          </div>
        </section>
      )}

      {/* Personal Weekly Training Plan Card (Main Training Hub only) */}
      {!selectedGroupId && (
        <>
          <PersonalTrainingPlanCard
            currentPlan={currentPersonalPlan}
            completedChallengeIds={personalCompletedChallengeIds}
            isSignedIn={Boolean(accountId)}
            availableChallenges={challenges.filter((c) => c.participantFormat !== "group")}
            currentYear={currentYear}
            currentWeekNumber={currentWeekNumber}
            lastResults={lastResults}
          />

          {/* Group Weekly Training Plans for groups user is a member of */}
          {userGroupPlans.map(({ group: grp, plan, items, completedChallengeIds: cIds, isOrganizer: isOrg, rosterPlayers: rPlayers }) => (
            <GroupWeeklyPlanCard
              key={plan.id}
              group={grp}
              plan={plan}
              items={items}
              completedChallengeIds={cIds}
              currentUserId={accountId}
              rosterPlayers={rPlayers}
              isOrganizer={isOrg}
              lastResults={lastResults}
            />
          ))}
        </>
      )}

      {/* Lifetime practice totals (secondary to this week's plans) */}
      {!selectedGroupId && (accountId || guestPlayerId) && (
        <section
          aria-labelledby="practice-totals-heading"
          data-testid="practice-totals"
          className="bg-[#FFFDF7] border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] px-5 py-5 sm:px-6"
        >
          <h2 id="practice-totals-heading" className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight mb-4">
            All-time practice
          </h2>
          {/* Label above value, content-width columns split by short rules. Phones and small tablets: 2 x 2. md and up: one row. */}
          <dl className="grid grid-cols-2 gap-y-5 md:flex md:flex-nowrap">
            {[
              { label: "Attempts logged", value: progressSummary.totalCompleted },
              { label: "Personal bests", value: progressSummary.personalBestsCount },
              { label: "Days practiced", value: progressSummary.currentStreakDays },
              { label: "Practice points", value: progressSummary.totalImprovementPoints },
            ].map(({ label, value }, index) => {
              // Rule after the left column in the 2 x 2 grid, after every column but the last in the single row.
              const divider =
                index === 0 || index === 2
                  ? "after:block"
                  : index === 1
                  ? "after:hidden md:after:block"
                  : "after:hidden";
              const spacing = index % 2 === 1 ? "pl-5 md:pl-0" : "";
              return (
                <div
                  key={label}
                  className={`relative flex flex-col gap-1 min-w-0 pr-5 md:pr-7 md:mr-7 last:pr-0 last:mr-0 ${spacing} after:content-[''] after:absolute after:right-0 after:top-1 after:bottom-1 after:w-0.5 after:rounded-full after:bg-black/15 ${divider}`}
                >
                  <dt className="text-sm sm:text-[15px] font-medium text-neutral-600 leading-5 truncate">{label}</dt>
                  <dd className="font-display text-[30px] sm:text-[32px] font-bold leading-none tracking-tight text-black tabular-nums">
                    {value.toLocaleString("en-US")}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      {!selectedGroupId && (
        <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black pt-2">Drill Library</h2>
      )}

      {/* Category Filter Pills - all visible without horizontal scrolling */}
      {categories.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {categories.map((cat) => {
            const isActive =
              (selectedCategory === undefined && cat.key === "all") ||
              selectedCategory === cat.key;
            const href =
              cat.key === "all"
                ? selectedGroupId
                  ? `/training?group=${selectedGroupId}`
                  : "/training"
                : selectedGroupId
                ? `/training?group=${selectedGroupId}&category=${cat.key}`
                : `/training?category=${cat.key}`;

            return (
              <Link
                key={cat.key}
                href={href}
                className={`px-3 py-1.5 rounded-xl min-h-[38px] flex items-center justify-center font-display text-xs font-black uppercase tracking-wider transition-all border-2 select-none active:translate-x-0.5 active:translate-y-0.5 ${
                  isActive
                    ? "bg-black text-[#ccff00] border-black shadow-[2px_2px_0px_0px_#000]"
                    : "bg-white hover:bg-neutral-100 text-neutral-800 border-black shadow-[2px_2px_0px_0px_#000]"
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Challenge Cards Grid */}
      {filteredChallenges.length > 0 ? (
        <section id="drill-library" className="grid sm:grid-cols-2 gap-4 sm:gap-5 scroll-mt-6">
          {filteredChallenges.map((challenge) => {
            const planItem = selectedGroupPlan
              ? planItemMap.get(challenge.id)
              : undefined;
            return (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                personalBest={personalBests.get(challenge.id)}
                lastResult={lastResults[challenge.id] ?? null}
                groupId={selectedGroupId}
                planItemId={planItem?.id}
                customGoalDescription={planItem?.customGoalDescription}
                rosterPlayers={rosterPlayers}
                currentUserId={accountId}
                isCompletedThisWeek={
                  personalCompletedChallengeIds.includes(challenge.id) ||
                  groupCompletedChallengeIds.includes(challenge.id)
                }
                activeCategory={selectedCategory}
                isInPersonalPlan={personalPlanChallengeIds.has(challenge.id)}
              />
            );
          })}
        </section>
      ) : (
        selectedGroupId && selectedGroupPlan && (
          <div className="bg-[#FFFDF7] border-2 border-black rounded-2xl p-6 text-center text-sm font-bold text-neutral-600 shadow-[2px_2px_0px_0px_#000]">
            No drills found matching &ldquo;{selectedCategory}&rdquo; in this week&apos;s plan.
            <div className="mt-3">
              <Link
                href={`/training?group=${selectedGroupId}`}
                className="inline-block px-3.5 py-1.5 rounded-xl bg-black text-[#ccff00] font-display text-xs font-black uppercase tracking-wider"
              >
                View All Plan Drills
              </Link>
            </div>
          </div>
        )
      )}
    </main>
  );
}
