import React from "react";
import Link from "next/link";
import type { GroupTrainingPlanRecord, GroupTrainingPlanItemRecord } from "@/lib/domain/types";
import { TargetIcon, CheckIcon } from "@/components/ui/icons";

export interface WeeklyTrainingCardProps {
  readonly groupId: string;
  readonly isOrganizer: boolean;
  readonly currentPlan: {
    readonly plan: GroupTrainingPlanRecord;
    readonly items: readonly GroupTrainingPlanItemRecord[];
  } | null;
  readonly completedChallengeIds?: readonly string[];
}

export function WeeklyTrainingCard({
  groupId,
  isOrganizer,
  currentPlan,
  completedChallengeIds = [],
}: WeeklyTrainingCardProps) {
  const completedSet = new Set(completedChallengeIds);

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
          {isOrganizer && (
            <Link
              href={`/g/${groupId}/training/plan/new`}
              className="px-3 py-1.5 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              + Create Plan
            </Link>
          )}
        </div>

        <p className="text-sm font-medium text-neutral-700 mb-4">
          {isOrganizer
            ? "Publish a weekly challenge plan from the drill library for your group members to practice and record."
            : "No weekly training plan is currently active. Practice drills on your own in the Training Hub."}
        </p>

        <div>
          <Link
            href={isOrganizer ? `/g/${groupId}/training/plan/new` : "/training"}
            className="inline-flex items-center justify-center text-center w-full min-h-[44px] py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
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
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
              Week {plan.weekNumber} Training
            </span>
            <h2 className="font-display text-lg sm:text-xl font-black uppercase text-black leading-tight">
              {plan.title}
            </h2>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-neutral-100 border border-black font-display text-xs font-black uppercase text-black">
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

      {/* Challenge List Items */}
      <div className="space-y-2 mb-4">
        {items.map((item) => {
          const isDone = completedSet.has(item.challengeId);
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between p-2.5 rounded-xl border-2 ${
                isDone
                  ? "bg-lime-50/70 border-lime-600 text-lime-900"
                  : "bg-white border-black text-black"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    isDone
                      ? "bg-[#ccff00] border-black text-black"
                      : "border-neutral-400 bg-neutral-50"
                  }`}
                >
                  {isDone && <CheckIcon className="w-3.5 h-3.5 stroke-3" />}
                </span>
                <span className="font-display text-sm font-black uppercase truncate">
                  {item.challenge?.title ?? "Drill"}
                </span>
              </div>
              <span className="text-[11px] font-bold text-neutral-600 shrink-0 ml-2">
                {item.customGoalDescription ?? item.challenge?.scoreUnit ?? ""}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href={`/training?group=${groupId}`}
          className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-center text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center"
        >
          Practice Weekly Drills →
        </Link>
        {isOrganizer && (
          <Link
            href={`/g/${groupId}/training/plan/new`}
            className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] text-center flex items-center justify-center"
          >
            Edit
          </Link>
        )}
      </div>
    </section>
  );
}

