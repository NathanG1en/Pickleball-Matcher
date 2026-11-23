"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { PersonalTrainingPlanRecord, PersonalTrainingPlanItemRecord } from "@/lib/domain/types";
import { formatWeekOf } from "@/lib/domain/training-calculator";
import { TargetIcon, CheckIcon, ZapIcon } from "@/components/ui/icons";
import { InlineResultLogger } from "@/components/training/inline-result-logger";

export interface PersonalTrainingPlanCardProps {
  readonly currentPlan: {
    readonly plan: PersonalTrainingPlanRecord;
    readonly items: readonly PersonalTrainingPlanItemRecord[];
  } | null;
  readonly completedChallengeIds?: readonly string[];
  readonly isSignedIn: boolean;
}

export function PersonalTrainingPlanCard({
  currentPlan,
  completedChallengeIds = [],
  isSignedIn,
}: PersonalTrainingPlanCardProps) {
  const [completedIds, setCompletedIds] = useState<string[]>(() => [...completedChallengeIds]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const completedSet = new Set(completedIds);

  if (!currentPlan) {
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
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black">
              My Weekly Training Plan
            </h2>
          </div>
        </div>

        <p className="text-xs sm:text-sm font-medium text-neutral-700 mb-4 leading-relaxed">
          {isSignedIn
            ? "Construct your personal weekly training plan by picking 1 to 6 focus drills from the library to build consistency and hit your goals."
            : "Sign in to construct a personalized weekly training plan, set drill goals, and track your daily improvement."}
        </p>

        <div>
          <Link
            href={isSignedIn ? "/training/plan/new" : "/player-login?returnTo=/training/plan/new"}
            className="inline-flex items-center justify-center text-center w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all touch-manipulation select-none"
          >
            {isSignedIn ? "+ Build My Weekly Plan →" : "Sign In to Create Plan →"}
          </Link>
        </div>
      </section>
    );
  }

  const { plan, items } = currentPlan;
  const completedCount = items.filter((i) => completedSet.has(i.challengeId)).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const allDone = items.length > 0 && completedCount === items.length;

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
              Week of {formatWeekOf(plan.year, plan.weekNumber)} · Personal Goals
            </span>
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
              {plan.title}
            </h2>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-xl border border-black font-display text-xs font-black uppercase ${
            allDone ? "bg-[#ccff00] text-black" : "bg-neutral-100 text-black"
          }`}
        >
          {completedCount} / {items.length} Goals Met
        </span>
      </div>

      {plan.focusNotes && (
        <p className="text-xs font-medium text-neutral-700 mb-3 bg-neutral-50 p-2.5 rounded-xl border border-black/10">
          🎯 {plan.focusNotes}
        </p>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-neutral-200 h-2.5 rounded-full border border-black overflow-hidden mb-4">
        <div
          className="bg-[#ccff00] h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Challenge List Items with direct record ability */}
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

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/training/plan/new"
          className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] text-center flex items-center justify-center touch-manipulation select-none active:translate-x-0.5 active:translate-y-0.5"
        >
          Edit My Plan
        </Link>
        {items.length < 6 && (
          <a
            href="#drill-library"
            className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] text-center flex items-center justify-center touch-manipulation select-none active:translate-x-0.5 active:translate-y-0.5"
          >
            + Add Drill from Library
          </a>
        )}
      </div>
    </section>
  );
}
