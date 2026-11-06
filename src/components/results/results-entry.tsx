"use client";

import React from "react";
import { RoundGenerationIndicator } from "@/components/rounds/round-generation-indicator";
import { PickleCelebration, isPickleScore } from "@/components/results/pickle-celebration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShuffleIcon } from "@/components/ui/icons";

import type { RoundProposal } from "@/lib/domain/types";

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

export type ScoreDrafts = Readonly<Record<string, { team1: string; team2: string }>>;

export interface ResultsEntryViewProps {
  readonly pickledMatchId?: string | null;
  readonly roundId: string;
  readonly roundNumber: number;
  readonly matches: readonly MatchScoreEntry[];
  readonly fieldErrors?: Record<string, string>;
  readonly isPending?: boolean;
  readonly isGeneratingRound?: boolean;
  readonly savingMatchIds?: ReadonlySet<string>;
  readonly onSubmitResult?: (matchId: string, team1Score: number, team2Score: number) => void;
  readonly onCancelMatch?: (matchId: string) => void;
  readonly onNextRound?: () => void;
  readonly onReshuffleRound?: () => void;
  readonly canManage?: boolean;
  readonly scoreDrafts?: ScoreDrafts;
  readonly hasUnsavedScores?: boolean;
  readonly onScoreChange?: (matchId: string, team: "team1" | "team2", value: string) => void;
  readonly courtCount?: number;
  readonly sittingNames?: readonly string[];
  readonly onAddGame?: () => void;
  readonly onSaveAllScores?: () => void;
  readonly onSaveAndStartNextRound?: () => void;
  readonly upcomingProposal?: RoundProposal | null;
  readonly playerNames?: Readonly<Record<string, string>>;
}

export function ResultsEntryView({
  roundNumber,
  pickledMatchId = null,
  matches,
  fieldErrors = {},
  isPending = false,
  isGeneratingRound = false,
  savingMatchIds,
  onSubmitResult,
  onCancelMatch,
  onNextRound,
  onReshuffleRound,
  canManage = true,
  scoreDrafts = {},
  hasUnsavedScores = false,
  onScoreChange,
  courtCount,
  sittingNames = [],
  onAddGame,
  onSaveAllScores,
  onSaveAndStartNextRound,
  upcomingProposal,
  playerNames = {},
}: ResultsEntryViewProps) {
  const getScores = (match: MatchScoreEntry) => scoreDrafts[match.id] ?? {
    team1: match.team1Score !== null ? String(match.team1Score) : "",
    team2: match.team2Score !== null ? String(match.team2Score) : "",
  };

  const handleSaveMatch = (matchId: string) => {
    const match = matches.find((entry) => entry.id === matchId);
    if (!match) return;
    const s = getScores(match);
    const t1 = parseInt(s.team1, 10);
    const t2 = parseInt(s.team2, 10);
    if (!isNaN(t1) && !isNaN(t2) && onSubmitResult) {
      onSubmitResult(matchId, t1, t2);
    }
  };

  const allMatchesHaveScores = matches.length > 0 && matches.every((m) => {
    if (m.status !== "pending") return true;
    const s = getScores(m);
    if (!s.team1 || !s.team2) return false;
    const t1 = parseInt(s.team1, 10);
    const t2 = parseInt(s.team2, 10);
    return !isNaN(t1) && !isNaN(t2) && t1 !== t2 && t1 >= 0 && t2 >= 0;
  });

  const hasDraftDiffs = matches.some((match) => {
    const draft = scoreDrafts[match.id];
    if (!draft || match.status === "cancelled") return false;
    const team1 = draft.team1.trim() === "" ? null : Number(draft.team1);
    const team2 = draft.team2.trim() === "" ? null : Number(draft.team2);
    return team1 !== match.team1Score || team2 !== match.team2Score;
  });

  const hasValidSaveableScores = matches.some((match) => {
    if (match.status === "cancelled") return false;
    const s = getScores(match);
    if (!s.team1 || !s.team2) return false;
    const t1 = parseInt(s.team1, 10);
    const t2 = parseInt(s.team2, 10);
    if (isNaN(t1) || isNaN(t2) || t1 === t2 || t1 < 0 || t2 < 0) return false;
    return t1 !== match.team1Score || t2 !== match.team2Score;
  });

  const hasNewScores = Boolean(hasUnsavedScores || hasValidSaveableScores || hasDraftDiffs);
  const isSaving = Boolean(savingMatchIds && savingMatchIds.size > 0);
  const hasScoreErrors = matches.some((m) => Boolean(fieldErrors[m.id]));

  const isSaveDisabled = !hasNewScores || isPending || isSaving;
  const isSaveAndStartDisabled = !allMatchesHaveScores || hasScoreErrors || isPending || isGeneratingRound || isSaving;

  return (
    <div className="results-entry-view space-y-6 pb-28 text-black">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000] mb-1">
            {canManage ? "Score Entry" : "Live Games"}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
            Round {roundNumber} {canManage ? "Results" : "Matchups"}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {canManage && onAddGame && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onAddGame}
                disabled={isPending || isGeneratingRound}
                className="font-display uppercase text-xs inline-flex items-center gap-1.5"
              >
                <span>+ Add Game</span>
              </Button>
            )}
            {canManage && onReshuffleRound && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onReshuffleRound}
                disabled={isPending || isGeneratingRound}
                data-testid="reshuffle-matchups-button"
                className="font-display uppercase text-xs inline-flex items-center gap-1.5"
              >
                <ShuffleIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Reshuffle</span>
              </Button>
            )}
          </div>
          <p className="text-xs font-bold text-neutral-600 hidden sm:block">
            {canManage ? "Enter non-tied scores (e.g. 11–9)" : "Current games and live scores"}
          </p>
        </div>
      </div>

      {/* Sitting Out Action Bar */}
      {sittingNames && sittingNames.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap p-3.5 bg-neutral-50 border-2 border-black rounded-2xl shadow-[2px_2px_0px_0px_#000]">
          <span className="text-xs font-black uppercase text-neutral-500">Sitting Out:</span>
          <span className="text-xs font-black text-black">{sittingNames.join(", ")}</span>
        </div>
      )}

      {/* Up Next Preview (Optimistic Pre-Generation) */}
      {upcomingProposal && (
        <div className="p-3 bg-neutral-50 border-2 border-black rounded-2xl shadow-[2px_2px_0px_0px_#000]">
          <details data-testid="upcoming-lineup-preview" className="group cursor-pointer">
            <summary className="flex items-center justify-between font-black uppercase text-xs text-neutral-800 select-none">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ccff00] border-2 border-black inline-block animate-pulse" />
                <span>Up Next: Round {roundNumber + 1} Lineup Preview</span>
              </span>
              <span className="text-neutral-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="pt-3 space-y-2.5 border-t-2 border-neutral-200 mt-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {upcomingProposal.courts.map((c) => (
                  <div key={c.courtNumber} className="p-2.5 rounded-xl bg-white border-2 border-black shadow-[1px_1px_0px_0px_#000] text-xs">
                    <span className="font-black text-black">Court {c.courtNumber}: </span>
                    <span className="font-bold text-neutral-800">
                      {c.team1.map((id) => playerNames[id] ?? id).join(" & ")} vs{" "}
                      {c.team2.map((id) => playerNames[id] ?? id).join(" & ")}
                    </span>
                  </div>
                ))}
              </div>
              {upcomingProposal.sitting.length > 0 && (
                <p className="text-xs font-bold text-neutral-600">
                  <span className="font-black uppercase text-neutral-500">Sitting Next: </span>
                  {upcomingProposal.sitting.map((id) => playerNames[id] ?? id).join(", ")}
                </p>
              )}
            </div>
          </details>
        </div>
      )}

      <div className="space-y-4">
        {matches.map((match) => {
          const matchScores = getScores(match);
          const err = fieldErrors[match.id];
          const isCancelled = match.status === "cancelled";
          const isCompleted = match.status === "completed";
          const isMatchSaving = isPending || Boolean(savingMatchIds?.has(match.id));
          const isPickup = courtCount !== undefined && match.courtNumber > courtCount;

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
                  {isPickup && (
                    <span className="text-xs font-black uppercase text-black bg-[#ccff00] border border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_0px_#000]">
                      Pickup Game
                    </span>
                  )}
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
                    {canManage ? (
                      <input
                        type="number"
                        min={0}
                        max={99}
                        aria-label={`Court ${match.courtNumber} Team 1 score`}
                        disabled={isCancelled || isMatchSaving}
                        value={matchScores.team1}
                        onChange={(e) =>
                          onScoreChange?.(match.id, "team1", e.target.value)
                        }
                        placeholder="Score"
                        className="w-24 bg-white border-2 border-black text-black rounded-xl px-3 py-2 text-2xl font-display font-black text-center shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow disabled:opacity-40"
                      />
                    ) : (
                      matchScores.team1 !== "" ? (
                        <span className="w-24 bg-white border-2 border-black text-black rounded-xl px-3 py-2 text-2xl font-display font-black text-center shadow-[2px_2px_0px_0px_#000] inline-block">
                          {matchScores.team1}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-neutral-500 italic py-2">
                          In Play
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Team 2 */}
                <div className="space-y-2 p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  <div className="text-sm font-black text-black">
                    {match.team2Names.join(" & ")}
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <input
                        type="number"
                        min={0}
                        max={99}
                        aria-label={`Court ${match.courtNumber} Team 2 score`}
                        disabled={isCancelled || isMatchSaving}
                        value={matchScores.team2}
                        onChange={(e) =>
                          onScoreChange?.(match.id, "team2", e.target.value)
                        }
                        placeholder="Score"
                        className="w-24 bg-white border-2 border-black text-black rounded-xl px-3 py-2 text-2xl font-display font-black text-center shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow disabled:opacity-40"
                      />
                    ) : (
                      matchScores.team2 !== "" ? (
                        <span className="w-24 bg-white border-2 border-black text-black rounded-xl px-3 py-2 text-2xl font-display font-black text-center shadow-[2px_2px_0px_0px_#000] inline-block">
                          {matchScores.team2}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-neutral-500 italic py-2">
                          In Play
                        </span>
                      )
                    )}
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
              {canManage && !isCancelled && (
                <div className="flex items-center justify-between pt-2 border-t-2 border-neutral-100">
                  {onCancelMatch && (
                    <button
                      type="button"
                      onClick={() => onCancelMatch(match.id)}
                      disabled={isMatchSaving}
                      className="text-xs font-black uppercase text-[#ff6b6b] hover:text-black hover:underline cursor-pointer disabled:opacity-40"
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
                      disabled={
                        isMatchSaving ||
                        matchScores.team1 === "" ||
                        matchScores.team2 === "" ||
                        (isCompleted &&
                          Number(matchScores.team1) === match.team1Score &&
                          Number(matchScores.team2) === match.team2Score)
                      }
                      className="ml-auto font-display text-base uppercase tracking-wider"
                    >
                      {isMatchSaving ? "Saving..." : (isCompleted ? "Update Score" : "Save Result")}
                    </Button>
                  )}
                </div>
              )}
              {pickledMatchId === match.id && isCompleted && isPickleScore(match.team1Score, match.team2Score) && (
                <PickleCelebration key={match.id} />
              )}
            </div>
          );
        })}
      </div>

      {/* Persistent Bottom Mobile Action Area */}
      {canManage && (
        <div className="mobile-action-bar sticky bottom-0 left-0 right-0 px-3 py-2.5 sm:px-4 sm:py-3 bg-white/95 backdrop-blur-md border-t-[3px] border-black z-40 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.06)]">
          {hasNewScores && (
            <p id="unsaved-score-warning" role="status" className="max-w-xl mx-auto mb-1.5 text-xs font-bold text-black">
              Save or revert your score changes before continuing.
            </p>
          )}
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2.5">
            <div className="text-left shrink-0">
              <p className="text-[10px] sm:text-xs uppercase font-black tracking-wider text-neutral-500 leading-none mb-0.5">Round Progress</p>
              <p className="font-display text-sm sm:text-base font-black uppercase text-black tracking-tight leading-tight">
                {matches.filter((m) => m.status !== "pending").length} of {matches.length} done
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end min-w-0">
              {onSaveAllScores && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaveDisabled}
                  onClick={onSaveAllScores}
                  data-testid="save-all-scores-button"
                  className="font-display text-xs sm:text-sm tracking-wide uppercase px-2 py-1.5 shrink-0"
                >
                  {isSaving ? "Saving..." : "Save All"}
                </Button>
              )}
              {canManage && (onSaveAndStartNextRound || onNextRound) && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isSaveAndStartDisabled}
                  onClick={onSaveAndStartNextRound ?? onNextRound}
                  data-testid="save-and-start-next-round-button"
                  title={`Save all scores and start Round ${roundNumber + 1}`}
                  className="font-display text-xs sm:text-sm tracking-wide uppercase px-2.5 py-1.5 shrink-0 shadow-[2px_2px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] bg-[#ccff00] text-black"
                >
                  {isGeneratingRound ? (
                    <RoundGenerationIndicator />
                  ) : (
                    <>
                      <span className="sr-only">Next Round</span>
                      <span className="sm:hidden">Save &amp; Start R{roundNumber + 1}</span>
                      <span className="hidden sm:inline">Save &amp; Start Next Round</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
