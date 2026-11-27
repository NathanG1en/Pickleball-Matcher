"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { GroupTrainingPlanRecord, GroupTrainingPlanItemRecord } from "@/lib/domain/types";
import { formatWeekOf } from "@/lib/domain/training-calculator";
import { TargetIcon, CheckIcon } from "@/components/ui/icons";
import { InlineResultLogger } from "@/components/training/inline-result-logger";
import type { LastResultSummary } from "@/lib/domain/training-history";

export interface WeeklyTrainingCardProps {
  readonly groupId: string;
  readonly isOrganizer: boolean;
  readonly currentPlan: {
    readonly plan: GroupTrainingPlanRecord;
    readonly items: readonly GroupTrainingPlanItemRecord[];
  } | null;
  readonly completedChallengeIds?: readonly string[];
  /** Most recent result per drill id, shown as "Last time" in the logger. */
  readonly lastResults?: Readonly<Record<string, LastResultSummary>>;
}

export function WeeklyTrainingCard({
  groupId,
  isOrganizer,
  currentPlan,
  completedChallengeIds = [],
  lastResults = {},
}: WeeklyTrainingCardProps) {
  // Attempts saved in this view (per drill) that haven't been undone.
  const [sessionSaveCounts, setSessionSaveCounts] = useState<Record<string, number>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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

  if (!currentPlan) {
    return (
      <section
        data-testid="weekly-training-card"
        className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 sm:p-6 lg:p-7 shadow-[4px_4px_0px_0px_#000]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] shrink-0">
              <TargetIcon className="w-4 h-4 text-black" />
            </span>
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black">
              Weekly Training
            </h2>
          </div>
        </div>

        <p className="text-sm font-medium text-neutral-700 mb-4">
          {isOrganizer
            ? "Publish a weekly challenge plan from the drill library for your group members to practice and record."
            : "No weekly training plan is currently active. Practice drills on your own in the Training Hub."}
        </p>

        <div>
          <Link
            href={isOrganizer ? `/g/${groupId}/training/plan/new` : "/training"}
            className="inline-flex items-center justify-center text-center w-full min-h-[44px] py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            {isOrganizer ? "Create Weekly Plan →" : "Browse Training Hub →"}
          </Link>
        </div>
      </section>
    );
  }

  const { plan, items } = currentPlan;
  const completedCount = items.filter((i) => completedSet.has(i.challengeId)).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <section
      data-testid="weekly-training-card"
      className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 sm:p-6 lg:p-7 shadow-[4px_4px_0px_0px_#000]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] shrink-0">
            <TargetIcon className="w-4 h-4 text-black" />
          </span>
          <div>
            <span className="text-xs font-bold text-neutral-600 block">
              Week of {formatWeekOf(plan.year, plan.weekNumber)} · Training
            </span>
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
              {plan.title}
            </h2>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-neutral-100 border border-black text-xs font-bold text-black">
          {completedCount} / {items.length} Done
        </span>
      </div>

      {plan.focusNotes && (
        <p className="text-xs font-medium text-neutral-600 mb-3 bg-white/70 p-2.5 rounded-xl border border-black/10">
          💡 {plan.focusNotes}
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
                  ? "bg-lime-50/70 border-lime-600 text-lime-900"
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
                  <span className="text-xs font-bold text-neutral-600 hidden sm:inline-block max-w-[140px] text-right truncate">
                    {item.customGoalDescription ?? item.challenge?.scoreUnit ?? ""}
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
                <div className="sm:hidden mt-1.5 text-xs font-bold text-neutral-600">
                  Goal: {item.customGoalDescription}
                </div>
              )}

              {/* Inline Logger directly in plan */}
              {isExpanded && item.challenge && (
                <div className="mt-3 pt-3 border-t border-black/10">
                  <InlineResultLogger
                    challenge={item.challenge}
                    groupId={groupId}
                    planItemId={item.id}
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

      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href={`/training?group=${groupId}`}
          className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8e600] text-black border-2 border-black text-center text-sm sm:text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-colors flex items-center justify-center select-none"
        >
          Practice Weekly Drills →
        </Link>
        {isOrganizer && (
          <Link
            href={`/g/${groupId}/training/plan/new`}
            className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-colors text-center flex items-center justify-center select-none"
          >
            Edit
          </Link>
        )}
      </div>
    </section>
  );
}
