"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface MatchScoreEntry {
  readonly id: string;
  readonly courtNumber: number;
  readonly team1Names: readonly [string, string];
  readonly team2Names: readonly [string, string];
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
    <div className="results-entry-view space-y-6 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Score Entry
          </span>
          <h1 className="text-2xl font-black text-white">Round {roundNumber} Results</h1>
        </div>
        <p className="text-xs text-slate-400">
          Enter non-tied scores (e.g. 11–9)
        </p>
      </div>

      <div className="space-y-4">
        {matches.map((match) => {
          const matchScores = scores[match.id] ?? { team1: "", team2: "" };
          const err = fieldErrors[match.id];
          const isCancelled = match.status === "cancelled";
          const isCompleted = match.status === "completed";

          return (
            <div
              key={match.id}
              data-testid={`court-match-${match.courtNumber}`}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4 ${
                isCancelled
                  ? "border-slate-800 opacity-60"
                  : isCompleted
                  ? "border-emerald-800/80 bg-slate-900/90"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-emerald-400">
                  Court {match.courtNumber}
                </span>
                <div>
                  {isCancelled && <Badge variant="muted">Cancelled</Badge>}
                  {isCompleted && <Badge variant="success">Final</Badge>}
                  {match.status === "pending" && <Badge variant="warning">In Play</Badge>}
                </div>
              </div>

              {/* Match Score Input Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Team 1 */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-200">
                    {match.team1Names[0]} &amp; {match.team1Names[1]}
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
                      className="w-24 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xl font-bold text-center focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Team 2 */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-200">
                    {match.team2Names[0]} &amp; {match.team2Names[1]}
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
                      className="w-24 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xl font-bold text-center focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Error message */}
              {err && (
                <div role="alert" className="text-sm text-rose-400 font-medium">
                  {err}
                </div>
              )}

              {/* Court Actions */}
              {!isCancelled && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  {onCancelMatch && (
                    <button
                      type="button"
                      onClick={() => onCancelMatch(match.id)}
                      disabled={isPending}
                      className="text-xs text-rose-400/80 hover:text-rose-300 underline"
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
                      className="ml-auto"
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
      <div className="mobile-action-bar fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs uppercase text-slate-400">Round Progress</p>
            <p className="text-sm font-bold text-white">
              {matches.filter((m) => m.status !== "pending").length} of {matches.length} courts completed
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!allResolved || isPending}
            onClick={onNextRound}
            className="flex-1 max-w-xs shadow-lg shadow-emerald-950/50"
          >
            Next Round
          </Button>
        </div>
      </div>
    </div>
  );
}
