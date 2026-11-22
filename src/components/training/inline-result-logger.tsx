"use client";

import React, { useState, useTransition } from "react";
import { recordTrainingResultAction } from "@/app/actions/training";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";
import { CheckIcon } from "@/components/ui/icons";

export interface RosterPlayerOption {
  readonly id: string;
  readonly name: string;
  readonly username?: string | null;
}

export interface InlineResultLoggerProps {
  readonly challenge: ChallengeTemplateRecord;
  readonly groupId?: string | null;
  readonly planItemId?: string | null;
  readonly rosterPlayers?: readonly RosterPlayerOption[];
  readonly currentUserId?: string | null;
  readonly onResultSaved?: (metricValue: number, isPersonalBest: boolean) => void;
}

export function InlineResultLogger({
  challenge,
  groupId,
  planItemId,
  rosterPlayers = [],
  onResultSaved,
}: InlineResultLoggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [scorePrimary, setScorePrimary] = useState<number>(() => {
    if (challenge.trackingFormat === "accuracy") return 15;
    if (challenge.trackingFormat === "timed") return 30;
    return 10;
  });
  const [scoreSecondary, setScoreSecondary] = useState<number>(() => {
    if (challenge.trackingFormat === "accuracy") return 20;
    return 0;
  });
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
    isPersonalBest?: boolean;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const payload = {
        challengeId: challenge.id,
        groupId: groupId ?? null,
        planItemId: planItemId ?? null,
        scorePrimary: Number(scorePrimary),
        scoreSecondary:
          challenge.trackingFormat === "accuracy" ? Number(scoreSecondary) : undefined,
        completed: true,
        notes: notes.trim() ? notes.trim() : null,
        participantPlayerIds: selectedPartnerId ? [selectedPartnerId] : [],
      };

      const result = await recordTrainingResultAction(payload);
      if (result.ok) {
        setFeedback({
          success: true,
          message: `Attempt saved! (+${result.data.pointsEarned} pts)`,
          isPersonalBest: result.data.isPersonalBest,
        });
        if (onResultSaved) {
          onResultSaved(result.data.metricValue, result.data.isPersonalBest);
        }
      } else {
        setFeedback({
          success: false,
          message: result.error,
        });
      }
    });
  };

  const calculatedAccuracy =
    challenge.trackingFormat === "accuracy" && scoreSecondary > 0
      ? Math.round((Math.min(scorePrimary, scoreSecondary) / scoreSecondary) * 100)
      : null;

  return (
    <div className="mt-3 pt-3 border-t-2 border-black/10">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-white hover:bg-[#ccff00] active:bg-[#ccff00] text-black border-2 border-black font-display text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2 touch-manipulation select-none"
        >
          <span>+ Record Attempt</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 bg-white/95 rounded-2xl border-2 border-black space-y-3.5 overflow-hidden max-w-full">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-black uppercase text-neutral-800 tracking-wider">
              Record Attempt · {challenge.scoreUnit}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFeedback(null);
              }}
              className="text-xs font-bold text-neutral-600 hover:text-black cursor-pointer px-3 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors touch-manipulation select-none"
            >
              Close
            </button>
          </div>

          {/* Stepper Inputs tailored to tracking format */}
          {challenge.trackingFormat === "accuracy" ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label htmlFor={`shots-in-${challenge.id}`} className="block text-[11px] font-black uppercase text-neutral-600 mb-1">
                  Shots In
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setScorePrimary((p) => Math.max(0, p - 1))}
                    className="w-10 sm:w-11 h-11 rounded-l-xl bg-neutral-200 active:bg-neutral-300 font-black text-base border-2 border-r-0 border-black flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0"
                  >
                    -
                  </button>
                  <input
                    id={`shots-in-${challenge.id}`}
                    type="number"
                    min={0}
                    max={scoreSecondary}
                    value={scorePrimary}
                    onChange={(e) => setScorePrimary(Number(e.target.value))}
                    className="w-full min-w-0 h-11 text-center font-black text-base sm:text-lg border-y-2 border-black focus:outline-none focus:bg-[#FFFDF7]"
                  />
                  <button
                    type="button"
                    onClick={() => setScorePrimary((p) => Math.min(scoreSecondary, p + 1))}
                    className="w-10 sm:w-11 h-11 rounded-r-xl bg-neutral-200 active:bg-neutral-300 font-black text-base border-2 border-l-0 border-black flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor={`total-shots-${challenge.id}`} className="block text-[11px] font-black uppercase text-neutral-600 mb-1">
                  Total Attempts
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setScoreSecondary((s) => Math.max(1, s - 5))}
                    className="w-10 sm:w-11 h-11 rounded-l-xl bg-neutral-200 active:bg-neutral-300 font-black text-base border-2 border-r-0 border-black flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0"
                  >
                    -
                  </button>
                  <input
                    id={`total-shots-${challenge.id}`}
                    type="number"
                    min={1}
                    value={scoreSecondary}
                    onChange={(e) => setScoreSecondary(Number(e.target.value))}
                    className="w-full min-w-0 h-11 text-center font-black text-base sm:text-lg border-y-2 border-black focus:outline-none focus:bg-[#FFFDF7]"
                  />
                  <button
                    type="button"
                    onClick={() => setScoreSecondary((s) => s + 5)}
                    className="w-10 sm:w-11 h-11 rounded-r-xl bg-neutral-200 active:bg-neutral-300 font-black text-base border-2 border-l-0 border-black flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : challenge.trackingFormat === "timed" ? (
            <div>
              <label htmlFor={`seconds-${challenge.id}`} className="block text-[11px] font-black uppercase text-neutral-600 mb-1">
                Duration (Seconds)
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setScorePrimary((p) => Math.max(1, p - 1))}
                  className="w-12 sm:w-14 h-11 rounded-l-xl bg-neutral-200 active:bg-neutral-300 font-black text-lg border-2 border-r-0 border-black flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0"
                >
                  -
                </button>
                <input
                  id={`seconds-${challenge.id}`}
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={scorePrimary}
                  onChange={(e) => setScorePrimary(Number(e.target.value))}
                  className="w-full h-11 text-center font-black text-base sm:text-lg border-y-2 border-black focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setScorePrimary((p) => p + 1)}
                  className="w-12 sm:w-14 h-11 rounded-r-xl bg-neutral-200 active:bg-neutral-300 font-black text-lg border-2 border-l-0 border-black flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor={`primary-score-${challenge.id}`} className="block text-[11px] font-black uppercase text-neutral-600 mb-1">
                {challenge.trackingFormat === "wins"
                  ? "Games Won"
                  : challenge.trackingFormat === "highest_score"
                  ? "Streak / Score"
                  : "Completed Reps"}
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setScorePrimary((p) => Math.max(0, p - (challenge.trackingFormat === "wins" ? 1 : 5)))}
                  className="w-12 sm:w-14 h-11 rounded-l-xl bg-neutral-200 active:bg-neutral-300 font-black text-lg border-2 border-r-0 border-black flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0"
                >
                  -
                </button>
                <input
                  id={`primary-score-${challenge.id}`}
                  type="number"
                  min={0}
                  value={scorePrimary}
                  onChange={(e) => setScorePrimary(Number(e.target.value))}
                  className="w-full h-11 text-center font-black text-base sm:text-lg border-y-2 border-black focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setScorePrimary((p) => p + (challenge.trackingFormat === "wins" ? 1 : 5))}
                  className="w-12 sm:w-14 h-11 rounded-r-xl bg-neutral-200 active:bg-neutral-300 font-black text-lg border-2 border-l-0 border-black flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Accuracy Live Preview */}
          {calculatedAccuracy !== null && (
            <div className="text-center py-1.5 px-2 rounded-xl bg-neutral-100 border border-black/10 font-display text-xs font-black text-black">
              Result: {scorePrimary}/{scoreSecondary} ({calculatedAccuracy}%)
            </div>
          )}

          {/* Partner selector for partner or group formats */}
          {challenge.participantFormat !== "individual" && rosterPlayers.length > 0 && (
            <div>
              <label htmlFor={`partner-select-${challenge.id}`} className="block text-[11px] font-black uppercase text-neutral-600 mb-1">
                Partner / Co-Participant (Optional)
              </label>
              <select
                id={`partner-select-${challenge.id}`}
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="w-full h-11 px-3 text-base sm:text-xs font-bold rounded-xl border-2 border-black bg-white focus:outline-none"
              >
                <option value="">Solo or Partner not on roster</option>
                {rosterPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} {player.username ? `(@${player.username})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Notes */}
          <div>
            <input
              type="text"
              placeholder="Optional notes (e.g. crosscourt wind)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              className="w-full h-11 px-3 text-base sm:text-xs rounded-xl border-2 border-black/20 focus:border-black focus:outline-none bg-white"
            />
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                feedback.success
                  ? "bg-lime-100 text-lime-900 border border-lime-500"
                  : "bg-rose-100 text-rose-900 border border-rose-500"
              }`}
            >
              {feedback.success && <CheckIcon className="w-3.5 h-3.5 text-lime-700 stroke-2 shrink-0" />}
              <span className="leading-tight">{feedback.message}</span>
              {feedback.isPersonalBest && (
                <span className="ml-auto px-1.5 py-0.5 rounded bg-[#ccff00] text-black font-display font-black text-[10px] uppercase border border-black shrink-0">
                  New PB!
                </span>
              )}
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 touch-manipulation select-none"
          >
            {isPending ? "Saving..." : "Save Attempt"}
          </button>
        </form>
      )}
    </div>
  );
}

