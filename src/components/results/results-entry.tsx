"use client";

import React from "react";
import { RoundGenerationIndicator } from "@/components/rounds/round-generation-indicator";
import { PickleCelebration, isPickleScore } from "@/components/results/pickle-celebration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShuffleIcon } from "@/components/ui/icons";

import { ClientTime } from "@/components/ui/client-date-time";

import type { RoundProposal } from "@/lib/domain/types";

export interface MatchScoreEntry {
  readonly id: string;
  readonly courtNumber: number;
  readonly team1Names: readonly string[];
  readonly team2Names: readonly string[];
  /** Player ids in the same order as team1Names / team2Names, used to find the viewer. */
  readonly team1PlayerIds?: readonly string[];
  readonly team2PlayerIds?: readonly string[];
  readonly team1Score: number | null;
  readonly team2Score: number | null;
  readonly status: "pending" | "completed" | "cancelled";
  readonly version: number;
  readonly startedAt?: Date | string | null;
  readonly completedAt?: Date | string | null;
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
  readonly confirmMatchups?: boolean;
  /** The roster player using this device, when they are on the session roster. */
  readonly viewerPlayerId?: string | null;
  readonly sittingPlayerIds?: readonly string[];
}

type ViewerRoundState =
  | { kind: "playing"; match: MatchScoreEntry; team: 1 | 2; partners: readonly string[]; opponents: readonly string[] }
  | { kind: "sitting" }
  | null;

export function getViewerRoundState(
  matches: readonly MatchScoreEntry[],
  viewerPlayerId: string | null | undefined,
  sittingPlayerIds: readonly string[] = [],
): ViewerRoundState {
  if (!viewerPlayerId) return null;
  for (const match of matches) {
    const index1 = match.team1PlayerIds?.indexOf(viewerPlayerId) ?? -1;
    const index2 = match.team2PlayerIds?.indexOf(viewerPlayerId) ?? -1;
    if (index1 >= 0 || index2 >= 0) {
      const team: 1 | 2 = index1 >= 0 ? 1 : 2;
      const ownNames = team === 1 ? match.team1Names : match.team2Names;
      const ownIndex = team === 1 ? index1 : index2;
      return {
        kind: "playing",
        match,
        team,
        partners: ownNames.filter((_, i) => i !== ownIndex),
        opponents: team === 1 ? match.team2Names : match.team1Names,
      };
    }
  }
  return sittingPlayerIds.includes(viewerPlayerId) ? { kind: "sitting" } : null;
}

function ViewerRoundCard({ state }: { state: NonNullable<ViewerRoundState> }) {
  if (state.kind === "sitting") {
    return (
      <section
        data-testid="viewer-round-card"
        aria-live="polite"
        className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]"
      >
        <h2 className="font-display text-3xl font-black uppercase leading-none text-black">You&apos;re sitting out</h2>
        <p className="mt-2 text-sm font-bold text-neutral-800">
          Take a breather. You&apos;ll have priority when the next round is made.
        </p>
      </section>
    );
  }

  const { match, team, partners, opponents } = state;
  const ownScore = team === 1 ? match.team1Score : match.team2Score;
  const otherScore = team === 1 ? match.team2Score : match.team1Score;
  const isFinal = match.status === "completed" && ownScore !== null && otherScore !== null;

  return (
    <section
      data-testid="viewer-round-card"
      aria-live="polite"
      className="rounded-2xl border-[3px] border-black bg-[#ccff00] p-4 shadow-[4px_4px_0px_0px_#000]"
    >
      <h2 className="font-display text-3xl font-black uppercase leading-none text-black">
        You&apos;re on Court {match.courtNumber}
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-black uppercase text-black/70">With</dt>
        <dd className="font-black text-black">{partners.length > 0 ? partners.join(" & ") : "Singles"}</dd>
        <dt className="font-black uppercase text-black/70">Vs</dt>
        <dd className="font-black text-black">{opponents.join(" & ")}</dd>
      </dl>
      {match.status === "cancelled" ? (
        <p className="mt-3 text-sm font-bold text-black">This game was cancelled by the organizer.</p>
      ) : isFinal ? (
        <p className="mt-3 text-sm font-black text-black">
          Final · You {ownScore > otherScore ? "won" : "lost"} {ownScore}–{otherScore}
        </p>
      ) : null}
    </section>
  );
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
  confirmMatchups = false,
  viewerPlayerId = null,
  sittingPlayerIds = [],
}: ResultsEntryViewProps) {
  const viewerState = getViewerRoundState(matches, viewerPlayerId, sittingPlayerIds);
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
    if (m.status === "cancelled") return true;
    const s = getScores(m);
    if (!s.team1 || !s.team2) return false;
    const t1 = Number(s.team1);
    const t2 = Number(s.team2);
    return Number.isSafeInteger(t1) && Number.isSafeInteger(t2) && t1 !== t2 && t1 >= 0 && t2 >= 0;
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
    <div className="results-entry-view space-y-4 text-black">
      <div className="flex items-center justify-between gap-2 flex-nowrap">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-black truncate shrink-0">
            Round {roundNumber}
          </h1>
          {!canManage && (
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[1px_1px_0px_0px_#000] shrink-0">
              Live Games
            </span>
          )}
        </div>
        {canManage && (onAddGame || onReshuffleRound) && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0">
            {onAddGame && (
              <button
                type="button"
                onClick={onAddGame}
                disabled={isPending || isGeneratingRound}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#ccff00] border-2 border-black font-black uppercase text-[10px] sm:text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap shrink-0 touch-manipulation select-none"
              >
                <span>+ Add Game</span>
              </button>
            )}
            {onReshuffleRound && (
              <button
                type="button"
                onClick={onReshuffleRound}
                disabled={isPending || isGeneratingRound}
                data-testid="reshuffle-matchups-button"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white border-2 border-black font-black uppercase text-[10px] sm:text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap shrink-0 touch-manipulation select-none"
              >
                <ShuffleIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span>Reshuffle</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* The viewer's own assignment, pinned above the courts for players */}
      {!canManage && viewerState && <ViewerRoundCard key={`${roundNumber}-${viewerState.kind}`} state={viewerState} />}

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
                  <div key={c.courtNumber} className="p-2.5 rounded-xl bg-[#FFFDF7] border-2 border-black shadow-[1px_1px_0px_0px_#000] text-xs">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.map((match) => {
          const matchScores = getScores(match);
          const err = fieldErrors[match.id];
          const isCancelled = match.status === "cancelled";
          const isCompleted = match.status === "completed";
          const isMatchSaving = isPending || Boolean(savingMatchIds?.has(match.id));
          const isPickup = courtCount !== undefined && match.courtNumber > courtCount;

          const isSingles = match.team1Names.length === 1 && match.team2Names.length === 1;
          const isViewerTeam1 = Boolean(viewerPlayerId && match.team1PlayerIds?.includes(viewerPlayerId));
          const isViewerTeam2 = Boolean(viewerPlayerId && match.team2PlayerIds?.includes(viewerPlayerId));

          return (
            <div
              key={match.id}
              data-testid={`court-match-${match.courtNumber}`}
              className={`border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000] space-y-4 transition-all ${
                isCancelled
                  ? "bg-neutral-100 opacity-60 border-neutral-400"
                  : isCompleted
                  ? "bg-[#ecfdf5]"
                  : "bg-[#FFFDF7]"
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
                </div>
              </div>

              {/* Match Score Input Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Team 1 */}
                <div
                  data-viewer-team={isViewerTeam1 ? "true" : undefined}
                  className={`space-y-2 p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] ${isViewerTeam1 ? "bg-[#ccff00]" : "bg-[#FFFDF7]"}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-black text-black">
                    <span>{match.team1Names.join(" & ")}</span>
                    {isViewerTeam1 && (
                      <span className="rounded-md border-2 border-black bg-white px-1.5 py-0.5 text-[11px] font-black uppercase">You</span>
                    )}
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
                <div
                  data-viewer-team={isViewerTeam2 ? "true" : undefined}
                  className={`space-y-2 p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] ${isViewerTeam2 ? "bg-[#ccff00]" : "bg-[#FFFDF7]"}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-black text-black">
                    <span>{match.team2Names.join(" & ")}</span>
                    {isViewerTeam2 && (
                      <span className="rounded-md border-2 border-black bg-white px-1.5 py-0.5 text-[11px] font-black uppercase">You</span>
                    )}
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

              {/* Match Timestamps */}
              {isCompleted && (match.startedAt || match.completedAt) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-neutral-500 pt-1 border-t border-neutral-100">
                  {match.startedAt && (
                    <ClientTime
                      date={match.startedAt}
                      prefix={<span className="text-neutral-700 font-black">Started: </span>}
                    />
                  )}
                  {match.completedAt && (
                    <ClientTime
                      date={match.completedAt}
                      prefix={<span className="text-neutral-700 font-black">Finished: </span>}
                    />
                  )}
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
                      className="-ml-3 inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-black uppercase text-[#b91c1c] hover:bg-[#fee2e2] hover:text-[#7f1d1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
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
        <div className="mobile-action-bar sticky bottom-0 left-0 right-0 px-3 py-2.5 sm:px-4 sm:py-3 bg-[#FFFDF7]/95 backdrop-blur-md border-t-[3px] border-black z-40 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.06)]">
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
                  onClick={() => {
                    const startFn = onSaveAndStartNextRound ?? onNextRound;
                    startFn?.();
                  }}
                  data-testid="save-and-start-next-round-button"
                  title={
                    confirmMatchups
                      ? `Save all scores and review Round ${roundNumber + 1} matchups`
                      : `Save all scores and start Round ${roundNumber + 1}`
                  }
                  className="font-display text-xs sm:text-sm tracking-wide uppercase px-2.5 py-1.5 shrink-0 shadow-[2px_2px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] bg-[#ccff00] text-black"
                >
                  {isGeneratingRound ? (
                    <RoundGenerationIndicator />
                  ) : (
                    <>
                      <span className="sr-only">Next Round</span>
                      <span className="sm:hidden">
                        {confirmMatchups ? `Review R${roundNumber + 1}` : `Save & Start R${roundNumber + 1}`}
                      </span>
                      <span className="hidden sm:inline">
                        {confirmMatchups ? "Review Next Round" : "Save & Start Next Round"}
                      </span>
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
