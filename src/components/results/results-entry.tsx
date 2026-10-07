"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface MatchScoreEntry {
  readonly id: string;
  readonly courtNumber: number;
  readonly team1Names: readonly string[];
  readonly team2Names: readonly string[];
  readonly team1Score: number | null;
  readonly team2Score: number | null;
  readonly status: "pending" | "completed" | "cancelled";
  readonly version: number;
}

export interface ResultsEntryViewProps {
  readonly roundId: string;
  readonly roundNumber: number;
  readonly matches: readonly MatchScoreEntry[];
  readonly fieldErrors?: Record<string, string>;
  readonly isPending?: boolean;
  readonly onSubmitResult?: (matchId: string, team1Score: number, team2Score: number) => void;
  readonly onCancelMatch?: (matchId: string) => void;
  readonly onNextRound?: () => void;
}

export function ResultsEntryView({
  roundNumber,
  matches,
  fieldErrors = {},
  isPending = false,
  onSubmitResult,
  onCancelMatch,
  onNextRound,
}: ResultsEntryViewProps) {
  const [scores, setScores] = useState<
    Record<string, { team1: string; team2: string }>
  >(() => {
    const initial: Record<string, { team1: string; team2: string }> = {};
    for (const match of matches) {
      initial[match.id] = {
        team1: match.team1Score !== null ? String(match.team1Score) : "",
        team2: match.team2Score !== null ? String(match.team2Score) : "",
      };
    }
    return initial;
  });

  const handleScoreChange = (
    matchId: string,
    team: "team1" | "team2",
    value: string,
  ) => {
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: value,
      },
    }));
  };

  const handleSaveMatch = (matchId: string) => {
    const s = scores[matchId];
    if (!s) return;
    const t1 = parseInt(s.team1, 10);
    const t2 = parseInt(s.team2, 10);
    if (!isNaN(t1) && !isNaN(t2) && onSubmitResult) {
      onSubmitResult(matchId, t1, t2);
    }
  };

  const allResolved = matches.every((m) => m.status !== "pending");

  return (
    <div className="results-entry-view space-y-6 pb-28 text-black">
      <div className="flex items-center justify-between">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000] mb-1">
            Score Entry
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
            Round {roundNumber} Results
          </h1>
        </div>
        <p className="text-xs font-bold text-neutral-600">
          Enter non-tied scores (e.g. 11–9)
        </p>
      </div>

      <div className="space-y-4">
        {matches.map((match) => {
          const matchScores = scores[match.id] ?? { team1: "", team2: "" };
          const err = fieldErrors[match.id];
          const isCancelled = match.status === "cancelled";
          const isCompleted = match.status === "completed";

          const isSingles = match.team1Names.length === 1 && match.team2Names.length === 1;

          return (
            <div
              key={match.id}
              data-testid={`court-match-${match.courtNumber}`}
              className={`border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000] space-y-4 transition-all ${
                isCancelled
                  ? "bg-neutral-100 opacity-60 border-neutral-400"
                  : isCompleted
                  ? "bg-[#ecfdf5]"
                  : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between border-b-2 border-neutral-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl font-black uppercase text-black">
                    Court {match.courtNumber}
                  </span>
                  {isSingles && (
                    <span className="text-xs font-black uppercase text-neutral-700 bg-neutral-200 px-2 py-0.5 rounded-md">
                      Singles (Optional)
                    </span>
                  )}
                </div>
                <div>
                  {isCancelled && <Badge variant="muted">{isSingles ? "Unrecorded" : "Cancelled"}</Badge>}
                  {isCompleted && <Badge variant="success">Final</Badge>}
                  {match.status === "pending" && <Badge variant="warning">In Play</Badge>}
                </div>
              </div>

              {/* Match Score Input Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Team 1 */}
                <div className="space-y-2 p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  <div className="text-sm font-black text-black">
                    {match.team1Names.join(" & ")}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      aria-label={`Court ${match.courtNumber} Team 1 score`}
                      disabled={isCancelled || isPending}
                      value={matchScores.team1}
                      onChange={(e) =>
                        handleScoreChange(match.id, "team1", e.target.value)
                      }
                      placeholder="Score"
                      className="w-24 bg-white border-2 border-black text-black rounded-xl px-3 py-2 text-2xl font-display font-black text-center shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Team 2 */}
                <div className="space-y-2 p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  <div className="text-sm font-black text-black">
                    {match.team2Names.join(" & ")}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      aria-label={`Court ${match.courtNumber} Team 2 score`}
                      disabled={isCancelled || isPending}
                      value={matchScores.team2}
                      onChange={(e) =>
                        handleScoreChange(match.id, "team2", e.target.value)
                      }
                      placeholder="Score"
                      className="w-24 bg-white border-2 border-black text-black rounded-xl px-3 py-2 text-2xl font-display font-black text-center shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Error message */}
              {err && (
                <div role="alert" className="p-2.5 rounded-lg bg-[#ff6b6b] border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black font-black text-xs">
                  {err}
                </div>
              )}

              {/* Court Actions */}
              {!isCancelled && (
                <div className="flex items-center justify-between pt-2 border-t-2 border-neutral-100">
                  {onCancelMatch && (
                    <button
                      type="button"
                      onClick={() => onCancelMatch(match.id)}
                      disabled={isPending}
                      className="text-xs font-black uppercase text-[#ff6b6b] hover:text-black hover:underline cursor-pointer"
                    >
                      Cancel match
                    </button>
                  )}
                  {onSubmitResult && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isCompleted ? "secondary" : "primary"}
                      onClick={() => handleSaveMatch(match.id)}
                      disabled={isPending || matchScores.team1 === "" || matchScores.team2 === ""}
                      className="ml-auto font-display text-base uppercase tracking-wider"
                    >
                      {isCompleted ? "Update Score" : "Save Result"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Persistent Bottom Mobile Action Area */}
      <div className="mobile-action-bar sticky bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t-[3px] border-black z-40 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.06)]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs uppercase font-black tracking-wider text-neutral-500">Round Progress</p>
            <p className="font-display text-base font-black uppercase text-black tracking-tight">
              {matches.filter((m) => m.status !== "pending").length} of {matches.length} courts completed
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!allResolved || isPending}
            onClick={onNextRound}
            className="flex-1 max-w-xs font-display text-lg tracking-wide uppercase"
          >
            Next Round
          </Button>
        </div>
      </div>
    </div>
  );
}
