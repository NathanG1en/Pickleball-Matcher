import React from "react";
import Link from "next/link";
import {
  getActionRepository,
  getActivePlayerAccountId,
  getActiveGuestPlayerId,
} from "@/app/actions/action-context";
import { ChallengeCard } from "@/components/training/challenge-card";
import { PersonalTrainingPlanCard } from "@/components/training/personal-training-plan-card";
import { TargetIcon, TrophyIcon, ZapIcon } from "@/components/ui/icons";
import type {
  ChallengeSkillCategory,
  GroupRecord,
  GroupTrainingPlanRecord,
  GroupTrainingPlanItemRecord,
} from "@/lib/domain/types";
import { formatWeekOf, getWeekNumberFromDate } from "@/lib/domain/training-calculator";

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

  const [personalBests, progressSummary, currentPersonalPlan] = await Promise.all([
    repo.getPlayerPersonalBests(accountId ?? undefined, guestPlayerId ?? undefined),
    repo.getPlayerTrainingProgress(accountId ?? undefined, guestPlayerId ?? undefined),
    accountId && !selectedGroupId
      ? repo.getPersonalWeeklyTrainingPlan(accountId, currentYear, currentWeekNumber)
      : Promise.resolve(null),
  ]);

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

  const groupIds = accountGroups.map((g) => g.id);
  const activePlans = groupIds.length > 0 && !selectedGroupId
    ? await repo.listActiveGroupTrainingPlans(groupIds)
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
  const planProgressPercent = planTotalCount > 0 ? Math.round((planCompletedCount / planTotalCount) * 100) : 0;

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
              <span className="text-xs font-bold text-neutral-600 block">
                {group.name} · Focus Drills
              </span>
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

      {/* Progress & Stats Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-[#FFFDF7] border-2 border-black rounded-2xl p-3 sm:p-3.5 shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-neutral-500 block truncate">Total Completed</span>
          <span className="font-display text-xl sm:text-2xl font-black text-black mt-1">
            {progressSummary.totalCompleted}
          </span>
        </div>

        <div className="bg-[#FFFDF7] border-2 border-black rounded-2xl p-3 sm:p-3.5 shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-neutral-500 truncate flex items-center gap-1">
            <TrophyIcon className="w-3 h-3 text-amber-600 shrink-0" />
            <span className="truncate">Personal Bests</span>
          </span>
          <span className="font-display text-xl sm:text-2xl font-black text-black mt-1">
            {progressSummary.personalBestsCount}
          </span>
        </div>

        <div className="bg-[#FFFDF7] border-2 border-black rounded-2xl p-3 sm:p-3.5 shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-neutral-500 truncate flex items-center gap-1">
            <ZapIcon className="w-3 h-3 text-lime-600 shrink-0" />
            <span className="truncate">Practice Points</span>
          </span>
          <span className="font-display text-xl sm:text-2xl font-black text-black mt-1">
            {progressSummary.totalImprovementPoints}
          </span>
        </div>

        <div className="bg-[#FFFDF7] border-2 border-black rounded-2xl p-3 sm:p-3.5 shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-neutral-500 block truncate">Practice Days</span>
          <span className="font-display text-xl sm:text-2xl font-black text-black mt-1">
            {progressSummary.currentStreakDays}
          </span>
        </div>
      </section>

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
                  {group?.name ?? "Group"} · Week of {formatWeekOf(selectedGroupPlan.plan.year, selectedGroupPlan.plan.weekNumber)}
                </span>
                <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
                  {selectedGroupPlan.plan.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-neutral-100 border-2 border-black font-display text-xs font-black uppercase text-black">
                {planCompletedCount} / {planTotalCount} Done
              </span>
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

          {/* Progress Bar */}
          <div className="w-full bg-neutral-200 h-2.5 rounded-full border border-black overflow-hidden">
            <div
              className="bg-[#ccff00] h-full transition-all duration-300"
              style={{ width: `${planProgressPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-neutral-600 font-bold border-t border-black/10">
            <span>Focus drills assigned for this week</span>
            <Link
              href="/training"
              className="text-black hover:underline flex items-center gap-1 font-black uppercase text-[11px]"
            >
              Browse All Drills →
            </Link>
          </div>
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
          />

          {activePlans.length > 0 && (
            <section className="bg-lime-50/80 border-2 border-lime-600 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
              <span className="font-display text-xs font-black uppercase text-lime-900 tracking-wider block">
                {"🎾 Your Groups' Weekly Plans"}
              </span>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {activePlans.map((ap) => (
                  <div
                    key={ap.plan.id}
                    className="bg-white p-3 rounded-xl border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div>
                      <span className="font-display text-[10px] sm:text-xs font-black text-neutral-500 uppercase block">
                        {ap.groupName} · Week of {formatWeekOf(ap.plan.year, ap.plan.weekNumber)}
                      </span>
                      <h4 className="font-display text-sm font-black uppercase text-black leading-tight">
                        {ap.plan.title}
                      </h4>
                    </div>
                    <Link
                      href={`/training?group=${ap.plan.groupId}`}
                      className="w-full sm:w-auto text-center px-3 py-1.5 min-h-[36px] flex items-center justify-center rounded-lg bg-[#ccff00] text-black border border-black font-display text-xs font-black uppercase tracking-wider shadow-[1px_1px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
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
