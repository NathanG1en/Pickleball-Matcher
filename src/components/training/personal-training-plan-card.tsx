"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { addDrillToPersonalPlanAction } from "@/app/actions/training";
import type {
  PersonalTrainingPlanRecord,
  PersonalTrainingPlanItemRecord,
  ChallengeTemplateRecord,
} from "@/lib/domain/types";
import { formatWeekOf, getWeekNumberFromDate } from "@/lib/domain/training-calculator";
import { TargetIcon, CheckIcon, ZapIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import { InlineResultLogger } from "@/components/training/inline-result-logger";
import { PlanProgress, isGeneratedPlanTitle } from "@/components/training/plan-progress";
import type { LastResultSummary } from "@/lib/domain/training-history";

export interface PersonalTrainingPlanCardProps {
  readonly currentPlan: {
    readonly plan: PersonalTrainingPlanRecord;
    readonly items: readonly PersonalTrainingPlanItemRecord[];
  } | null;
  readonly completedChallengeIds?: readonly string[];
  readonly isSignedIn: boolean;
  readonly availableChallenges?: readonly ChallengeTemplateRecord[];
  readonly currentYear?: number;
  readonly currentWeekNumber?: number;
  /** Most recent result per drill id, shown as "Last time" in the logger. */
  readonly lastResults?: Readonly<Record<string, LastResultSummary>>;
}

const categoryLabels: Record<string, string> = {
  dinking: "Dinking",
  third_shot: "Third Shot",
  kitchen_defense: "Defense",
  resets: "Resets",
  serves_returns: "Serves",
  speedups_firefights: "Speedups",
  strategy: "Strategy",
};

const categories = [
  { key: "all", label: "All Drills" },
  { key: "dinking", label: "Dinking" },
  { key: "third_shot", label: "Third Shot" },
  { key: "kitchen_defense", label: "Defense" },
  { key: "resets", label: "Resets" },
  { key: "serves_returns", label: "Serves" },
  { key: "speedups_firefights", label: "Speedups" },
  { key: "strategy", label: "Strategy" },
];

export function PersonalTrainingPlanCard({
  currentPlan,
  completedChallengeIds = [],
  isSignedIn,
  availableChallenges = [],
  currentYear,
  currentWeekNumber,
  lastResults = {},
}: PersonalTrainingPlanCardProps) {
  const { year: fallbackYear, weekNumber: fallbackWeek } = getWeekNumberFromDate();
  const planYear = currentPlan?.plan.year ?? currentYear ?? fallbackYear;
  const planWeekNumber = currentPlan?.plan.weekNumber ?? currentWeekNumber ?? fallbackWeek;
  const weekDateStr = formatWeekOf(planYear, planWeekNumber);

  const [items, setItems] = useState<readonly PersonalTrainingPlanItemRecord[]>(
    () => currentPlan?.items ?? [],
  );
  // Attempts saved in this view (per drill) that haven't been undone.
  const [sessionSaveCounts, setSessionSaveCounts] = useState<Record<string, number>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isPickerExpanded, setIsPickerExpanded] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [pickerCategory, setPickerCategory] = useState("all");
  const [isAddingId, setIsAddingId] = useState<string | null>(null);
  const [pickerFeedback, setPickerFeedback] = useState<string | null>(null);
  const [isPending, startAddTransition] = useTransition();

  if (!isSignedIn) {
    return (
      <section
        data-testid="personal-training-plan-card"
        className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_0px_#000]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] shrink-0">
              <ZapIcon className="w-4 h-4 text-black" />
            </span>
            <div>
              <span className="text-xs font-bold text-neutral-500 block">
                Week of {weekDateStr}
              </span>
              <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
                My Weekly Plan
              </h2>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm font-medium text-neutral-700 mb-4 leading-relaxed">
          Sign in to track your personalized weekly training plan, record drill scores, and build consistency.
        </p>

        <div>
          <Link
            href="/player-login?returnTo=/training"
            className="inline-flex items-center justify-center text-center w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all touch-manipulation select-none"
          >
            Sign In to Track Plan →
          </Link>
        </div>
      </section>
    );
  }

  const completedSet = new Set([
    ...completedChallengeIds,
    ...Object.keys(sessionSaveCounts).filter((id) => (sessionSaveCounts[id] ?? 0) > 0),
  ]);
  const adjustSessionSaves = (challengeId: string, delta: number) => {
    setSessionSaveCounts((prev) => ({
      ...prev,
      [challengeId]: Math.max(0, (prev[challengeId] ?? 0) + delta),
    }));
  };
  const completedCount = items.filter((i) => completedSet.has(i.challengeId)).length;
  const planTitle = isGeneratedPlanTitle(currentPlan?.plan.title) ? "My Weekly Plan" : currentPlan!.plan.title;
  const focusNotes = currentPlan?.plan.focusNotes ?? null;

  const visibleAvailableChallenges = availableChallenges.filter((c) => {
    if (pickerCategory !== "all" && c.skillCategory !== pickerCategory) {
      return false;
    }
    if (pickerSearchQuery.trim()) {
      const q = pickerSearchQuery.trim().toLowerCase();
      const catLabel = (categoryLabels[c.skillCategory] ?? c.skillCategory).toLowerCase();
      const inTitle = c.title.toLowerCase().includes(q);
      const inDesc = c.description.toLowerCase().includes(q);
      const inCat = catLabel.includes(q);
      if (!inTitle && !inDesc && !inCat) return false;
    }
    return true;
  });

  const handleAddDrill = (challenge: ChallengeTemplateRecord) => {
    if (items.some((i) => i.challengeId === challenge.id)) return;
    if (items.length >= 6) {
      setPickerFeedback("Maximum 6 drills per plan.");
      setTimeout(() => setPickerFeedback(null), 3000);
      return;
    }

    startAddTransition(async () => {
      setIsAddingId(challenge.id);
      const res = await addDrillToPersonalPlanAction(challenge.id);
      setIsAddingId(null);

      if (res.ok) {
        setItems((prev) => [
          ...prev,
          {
            id: `ptpi_local_${challenge.id}`,
            planId: res.data.planId,
            challengeId: challenge.id,
            customGoalDescription: null,
            targetBenchmark: null,
            sortOrder: prev.length,
            challenge,
          },
        ]);
        setPickerFeedback("Drill added! ✓");
        setTimeout(() => setPickerFeedback(null), 3000);
      } else {
        setPickerFeedback(res.error);
        setTimeout(() => setPickerFeedback(null), 3500);
      }
    });
  };

  return (
    <section
      data-testid="personal-training-plan-card"
      className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_0px_#000]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] shrink-0">
            <TargetIcon className="w-4 h-4 text-black" />
          </span>
          <div>
            <span className="text-xs font-bold text-neutral-500 block">
              Week of {weekDateStr}
            </span>
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
              {planTitle}
            </h2>
          </div>
        </div>

      </div>

      {focusNotes && (
        <p className="text-xs font-medium text-neutral-700 mb-3 bg-neutral-50 p-2.5 rounded-xl border border-black/10">
          🎯 {focusNotes}
        </p>
      )}

      {items.length > 0 ? (
        <div className="mb-4">
          <PlanProgress completed={completedCount} total={items.length} />
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 border-2 border-dashed border-black/20 text-center space-y-1.5 mb-4">
          <p className="text-sm font-bold text-neutral-800">No drills yet</p>
          <p className="text-xs font-medium text-neutral-600 max-w-md mx-auto">
            Add up to 6 drills to practice this week.
          </p>
        </div>
      )}

      {/* Challenge List Items with direct record ability */}
      {items.length > 0 && (
        <div className="space-y-2.5 mb-4">
          {items.map((item) => {
            const isDone = completedSet.has(item.challengeId);
            const isExpanded = expandedItemId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border-2 transition-all p-3 sm:p-3.5 ${
                  isDone
                    ? "bg-lime-50/80 border-lime-600 text-lime-900"
                    : "bg-white border-black text-black"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        isDone
                          ? "bg-[#ccff00] border-black text-black"
                          : "border-neutral-400 bg-neutral-50"
                      }`}
                    >
                      {isDone && <CheckIcon className="w-3.5 h-3.5 stroke-3" />}
                    </span>
                    <span
                      className={`text-sm font-bold truncate ${
                        isDone ? "line-through opacity-80" : ""
                      }`}
                    >
                      {item.challenge?.title ?? "Drill"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-neutral-600 hidden sm:inline-block max-w-[140px] text-right truncate">
                      {item.customGoalDescription ??
                        (item.challenge?.defaultTargetGoal
                          ? `Target: ${item.challenge.defaultTargetGoal} ${item.challenge.scoreUnit}`
                          : item.challenge?.scoreUnit ?? "")}
                    </span>

                    {item.challenge && (
                      <button
                        type="button"
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className={`px-3 py-1.5 rounded-xl border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer touch-manipulation select-none transition-colors ${
                          isExpanded
                            ? "bg-black text-[#ccff00]"
                            : isDone
                            ? "bg-white text-black hover:bg-neutral-100"
                            : "bg-[#ccff00] text-black hover:bg-[#b8e600]"
                        }`}
                      >
                        {isExpanded ? "Close" : isDone ? "Log Again" : "+ Record"}
                      </button>
                    )}
                  </div>
                </div>

                {item.customGoalDescription && (
                  <div className="sm:hidden mt-1.5 text-[11px] font-bold text-neutral-600">
                    Goal: {item.customGoalDescription}
                  </div>
                )}

                {/* Inline Logger directly in plan */}
                {isExpanded && item.challenge && (
                  <div className="mt-3 pt-3 border-t border-black/10">
                    <InlineResultLogger
                      challenge={item.challenge}
                      initialOpen={true}
                      hideToggleButton={true}
                      onClose={() => setExpandedItemId(null)}
                      onResultSaved={() => adjustSessionSaves(item.challengeId, 1)}
                      onResultUndone={() => adjustSessionSaves(item.challengeId, -1)}
                      lastResult={lastResults[item.challengeId] ?? null}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expandable Drill Picker right inside the card */}
      {isPickerExpanded && availableChallenges.length > 0 && (
        <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-neutral-100 border-2 border-black space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-black">
              Pick Focus Drills for This Week ({items.length}/6)
            </span>
          </div>

          {/* Search Drills Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
              <SearchIcon className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={pickerSearchQuery}
              onChange={(e) => setPickerSearchQuery(e.target.value)}
              placeholder="Search drills by name or skill..."
              aria-label="Search drills"
              data-testid="picker-drill-search-input"
              className="w-full pl-9 pr-8 py-2 bg-white border-2 border-black rounded-xl text-xs sm:text-sm font-bold text-black placeholder-neutral-400 shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-shadow"
            />
            {pickerSearchQuery && (
              <button
                type="button"
                onClick={() => setPickerSearchQuery("")}
                aria-label="Clear drill search"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-black cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => {
              const isActive = pickerCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setPickerCategory(cat.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border-2 select-none active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                    isActive
                      ? "bg-black text-[#ccff00] border-black shadow-[1.5px_1.5px_0px_0px_#000]"
                      : "bg-white hover:bg-neutral-50 text-neutral-800 border-black shadow-[1.5px_1.5px_0px_0px_#000]"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {visibleAvailableChallenges.length === 0 ? (
            <div className="p-4 text-center rounded-xl bg-white border-2 border-black space-y-1.5 shadow-[2px_2px_0px_0px_#000]">
              <p className="text-xs font-bold text-black">No matching drills found</p>
              <p className="text-[11px] font-medium text-neutral-600">Try adjusting your search terms or category filter.</p>
              {(pickerSearchQuery || pickerCategory !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearchQuery("");
                    setPickerCategory("all");
                  }}
                  className="mt-1 px-3 py-1 rounded-lg border-2 border-black bg-[#ccff00] hover:bg-[#b8e600] text-black text-xs font-bold shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {visibleAvailableChallenges.map((challenge) => {
                const inPlan = items.some((i) => i.challengeId === challenge.id);
                const isAddingThis = isAddingId === challenge.id;

                return (
                  <div
                    key={challenge.id}
                    className="bg-white p-2.5 rounded-xl border border-black/20 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-neutral-500 block truncate">
                        {categoryLabels[challenge.skillCategory] ?? challenge.skillCategory}
                      </span>
                      <h4 className="font-display text-xs font-black uppercase text-black truncate">
                        {challenge.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      disabled={inPlan || isAddingThis || (items.length >= 6 && !inPlan) || isPending}
                      onClick={() => handleAddDrill(challenge)}
                      className={`px-3 py-1.5 rounded-xl border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] transition-colors shrink-0 ${
                        inPlan
                          ? "bg-neutral-100 text-black cursor-default"
                          : items.length >= 6
                          ? "bg-neutral-100 text-neutral-400 border-neutral-300 cursor-not-allowed shadow-none"
                          : "bg-[#ccff00] text-black hover:bg-[#b8e600] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                      }`}
                    >
                      {inPlan ? "In Plan ✓" : isAddingThis ? "..." : "+ Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action buttons: one way to add drills, one way to edit */}
      <div className="flex flex-wrap items-center gap-2">
        {items.length < 6 && (
          <button
            type="button"
            data-testid="expand-plan-picker-btn"
            aria-expanded={isPickerExpanded}
            onClick={() => setIsPickerExpanded((prev) => !prev)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer select-none ${
              items.length === 0 ? "bg-[#ccff00] hover:bg-[#b8e600] text-black" : "bg-white hover:bg-neutral-100 text-black"
            }`}
          >
            {isPickerExpanded ? "Done Adding" : "+ Add Drills"}
          </button>
        )}

        <Link
          href="/training/plan/new"
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-colors inline-flex items-center touch-manipulation select-none"
        >
          Edit Plan
        </Link>

        {pickerFeedback && (
          <span className="text-xs font-bold text-neutral-700 animate-pulse ml-1">
            {pickerFeedback}
          </span>
        )}
      </div>
    </section>
  );
}
