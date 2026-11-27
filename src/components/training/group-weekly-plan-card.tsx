"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { GroupTrainingPlanRecord, GroupTrainingPlanItemRecord, GroupRecord } from "@/lib/domain/types";
import { TargetIcon, CheckIcon } from "@/components/ui/icons";
import { InlineResultLogger, type RosterPlayerOption } from "@/components/training/inline-result-logger";
import { PlanProgress, isGeneratedPlanTitle } from "@/components/training/plan-progress";
import type { LastResultSummary } from "@/lib/domain/training-history";

export interface GroupWeeklyPlanCardProps {
  readonly group: Pick<GroupRecord, "id" | "name">;
  readonly plan: GroupTrainingPlanRecord;
  readonly items: readonly GroupTrainingPlanItemRecord[];
  readonly completedChallengeIds?: readonly string[];
  readonly currentUserId?: string | null;
  readonly rosterPlayers?: readonly RosterPlayerOption[];
  readonly isOrganizer?: boolean;
  /** Most recent result per drill id, shown as "Last time" in the logger. */
  readonly lastResults?: Readonly<Record<string, LastResultSummary>>;
}

export function GroupWeeklyPlanCard({
  group,
  plan,
  items,
  completedChallengeIds = [],
  currentUserId,
  rosterPlayers = [],
  isOrganizer = false,
  lastResults = {},
}: GroupWeeklyPlanCardProps) {
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
  const completedCount = items.filter((i) => completedSet.has(i.challengeId)).length;

  return (
    <section
      data-testid={`group-training-plan-${group.id}`}
      className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_0px_#000] space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] shrink-0">
            <TargetIcon className="w-4 h-4 text-black" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span
                data-testid={`group-name-tag-${group.id}`}
                className="px-2.5 py-0.5 rounded-full bg-[#ccff00] text-black text-xs font-bold border border-black shadow-[1px_1px_0px_0px_#000]"
              >
                {group.name}
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
              {isGeneratedPlanTitle(plan.title) ? "Group Plan" : plan.title}
            </h2>
          </div>
        </div>
      </div>

      {plan.focusNotes && (
        <p className="text-xs font-medium text-neutral-700 bg-neutral-50 p-2.5 rounded-xl border border-black/10">
          💡 <span className="font-bold">Coach Focus Notes:</span> {plan.focusNotes}
        </p>
      )}

      <PlanProgress completed={completedCount} total={items.length} />

      {/* Drill List Items with direct inline record capability */}
      <div className="space-y-2.5">
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
                  <span className="text-xs font-bold text-neutral-600 hidden sm:inline-block max-w-[140px] text-right truncate">
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
                <div className="sm:hidden mt-1.5 text-xs font-bold text-neutral-600">
                  Goal: {item.customGoalDescription}
                </div>
              )}

              {/* Inline Logger */}
              {isExpanded && item.challenge && (
                <div className="mt-3 pt-3 border-t border-black/10">
                  <InlineResultLogger
                    challenge={item.challenge}
                    groupId={group.id}
                    planItemId={item.id}
                    rosterPlayers={rosterPlayers}
                    currentUserId={currentUserId}
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

      {/* Footer link to dedicated group training view */}
      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/training?group=${group.id}`}
          className="inline-flex items-center min-h-[40px] px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-colors select-none"
        >
          Open Group Drills →
        </Link>
        {isOrganizer && (
          <Link
            href={`/g/${group.id}/training/plan/new?returnTo=/training`}
            className="inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-colors select-none"
          >
            Edit Group Plan
          </Link>
        )}
      </div>
    </section>
  );
}

