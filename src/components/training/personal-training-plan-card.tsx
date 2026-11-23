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
import { TargetIcon, CheckIcon, ZapIcon } from "@/components/ui/icons";
import { InlineResultLogger } from "@/components/training/inline-result-logger";

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
}

export function PersonalTrainingPlanCard({
  currentPlan,
  completedChallengeIds = [],
  isSignedIn,
  availableChallenges = [],
  currentYear,
  currentWeekNumber,
}: PersonalTrainingPlanCardProps) {
  const { year: fallbackYear, weekNumber: fallbackWeek } = getWeekNumberFromDate();
  const planYear = currentPlan?.plan.year ?? currentYear ?? fallbackYear;
  const planWeekNumber = currentPlan?.plan.weekNumber ?? currentWeekNumber ?? fallbackWeek;
  const weekDateStr = formatWeekOf(planYear, planWeekNumber);

  const [items, setItems] = useState<readonly PersonalTrainingPlanItemRecord[]>(
    () => currentPlan?.items ?? [],
  );
  const [completedIds, setCompletedIds] = useState<string[]>(() => [...completedChallengeIds]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isPickerExpanded, setIsPickerExpanded] = useState(false);
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
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                Week of {weekDateStr} · Personal Goals
              </span>
              <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
                My Weekly Training Plan
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
            className="inline-flex items-center justify-center text-center w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all touch-manipulation select-none"
          >
            Sign In to Track Plan →
          </Link>
        </div>
      </section>
    );
  }

  const completedSet = new Set(completedIds);
  const completedCount = items.filter((i) => completedSet.has(i.challengeId)).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const allDone = items.length > 0 && completedCount === items.length;
  const planTitle = currentPlan?.plan.title ?? `Week of ${weekDateStr} Training Plan`;
  const focusNotes = currentPlan?.plan.focusNotes ?? null;

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
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
              Week of {weekDateStr} · Personal Goals
            </span>
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
              {planTitle}
            </h2>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-xl border border-black font-display text-xs font-black uppercase ${
            items.length === 0
              ? "bg-neutral-100 text-neutral-600"
              : allDone
              ? "bg-[#ccff00] text-black"
              : "bg-neutral-100 text-black"
          }`}
        >
          {items.length === 0 ? "Empty Plan (0/6 Drills)" : `${completedCount} / ${items.length} Goals Met`}
        </span>
      </div>

      {focusNotes && (
        <p className="text-xs font-medium text-neutral-700 mb-3 bg-neutral-50 p-2.5 rounded-xl border border-black/10">
          🎯 {focusNotes}
        </p>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-neutral-200 h-2.5 rounded-full border border-black overflow-hidden mb-4">
        <div
          className="bg-[#ccff00] h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Empty State Banner if no items yet */}
      {items.length === 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 border-2 border-dashed border-black/20 text-center space-y-1.5 mb-4">
          <p className="font-display text-sm font-black uppercase text-neutral-800">
            Your training plan for this week is empty
          </p>
          <p className="text-xs font-medium text-neutral-600 max-w-md mx-auto">
            Expand below to select focus drills or pick drills from the drill library to start tracking your goals.
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
                      className={`font-display text-sm font-black uppercase truncate ${
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
                        className={`px-3 py-1.5 rounded-xl border-2 border-black font-display text-xs font-black uppercase tracking-wider transition-all shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer touch-manipulation select-none ${
                          isExpanded
                            ? "bg-black text-[#ccff00]"
                            : isDone
                            ? "bg-white text-black hover:bg-neutral-100"
                            : "bg-[#ccff00] text-black hover:bg-[#b8eb00]"
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
                      planItemId={item.id}
                      initialOpen={true}
                      hideToggleButton={true}
                      onClose={() => setExpandedItemId(null)}
                      onResultSaved={() => {
                        setCompletedIds((prev) => Array.from(new Set([...prev, item.challengeId])));
                      }}
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
        <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-neutral-100 border-2 border-black space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-xs font-black uppercase text-black">
              Pick Focus Drills for This Week ({items.length}/6)
            </span>
            <button
              type="button"
              onClick={() => setIsPickerExpanded(false)}
              className="text-xs font-bold text-neutral-600 hover:text-black uppercase"
            >
              Close ✕
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {availableChallenges.map((challenge) => {
              const inPlan = items.some((i) => i.challengeId === challenge.id);
              const isAddingThis = isAddingId === challenge.id;

              return (
                <div
                  key={challenge.id}
                  className="bg-white p-2.5 rounded-xl border border-black/20 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block truncate">
                      {challenge.skillCategory}
                    </span>
                    <h4 className="font-display text-xs font-black uppercase text-black truncate">
                      {challenge.title}
                    </h4>
                  </div>

                  <button
                    type="button"
                    disabled={inPlan || isAddingThis || (items.length >= 6 && !inPlan) || isPending}
                    onClick={() => handleAddDrill(challenge)}
                    className={`px-2.5 py-1 rounded-lg font-display text-[11px] font-black uppercase tracking-wider border border-black shadow-[1px_1px_0px_0px_#000] transition-all shrink-0 ${
                      inPlan
                        ? "bg-lime-100 text-lime-900 border-lime-600 cursor-default"
                        : items.length >= 6
                        ? "bg-neutral-100 text-neutral-400 border-neutral-300 cursor-not-allowed"
                        : "bg-[#ccff00] text-black hover:bg-[#b8eb00] cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                    }`}
                  >
                    {inPlan ? "In Plan ✓" : isAddingThis ? "..." : "+ Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {items.length < 6 && (
          <button
            type="button"
            data-testid="expand-plan-picker-btn"
            onClick={() => setIsPickerExpanded((prev) => !prev)}
            className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer select-none"
          >
            {isPickerExpanded ? "Hide Drill Selector ▲" : "+ Expand & Add Drills ▼"}
          </button>
        )}

        <a
          href="#drill-library"
          className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] text-center flex items-center justify-center touch-manipulation select-none active:translate-x-0.5 active:translate-y-0.5"
        >
          + Add Drill from Library
        </a>

        <Link
          href="/training/plan/new"
          className="min-h-[44px] py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] text-center flex items-center justify-center touch-manipulation select-none active:translate-x-0.5 active:translate-y-0.5"
        >
          Edit My Plan
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
