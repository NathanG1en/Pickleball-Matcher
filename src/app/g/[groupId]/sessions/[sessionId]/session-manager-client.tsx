"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
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
import type {
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
  readonly startedRounds: readonly StartedRoundRecord[];
  readonly initialProposal: RoundProposal | null;
  readonly shareId: string;
}

export function SessionManagerClient({
  groupId,
  session,
  players,
  startedRounds,
  initialProposal,
  shareId,
}: SessionManagerClientProps) {
  const router = useRouter();
  const [proposal, setProposal] = useState<RoundProposal | null>(initialProposal);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
        setProposal(res.data);
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
    if (!proposal) return;
    setIsPending(true);
    setError(null);
    try {
      const res = await startRoundAction({
        groupId,
        sessionId: session.id,
        sessionVersion: session.version,
        seed: proposal.seed,
        idempotencyKey: createIdempotencyKey("start_rd"),
      });
      if (res.ok) {
        setProposal(null);
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
      ) : proposal ? (
        <CurrentRoundView
          round={{
            id: `proposal_${proposal.seed}`,
            roundNumber: (latestStarted?.round.roundNumber ?? 0) + 1,
            status: "proposed",
            seed: proposal.seed,
          }}
          courts={proposal.courts.map((c) => ({
            courtNumber: c.courtNumber,
            team1: [c.team1[0], c.team1[1]],
            team2: [c.team2[0], c.team2[1]],
          }))}
          sittingPlayerIds={proposal.sitting}
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
    </div>
  );
}
