"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  changeAttendanceAction,
  completeRoundAction,
  endSessionAction,
  proposeRoundAction,
  startRoundAction,
  undoLatestRoundAction,
} from "@/app/actions/sessions";
import { cancelMatchAction, recordResultAction } from "@/app/actions/results";
import { CurrentRoundView } from "@/components/rounds/current-round";
import { ResultsEntryView, type MatchScoreEntry } from "@/components/results/results-entry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  AttendanceRecord,
  PlayerRecord,
  RoundProposal,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import type { CourtSynergiesMap } from "@/components/rounds/synergy-reveal-modal";

export interface SessionManagerClientProps {
  readonly groupId: string;
  readonly session: SessionRecord;
  readonly players: readonly PlayerRecord[];
  readonly attendance?: readonly AttendanceRecord[];
  readonly startedRounds: readonly StartedRoundRecord[];
  readonly initialProposal: RoundProposal | null;
  readonly currentViewerPlayerId?: string | null;
  readonly partnerSynergy?: { readonly score: number; readonly matchesPlayed: number } | null;
  readonly courtSynergies?: CourtSynergiesMap;
  readonly isOrganizer?: boolean;
}

export function SessionManagerClient({
  groupId,
  session,
  players,
  attendance = [],
  startedRounds,
  initialProposal,
  currentViewerPlayerId = null,
  partnerSynergy = null,
  courtSynergies,
  isOrganizer = false,
}: SessionManagerClientProps) {
  const router = useRouter();
  const [regeneratedProposal, setRegeneratedProposal] = useState<RoundProposal | null>(null);
  const activeProposal = regeneratedProposal ?? initialProposal;
  const [prevAttendance, setPrevAttendance] = useState(attendance);
  const [currentAttendance, setCurrentAttendance] = useState(attendance);
  if (attendance !== prevAttendance) {
    setPrevAttendance(attendance);
    setCurrentAttendance(attendance);
  }
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingHistoricalMatchId, setEditingHistoricalMatchId] = useState<string | null>(null);
  const [historicalScores, setHistoricalScores] = useState<{ team1: string; team2: string }>({ team1: "", team2: "" });

  const playerNames: Record<string, string> = {};
  for (const p of players) {
    playerNames[p.id] = p.name;
  }

  const latestStarted = startedRounds.at(-1);
  const isRoundInProgress = latestStarted && latestStarted.round.status === "started";

  // Actions
  const handleRegenerate = async () => {
    setIsPending(true);
    setError(null);
    try {
      const nextSeed = Math.floor(Math.random() * 0xffff_ffff);
      const res = await proposeRoundAction({
        groupId,
        sessionId: session.id,
        sessionVersion: session.version,
        seed: nextSeed,
      });
      if (res.ok) {
        setRegeneratedProposal(res.data);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to regenerate round.");
    } finally {
      setIsPending(false);
    }
  };

  const handleStartRound = async (customProposal?: {
    courts: readonly { courtNumber: number; team1: readonly string[]; team2: readonly string[] }[];
    sitting: readonly string[];
  }) => {
    if (!activeProposal) return;
    setIsPending(true);
    setError(null);
    try {
      const res = await startRoundAction({
        groupId,
        sessionId: session.id,
        sessionVersion: session.version,
        seed: activeProposal.seed,
        idempotencyKey: createIdempotencyKey("start_rd"),
        manualCourts: customProposal?.courts.map((c) => ({
          courtNumber: c.courtNumber,
          team1: [...c.team1],
          team2: [...c.team2],
        })),
        manualSitting: customProposal ? [...customProposal.sitting] : undefined,
      });
      if (res.ok) {
        setRegeneratedProposal(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to start round.");
    } finally {
      setIsPending(false);
    }
  };

  const handleSaveResult = async (matchId: string, team1Score: number, team2Score: number) => {
    if (!latestStarted) return;
    const match = latestStarted.matches.find((m) => m.id === matchId);
    if (!match) return;

    setIsPending(true);
    setError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });

    try {
      const res = await recordResultAction({
        groupId,
        matchId,
        team1Score,
        team2Score,
        matchVersion: match.version,
        idempotencyKey: createIdempotencyKey(`res_${matchId}`),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setFieldErrors((prev) => ({
          ...prev,
          [matchId]: res.error,
        }));
      }
    } catch {
      setFieldErrors((prev) => ({
        ...prev,
        [matchId]: "Failed to save match result.",
      }));
    } finally {
      setIsPending(false);
    }
  };

  const handleCancelMatch = async (matchId: string) => {
    if (!latestStarted) return;
    const match = latestStarted.matches.find((m) => m.id === matchId);
    if (!match) return;

    setIsPending(true);
    try {
      const res = await cancelMatchAction({
        groupId,
        matchId,
        matchVersion: match.version,
        idempotencyKey: createIdempotencyKey(`cancel_${matchId}`),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to cancel match.");
    } finally {
      setIsPending(false);
    }
  };

  const handleNextRound = async () => {
    if (!latestStarted) return;
    setIsPending(true);
    setError(null);
    try {
      const res = await completeRoundAction({
        groupId,
        sessionId: session.id,
        sessionVersion: session.version,
        roundId: latestStarted.round.id,
        roundVersion: latestStarted.round.version,
        idempotencyKey: createIdempotencyKey("next_rd"),
      });
      if (res.ok) {
        setRegeneratedProposal(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to advance to next round.");
    } finally {
      setIsPending(false);
    }
  };

  const handleUndo = async () => {
    if (!latestStarted) return;
    if (!confirm("Are you sure you want to undo the latest round? This will revert results and ratings.")) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await undoLatestRoundAction({
        groupId,
        sessionId: session.id,
        sessionVersion: session.version,
        roundId: latestStarted.round.id,
        roundVersion: latestStarted.round.version,
        idempotencyKey: createIdempotencyKey("undo"),
      });
      if (res.ok) {
        setRegeneratedProposal(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to undo round.");
    } finally {
      setIsPending(false);
    }
  };

  const handleEndSession = async () => {
    if (!confirm("End this session? Match history and ratings will be finalized.")) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await endSessionAction({
        groupId,
        sessionId: session.id,
        sessionVersion: session.version,
        idempotencyKey: createIdempotencyKey("end"),
      });
      if (res.ok) {
        router.push(`/g/${groupId}`);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to end session.");
    } finally {
      setIsPending(false);
    }
  };

  const handleToggleAttendance = async (playerId: string, currentlyPresent: boolean) => {
    setIsPending(true);
    setError(null);
    try {
      const res = await changeAttendanceAction({
        groupId,
        sessionId: session.id,
        playerId,
        present: !currentlyPresent,
        sessionVersion: session.version,
        idempotencyKey: createIdempotencyKey(`att_${playerId}`),
      });
      if (res.ok) {
        setCurrentAttendance((prev) => {
          const exists = prev.find((a) => a.playerId === playerId);
          if (!exists) {
            return [
              ...prev,
              {
                sessionId: session.id,
                playerId,
                joinedRound: session.currentRoundNumber + 1,
                leftRound: !currentlyPresent ? null : session.currentRoundNumber + 1,
              },
            ];
          }
          return prev.map((a) =>
            a.playerId === playerId
              ? {
                  ...a,
                  leftRound: !currentlyPresent ? null : session.currentRoundNumber + 1,
                }
              : a,
          );
        });
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to update attendance.");
    } finally {
      setIsPending(false);
    }
  };

  const handleHistoricalSaveResult = async (matchId: string, matchVersion: number) => {
    const t1 = parseInt(historicalScores.team1, 10);
    const t2 = parseInt(historicalScores.team2, 10);
    if (isNaN(t1) || isNaN(t2)) return;

    setIsPending(true);
    setError(null);
    try {
      const res = await recordResultAction({
        groupId,
        matchId,
        team1Score: t1,
        team2Score: t2,
        matchVersion,
        idempotencyKey: createIdempotencyKey(`hist_${matchId}`),
      });
      if (res.ok) {
        setEditingHistoricalMatchId(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to update historical score.");
    } finally {
      setIsPending(false);
    }
  };

  const handleHistoricalCancelMatch = async (matchId: string, matchVersion: number) => {
    setIsPending(true);
    setError(null);
    try {
      const res = await cancelMatchAction({
        groupId,
        matchId,
        matchVersion,
        idempotencyKey: createIdempotencyKey(`hist_cancel_${matchId}`),
      });
      if (res.ok) {
        setEditingHistoricalMatchId(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to cancel historical match.");
    } finally {
      setIsPending(false);
    }
  };

  // Convert started round matches to MatchScoreEntry
  const scoreEntries: MatchScoreEntry[] = latestStarted
    ? latestStarted.matches.map((match) => {
        const team1Players = latestStarted.matchPlayers
          .filter((mp) => mp.matchId === match.id && mp.team === 1)
          .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
        const team2Players = latestStarted.matchPlayers
          .filter((mp) => mp.matchId === match.id && mp.team === 2)
          .map((mp) => playerNames[mp.playerId] ?? mp.playerId);

        return {
          id: match.id,
          courtNumber: match.courtNumber,
          team1Names: team1Players.length > 0 ? team1Players : ["Player 1"],
          team2Names: team2Players.length > 0 ? team2Players : ["Player 2"],
          team1Score: match.team1Score,
          team2Score: match.team2Score,
          status: match.status,
          version: match.version,
        };
      })
    : [];

  const pastRounds = startedRounds.filter((r) => r.round.status === "completed");

  return (
    <div className="space-y-6 text-black">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <Link
          href={`/g/${groupId}`}
          className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform"
        >
          ← Group Dashboard
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowAttendanceModal(true)}
            className="px-2.5 py-1 rounded-lg bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            Attendance
          </button>
          <button
            type="button"
            onClick={handleEndSession}
            disabled={isPending}
            className="px-2.5 py-1 rounded-lg bg-[#ff6b6b] border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#ff5252] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            End Session
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-[#ff6b6b] border-2 border-black shadow-[3px_3px_0px_0px_#000] text-black font-black text-sm">
          {error}
        </div>
      )}

      {/* Main Mode: Round In Progress (Score Entry) OR Proposed Round */}
      {isRoundInProgress ? (
        <div className="space-y-4">
          <ResultsEntryView
            roundId={latestStarted.round.id}
            roundNumber={latestStarted.round.roundNumber}
            matches={scoreEntries}
            fieldErrors={fieldErrors}
            isPending={isPending}
            onSubmitResult={handleSaveResult}
            onCancelMatch={handleCancelMatch}
            onNextRound={handleNextRound}
          />
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={isPending}
              className="text-xs font-black uppercase text-[#ff6b6b] hover:text-black underline cursor-pointer"
            >
              Undo Round {latestStarted.round.roundNumber}
            </button>
          </div>
        </div>
      ) : activeProposal ? (
        <CurrentRoundView
          round={{
            id: `proposal_${activeProposal.seed}`,
            roundNumber: (latestStarted?.round.roundNumber ?? 0) + 1,
            status: "proposed",
            seed: activeProposal.seed,
          }}
          courts={activeProposal.courts.map((c) => ({
            courtNumber: c.courtNumber,
            team1: c.team1,
            team2: c.team2,
          }))}
          sittingPlayerIds={activeProposal.sitting}
          playerNames={playerNames}
          canRegenerate={true}
          isPending={isPending}
          currentViewerPlayerId={currentViewerPlayerId}
          partnerSynergy={partnerSynergy}
          courtSynergies={courtSynergies}
          isOrganizer={isOrganizer}
          onRegenerate={handleRegenerate}
          onStartRound={handleStartRound}
        />
      ) : (
        <div className="text-center p-8 bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] space-y-4">
          <p className="font-display text-xl font-black uppercase text-black">Ready for the next round?</p>
          <Button type="button" variant="primary" onClick={handleRegenerate} disabled={isPending} className="font-display text-lg uppercase tracking-wider">
            Generate Round {(latestStarted?.round.roundNumber ?? 0) + 1}
          </Button>
        </div>
      )}

      {/* Past Rounds Accordion / List */}
      {pastRounds.length > 0 && (
        <section className="bg-white border-[3px] border-black rounded-2xl p-5 space-y-4 shadow-[6px_6px_0px_0px_#000]">
          <h3 className="font-display text-xl font-black uppercase tracking-wider text-black">
            Past Rounds History
          </h3>
          <div className="space-y-4">
            {pastRounds.map((past) => (
              <div key={past.round.id} className="border-2 border-black rounded-xl p-4 bg-neutral-50 shadow-[3px_3px_0px_0px_#000] space-y-2">
                <div className="flex items-center justify-between text-xs font-black uppercase">
                  <span className="font-display text-base text-black">Round {past.round.roundNumber}</span>
                  <Badge variant="muted">Completed</Badge>
                </div>
                <div className="space-y-2 pt-1">
                  {past.matches.map((m) => {
                    const t1 = past.matchPlayers
                      .filter((mp) => mp.matchId === m.id && mp.team === 1)
                      .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
                    const t2 = past.matchPlayers
                      .filter((mp) => mp.matchId === m.id && mp.team === 2)
                      .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
                    const isEditing = editingHistoricalMatchId === m.id;

                    return (
                      <div key={m.id} className="p-3 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-black">Court {m.courtNumber}</span>
                          <span className="font-display text-sm font-black text-black">
                            {m.status === "cancelled" ? "Cancelled" : `${m.team1Score ?? 0} – ${m.team2Score ?? 0}`}
                          </span>
                        </div>
                        <div className="font-bold text-neutral-800">
                          {t1.join(" & ")} vs {t2.join(" & ")}
                        </div>

                        {isEditing ? (
                          <div className="pt-2 border-t-2 border-neutral-100 flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={historicalScores.team1}
                              onChange={(e) => setHistoricalScores((prev) => ({ ...prev, team1: e.target.value }))}
                              placeholder="T1"
                              className="w-16 bg-white border-2 border-black rounded-lg px-2 py-1 text-black font-black text-center shadow-[1px_1px_0px_0px_#000]"
                            />
                            <span className="font-black text-black">–</span>
                            <input
                              type="number"
                              min={0}
                              value={historicalScores.team2}
                              onChange={(e) => setHistoricalScores((prev) => ({ ...prev, team2: e.target.value }))}
                              placeholder="T2"
                              className="w-16 bg-white border-2 border-black rounded-lg px-2 py-1 text-black font-black text-center shadow-[1px_1px_0px_0px_#000]"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              onClick={() => handleHistoricalSaveResult(m.id, m.version)}
                              disabled={isPending}
                              className="font-display text-xs uppercase"
                            >
                              Save Score
                            </Button>
                            {m.status !== "cancelled" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleHistoricalCancelMatch(m.id, m.version)}
                                disabled={isPending}
                                className="font-display text-xs uppercase"
                              >
                                Cancel Match
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingHistoricalMatchId(null)}
                              className="text-xs font-black uppercase text-neutral-500 hover:text-black underline ml-auto cursor-pointer"
                            >
                              Close
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingHistoricalMatchId(m.id);
                                setHistoricalScores({
                                   team1: m.team1Score !== null ? String(m.team1Score) : "",
                                  team2: m.team2Score !== null ? String(m.team2Score) : "",
                                });
                              }}
                              className="text-xs font-black uppercase text-black hover:underline cursor-pointer"
                            >
                              Edit Result
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] max-h-[85vh] overflow-y-auto text-black">
            <div className="flex items-center justify-between pb-2 border-b-2 border-neutral-100">
              <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black">Session Attendance</h3>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="text-neutral-600 hover:text-black hover:bg-neutral-100 active:bg-neutral-200 font-black text-sm px-2.5 py-1 -mr-1.5 rounded-xl transition-colors cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-xs font-bold text-neutral-600">
              Manage player arrivals or early departures mid-session.
            </p>
            <div className="space-y-2">
              {players.map((p) => {
                const rec = currentAttendance.find((a) => a.playerId === p.id);
                const isPresent = rec ? rec.leftRound === null : false;
                return (
                  <div
                    key={p.id}
                    data-testid={`attendance-row-${p.name}`}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000]"
                  >
                    <div>
                      <span className="font-black text-black text-sm block">{p.name}</span>
                      <span className="text-xs font-bold text-neutral-500">Rating: {Math.round(p.rating)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isPresent ? "success" : "muted"}>
                        {isPresent ? "Present" : "Away"}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant={isPresent ? "outline" : "primary"}
                        onClick={() => handleToggleAttendance(p.id, isPresent)}
                        disabled={isPending}
                        className="font-display text-xs uppercase"
                      >
                        {isPresent ? "Mark Left" : "Mark Present"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
