"use client";

import React, { useState } from "react";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";
import { formatMetricDisplay } from "@/lib/domain/training-calculator";
import { InlineResultLogger, type RosterPlayerOption } from "@/components/training/inline-result-logger";
import { ChevronDownIcon, TrophyIcon } from "@/components/ui/icons";

export interface ChallengeCardProps {
  readonly challenge: ChallengeTemplateRecord;
  readonly personalBest?: number | null;
  readonly groupId?: string | null;
  readonly planItemId?: string | null;
  readonly rosterPlayers?: readonly RosterPlayerOption[];
  readonly currentUserId?: string | null;
  readonly isCompletedThisWeek?: boolean;
}

export function ChallengeCard({
  challenge,
  personalBest,
  groupId,
  planItemId,
  rosterPlayers = [],
  currentUserId,
  isCompletedThisWeek = false,
}: ChallengeCardProps) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [currentPB, setCurrentPB] = useState<number | null | undefined>(personalBest);
  const [completed, setCompleted] = useState(isCompletedThisWeek);

  const formatLabels: Record<string, string> = {
    highest_score: "Streak / High Score",
    accuracy: "Accuracy %",
    wins: "Wins Challenge",
    completion: "Milestone",
    timed: "Timed Duration",
  };

  const categoryLabels: Record<string, string> = {
    dinking: "Dinking",
    third_shot: "Third Shot Drop",
    serving: "Serving",
    volleys: "Volleys",
    resets: "Resets",
    conditioning: "Conditioning",
  };

  const handleSaved = (metricValue: number, isPB: boolean) => {
    setCompleted(true);
    if (isPB) {
      setCurrentPB(metricValue);
    }
  };

  return (
    <div
      data-testid={`challenge-card-${challenge.id}`}
      className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between"
    >
      <div>
        {/* Badges header row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-black text-[#ccff00] font-display text-[11px] font-black uppercase tracking-wider">
            {categoryLabels[challenge.skillCategory] ?? challenge.skillCategory}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-neutral-100 text-neutral-800 font-display text-[11px] font-bold uppercase tracking-wider border border-black/20">
            {challenge.participantFormat}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-display text-[11px] font-bold uppercase tracking-wider border border-amber-300">
            {formatLabels[challenge.trackingFormat] ?? challenge.trackingFormat}
          </span>
          {completed && (
            <span className="ml-auto px-2 py-0.5 rounded-lg bg-[#ccff00] text-black font-display text-[11px] font-black uppercase tracking-wider border border-black shadow-[1px_1px_0px_0px_#000]">
              ✓ Done
            </span>
          )}
        </div>

        {/* Challenge title & summary */}
        <h3 className="font-display text-xl font-black uppercase tracking-tight text-black mb-1.5">
          {challenge.title}
        </h3>
        <p className="text-xs font-medium text-neutral-700 leading-relaxed mb-3">
          {challenge.description}
        </p>

        {/* Personal Best banner */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-100 border border-black/10 text-xs">
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
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setInstructionsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-black cursor-pointer"
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

