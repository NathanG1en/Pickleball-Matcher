"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";
import { formatMetricDisplay } from "@/lib/domain/training-calculator";
import { InlineResultLogger, type RosterPlayerOption } from "@/components/training/inline-result-logger";
import { ChevronDownIcon, TrophyIcon } from "@/components/ui/icons";

export interface ChallengeCardProps {
  readonly challenge: ChallengeTemplateRecord;
  readonly personalBest?: number | null;
  readonly groupId?: string | null;
  readonly planItemId?: string | null;
  readonly customGoalDescription?: string | null;
  readonly rosterPlayers?: readonly RosterPlayerOption[];
  readonly currentUserId?: string | null;
  readonly isCompletedThisWeek?: boolean;
  readonly activeCategory?: string;
}

export function ChallengeCard({
  challenge,
  personalBest,
  groupId,
  planItemId,
  customGoalDescription,
  rosterPlayers = [],
  currentUserId,
  isCompletedThisWeek = false,
  activeCategory,
}: ChallengeCardProps) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [currentPB, setCurrentPB] = useState<number | null | undefined>(personalBest);
  const [completed, setCompleted] = useState(isCompletedThisWeek);

  const categoryLabels: Record<string, string> = {
    dinking: "Dinking",
    third_shot: "Third Shot Drop",
    serving: "Serving",
    volleys: "Volleys",
    resets: "Resets",
    conditioning: "Conditioning",
    strategy: "Strategy",
  };

  const handleSaved = (metricValue: number, isPB: boolean) => {
    setCompleted(true);
    if (isPB) {
      setCurrentPB(metricValue);
    }
  };

  const filterHref =
    activeCategory === challenge.skillCategory
      ? groupId
        ? `/training?group=${groupId}`
        : "/training"
      : groupId
      ? `/training?group=${groupId}&category=${challenge.skillCategory}`
      : `/training?category=${challenge.skillCategory}`;

  return (
    <div
      data-testid={`challenge-card-${challenge.id}`}
      className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between overflow-hidden max-w-full"
    >
      <div>
        {/* Badges header row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <Link
            href={filterHref}
            className={`px-2 py-0.5 rounded-lg font-display text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors border select-none cursor-pointer inline-block ${
              activeCategory === challenge.skillCategory
                ? "bg-black text-[#ccff00] border-black shadow-[1px_1px_0px_0px_#000]"
                : "bg-black text-[#ccff00] hover:bg-neutral-800 border-black"
            }`}
            title={
              activeCategory === challenge.skillCategory
                ? "Clear category filter"
                : `Filter by ${categoryLabels[challenge.skillCategory] ?? challenge.skillCategory}`
            }
          >
            {categoryLabels[challenge.skillCategory] ?? challenge.skillCategory}
          </Link>
          {completed && (
            <span className="ml-auto px-2 py-0.5 rounded-lg bg-[#ccff00] text-black font-display text-[10px] sm:text-[11px] font-black uppercase tracking-wider border border-black shadow-[1px_1px_0px_0px_#000]">
              ✓ Done
            </span>
          )}
        </div>

        {/* Challenge title & summary */}
        <h3 className="font-display text-lg sm:text-xl font-black uppercase tracking-tight text-black mb-1.5 leading-snug">
          {challenge.title}
        </h3>
        <p className="text-xs font-medium text-neutral-700 leading-relaxed mb-3">
          {challenge.description}
        </p>

        {customGoalDescription && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-lime-100 border border-lime-600/40 text-xs text-lime-950 mb-2.5 font-bold">
            <span className="text-[10px] uppercase font-black tracking-wider bg-lime-300 px-1.5 py-0.5 rounded border border-lime-700 shrink-0">
              Goal
            </span>
            <span className="truncate">{customGoalDescription}</span>
          </div>
        )}

        {/* Personal Best banner */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-100 border border-black/10 text-xs">
          <TrophyIcon className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold text-neutral-700">Personal Best:</span>
          <span className="font-display font-black text-black ml-auto">
            {currentPB !== null && currentPB !== undefined
              ? formatMetricDisplay({
                  trackingFormat: challenge.trackingFormat,
                  metricValue: currentPB,
                  scoreUnit: challenge.scoreUnit,
                })
              : "No attempts yet"}
          </span>
        </div>

        {/* Collapsible Instructions */}
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setInstructionsOpen((prev) => !prev)}
            className="w-full sm:w-auto py-1.5 flex items-center justify-between sm:justify-start gap-1.5 text-xs font-bold text-neutral-600 hover:text-black cursor-pointer touch-manipulation select-none"
          >
            <span>{instructionsOpen ? "Hide Instructions" : "How to Practice & Setup"}</span>
            <ChevronDownIcon
              className={`w-3.5 h-3.5 transition-transform ${instructionsOpen ? "rotate-180" : ""}`}
            />
          </button>
          {instructionsOpen && (
            <div className="mt-2 p-3 bg-neutral-50 rounded-xl border border-black/10 text-xs text-neutral-700 space-y-2">
              <div>
                <span className="font-black uppercase text-[10px] text-neutral-500 block mb-0.5">Instructions</span>
                <p className="leading-relaxed">{challenge.instructions}</p>
              </div>
              {challenge.defaultTargetGoal && (
                <div>
                  <span className="font-black uppercase text-[10px] text-neutral-500 block mb-0.5">Target Benchmark</span>
                  <p className="font-bold text-black">
                    {challenge.defaultTargetGoal} {challenge.scoreUnit}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Embedded inline logger for rapid entry */}
      <InlineResultLogger
        challenge={challenge}
        groupId={groupId}
        planItemId={planItemId}
        rosterPlayers={rosterPlayers}
        currentUserId={currentUserId}
        onResultSaved={handleSaved}
      />
    </div>
  );
}

