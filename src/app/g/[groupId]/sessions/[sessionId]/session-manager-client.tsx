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

export interface SessionManagerClientProps {
  readonly groupId: string;
  readonly session: SessionRecord;
  readonly players: readonly PlayerRecord[];
  readonly attendance?: readonly AttendanceRecord[];
  readonly startedRounds: readonly StartedRoundRecord[];
  readonly initialProposal: RoundProposal | null;
  readonly shareId: string;
}

export function SessionManagerClient({
  groupId,
  session,
  players,
  attendance = [],
  startedRounds,
  initialProposal,
  shareId,
}: SessionManagerClientProps) {
  const router = useRouter();
  const [regeneratedProposal, setRegeneratedProposal] = useState<RoundProposal | null>(null);
  const activeProposal = regeneratedProposal ?? initialProposal;
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

  const handleStartRound = async () => {
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
      });
      if (res.ok) {
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
          team1Names: [team1Players[0] ?? "Player 1", team1Players[1] ?? "Player 2"],
          team2Names: [team2Players[0] ?? "Player 3", team2Players[1] ?? "Player 4"],
          team1Score: match.team1Score,
          team2Score: match.team2Score,
          status: match.status,
          version: match.version,
        };
      })
    : [];

  const pastRounds = startedRounds.filter((r) => r.round.status === "completed");

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <Link
          href={`/g/${groupId}`}
          className="text-xs font-semibold text-slate-400 hover:text-white"
        >
          ← Group Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAttendanceModal(true)}
            className="text-xs font-semibold text-slate-300 hover:text-white"
          >
            Attendance
          </button>
          <span className="text-slate-600">|</span>
          <Link
            href={`/s/${shareId}`}
            target="_blank"
            className="text-xs font-semibold text-emerald-400 hover:underline"
          >
            Live Spectator Link ↗
          </Link>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={handleEndSession}
            disabled={isPending}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300"
          >
            End Session
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
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
              className="text-xs text-slate-400 hover:text-rose-400 underline"
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
            team1: [c.team1[0], c.team1[1]],
            team2: [c.team2[0], c.team2[1]],
          }))}
          sittingPlayerIds={activeProposal.sitting}
          playerNames={playerNames}
          canRegenerate={true}
          isPending={isPending}
          onRegenerate={handleRegenerate}
          onStartRound={handleStartRound}
        />
      ) : (
        <div className="text-center p-8 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
          <p className="text-slate-300 font-medium">Ready for the next round?</p>
          <Button type="button" variant="primary" onClick={handleRegenerate} disabled={isPending}>
            Generate Round {(latestStarted?.round.roundNumber ?? 0) + 1}
          </Button>
        </div>
      )}

      {/* Past Rounds Accordion / List */}
      {pastRounds.length > 0 && (
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Past Rounds History
          </h3>
          <div className="space-y-4">
            {pastRounds.map((past) => (
              <div key={past.round.id} className="border border-slate-800 rounded-xl p-3 bg-slate-900/90 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                  <span>Round {past.round.roundNumber}</span>
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
                      <div key={m.id} className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-400">Court {m.courtNumber}</span>
                          <span className="text-slate-300 font-bold">
                            {m.status === "cancelled" ? "Cancelled" : `${m.team1Score ?? 0} – ${m.team2Score ?? 0}`}
                          </span>
                        </div>
                        <div className="text-slate-300">
                          {t1.join(" & ")} vs {t2.join(" & ")}
                        </div>

                        {isEditing ? (
                          <div className="pt-2 border-t border-slate-700 flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={historicalScores.team1}
                              onChange={(e) => setHistoricalScores((prev) => ({ ...prev, team1: e.target.value }))}
                              placeholder="T1"
                              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold"
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="number"
                              min={0}
                              value={historicalScores.team2}
                              onChange={(e) => setHistoricalScores((prev) => ({ ...prev, team2: e.target.value }))}
                              placeholder="T2"
                              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              onClick={() => handleHistoricalSaveResult(m.id, m.version)}
                              disabled={isPending}
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
                              >
                                Cancel Match
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingHistoricalMatchId(null)}
                              className="text-xs text-slate-400 underline ml-auto"
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
                              className="text-xs text-slate-400 hover:text-emerald-400 underline"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Session Attendance</h3>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Manage player arrivals or early departures mid-session.
            </p>
            <div className="space-y-2">
              {players.map((p) => {
                const rec = attendance.find((a) => a.playerId === p.id);
                const isPresent = rec ? rec.leftRound === null : false;
                return (
                  <div
                    key={p.id}
                    data-testid={`attendance-row-${p.name}`}
                    className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700"
                  >
                    <div>
                      <span className="font-semibold text-white text-sm block">{p.name}</span>
                      <span className="text-xs text-slate-400">Rating: {Math.round(p.rating)}</span>
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
