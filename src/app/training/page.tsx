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
import type { ChallengeSkillCategory } from "@/lib/domain/types";

export default async function TrainingHubPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; category?: string }>;
}) {
  const { group: selectedGroupId, category: selectedCategory } = await searchParams;
  const repo = getActionRepository();

  const accountId = await getActivePlayerAccountId();
  const [challenges, accountGroups] = await Promise.all([
    repo.listChallengeTemplates(selectedGroupId),
    accountId ? repo.listAccountGroups(accountId) : Promise.resolve([]),
  ]);

  let guestPlayerId: string | null = null;
  if (selectedGroupId && !accountId) {
    guestPlayerId = await getActiveGuestPlayerId(selectedGroupId);
  }

  // Calculate current ISO week
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const currentWeekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

  const [personalBests, progressSummary, currentPersonalPlan] = await Promise.all([
    repo.getPlayerPersonalBests(accountId ?? undefined, guestPlayerId ?? undefined),
    repo.getPlayerTrainingProgress(accountId ?? undefined, guestPlayerId ?? undefined),
    accountId
      ? repo.getPersonalWeeklyTrainingPlan(accountId, now.getFullYear(), currentWeekNumber)
      : Promise.resolve(null),
  ]);

  let personalCompletedChallengeIds: string[] = [];
  if (currentPersonalPlan) {
    const planResults = await repo.listTrainingResultsForPersonalPlan(currentPersonalPlan.plan.id);
    personalCompletedChallengeIds = Array.from(new Set(planResults.map((r) => r.challengeId)));
  }

  let groupCompletedChallengeIds: string[] = [];
  if (selectedGroupId && (accountId || guestPlayerId)) {
    const groupPlan = await repo.getWeeklyTrainingPlan(selectedGroupId, now.getFullYear(), currentWeekNumber);
    if (groupPlan) {
      const gResults = await repo.listTrainingResultsForPlan(groupPlan.plan.id);
      groupCompletedChallengeIds = gResults
        .filter((r) => (accountId && r.accountId === accountId) || (guestPlayerId && r.loggedByPlayerId === guestPlayerId))
        .map((r) => r.challengeId);
    }
  }

  const groupIds = accountGroups.map((g) => g.id);
  const activePlans = groupIds.length > 0 ? await repo.listActiveGroupTrainingPlans(groupIds) : [];

  let rosterPlayers: { id: string; name: string; username?: string | null }[] = [];
  if (selectedGroupId) {
    const players = await repo.listPlayers(selectedGroupId, { includeInactive: false });
    rosterPlayers = players.map((p) => ({ id: p.id, name: p.name, username: p.username }));
  }

  const categories: { key: ChallengeSkillCategory | "all"; label: string }[] = [
    { key: "all", label: "All Drills" },
    { key: "dinking", label: "Dinking" },
    { key: "third_shot", label: "Third Shot" },
    { key: "serving", label: "Serving" },
    { key: "volleys", label: "Volleys" },
    { key: "resets", label: "Resets" },
    { key: "conditioning", label: "Conditioning" },
  ];

  const filteredChallenges = selectedCategory && selectedCategory !== "all"
    ? challenges.filter((c) => c.skillCategory === selectedCategory)
    : challenges;

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6 text-black pb-28 sm:pb-24 md:pb-12 overflow-x-hidden max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] shrink-0">
            <TargetIcon className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
          </span>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-black leading-tight">
            Training & Challenges
          </h1>
        </div>

        {selectedGroupId && (
          <Link
            href={`/g/${selectedGroupId}`}
            className="self-start sm:self-auto inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            ← Back to Group
          </Link>
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

      {/* Personal Weekly Training Plan Card */}
      <PersonalTrainingPlanCard
        currentPlan={currentPersonalPlan}
        completedChallengeIds={personalCompletedChallengeIds}
        isSignedIn={Boolean(accountId)}
      />

      {/* Group Weekly Plans Banner (if any) */}
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
                    {ap.groupName} · Week {ap.plan.weekNumber}
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

      {/* Category Filter Pills - all visible without horizontal scrolling */}
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

      {/* Challenge Cards Grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChallenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            personalBest={personalBests.get(challenge.id)}
            groupId={selectedGroupId}
            rosterPlayers={rosterPlayers}
            currentUserId={accountId}
            isCompletedThisWeek={
              personalCompletedChallengeIds.includes(challenge.id) ||
              groupCompletedChallengeIds.includes(challenge.id)
            }
          />
        ))}
      </section>
    </main>
  );
}

