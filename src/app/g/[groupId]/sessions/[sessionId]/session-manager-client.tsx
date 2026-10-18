"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

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
import { ResultsEntryView, type MatchScoreEntry, type ScoreDrafts } from "@/components/results/results-entry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { BackButton } from "@/components/groups/back-button";
import { formatDupr } from "@/lib/domain/rating-display";
import { XIcon } from "@/components/ui/icons";
import type {
  AttendanceRecord,
  MatchRecord,
  PlayerRecord,
  RoundProposal,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";
import { SessionNameEditor } from "@/components/sessions/session-name-editor";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import type { CourtSynergiesMap } from "@/components/rounds/synergy-reveal-modal";

export interface SessionManagerClientProps {
  readonly groupId: string;
  readonly groupName?: string;
  readonly session: SessionRecord;
  readonly players: readonly PlayerRecord[];
  readonly attendance?: readonly AttendanceRecord[];
  readonly startedRounds: readonly StartedRoundRecord[];
  readonly initialProposal: RoundProposal | null;
  readonly canManage?: boolean;
  readonly currentViewerPlayerId?: string | null;
  readonly partnerSynergy?: { readonly score: number; readonly matchesPlayed: number } | null;
  readonly courtSynergies?: CourtSynergiesMap;
  readonly isOrganizer?: boolean;
  readonly isHost?: boolean;
  readonly isFromProfile?: boolean;
}

export function SessionManagerClient({
  groupId,
  groupName,
  session,
  players,
  attendance = [],
  startedRounds,
  initialProposal,
  canManage = true,
  currentViewerPlayerId = null,
  partnerSynergy = null,
  courtSynergies,
  isOrganizer = false,
  isHost = false,
  isFromProfile = false,
}: SessionManagerClientProps) {
  const router = useRouter();

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [players],
  );

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
  const [scoreDrafts, setScoreDrafts] = useState<ScoreDrafts>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showInProgressModal, setShowInProgressModal] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingHistoricalMatchId, setEditingHistoricalMatchId] = useState<string | null>(null);
  const [historicalScores, setHistoricalScores] = useState<{ team1: string; team2: string }>({ team1: "", team2: "" });


  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        router.refresh();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  const playerNames: Record<string, string> = {};
  const playerAccounts: Record<string, string | null> = {};
  for (const p of players) {
    playerNames[p.id] = p.name;
    playerAccounts[p.id] = p.accountId ?? null;
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
    if (!latestStarted || hasUnsavedScores) return;
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

  const inProgressMatches = startedRounds
    .filter((sr) => sr.round.status === "started")
    .flatMap((sr) => sr.matches.filter((m) => m.status === "pending"));

  const getMatchTeams = (match: MatchRecord) => {
    const sr = startedRounds.find((r) => r.matches.some((m) => m.id === match.id));
    if (!sr) return { team1: "Team 1", team2: "Team 2" };
    const t1 = (sr.matchPlayers ?? [])
      .filter((mp) => mp.matchId === match.id && mp.team === 1)
      .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
    const t2 = (sr.matchPlayers ?? [])
      .filter((mp) => mp.matchId === match.id && mp.team === 2)
      .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
    return {
      team1: t1.length > 0 ? t1.join(" & ") : "Team 1",
      team2: t2.length > 0 ? t2.join(" & ") : "Team 2",
    };
  };

  const executeEndSession = async () => {
    if (hasUnsavedScores) return;
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
        router.replace(`/g/${groupId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to end session.");
    } finally {
      setIsPending(false);
    }
  };

  const handleEndSession = async () => {
    if (hasUnsavedScores) return;
    if (inProgressMatches.length > 0) {
      const skipWarning =
        typeof window !== "undefined" &&
        window.localStorage.getItem("pickleball_skip_end_session_in_progress_warning") === "true";

      if (!skipWarning) {
        setShowInProgressModal(true);
        return;
      }
    }

    if (!confirm("End this session? Match history and ratings will be finalized.")) {
      return;
    }
    await executeEndSession();
  };

  const handleConfirmEndSessionWithProgress = async () => {
    if (doNotAskAgain && typeof window !== "undefined") {
      try {
        window.localStorage.setItem("pickleball_skip_end_session_in_progress_warning", "true");
      } catch {
        // ignore storage errors
      }
    }
    setShowInProgressModal(false);
    await executeEndSession();
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
        const team1Players = (latestStarted.matchPlayers ?? [])
          .filter((mp) => mp.matchId === match.id && mp.team === 1)
          .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
        const team2Players = (latestStarted.matchPlayers ?? [])
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

  const hasUnsavedScores = Boolean(isRoundInProgress) && scoreEntries.some((match) => {
    const draft = scoreDrafts[match.id];
    if (!draft || match.status === "cancelled") return false;
    const team1 = draft.team1.trim() === "" ? null : Number(draft.team1);
    const team2 = draft.team2.trim() === "" ? null : Number(draft.team2);
    return team1 !== match.team1Score || team2 !== match.team2Score;
  });

  const handleScoreChange = (matchId: string, team: "team1" | "team2", value: string) => {
    const match = scoreEntries.find((entry) => entry.id === matchId);
    if (!match) return;
    setScoreDrafts((previous) => ({
      ...previous,
      [matchId]: {
        ...(previous[matchId] ?? {
          team1: match.team1Score !== null ? String(match.team1Score) : "",
          team2: match.team2Score !== null ? String(match.team2Score) : "",
        }),
        [team]: value,
      },
    }));
  };

  const isCompletedSession = session.status === "completed";
  const allSessionRounds = startedRounds;
  const totalSessionMatches = allSessionRounds.reduce((acc, r) => acc + r.matches.length, 0);

  // Calculate participating player statistics for the session
  const attendeePlayerIds = new Set<string>();
  for (const att of currentAttendance) {
    attendeePlayerIds.add(att.playerId);
  }
  for (const sr of allSessionRounds) {
    for (const mp of sr.matchPlayers ?? []) {
      attendeePlayerIds.add(mp.playerId);
    }
    for (const sit of sr.sits ?? []) {
      attendeePlayerIds.add(sit.playerId);
    }
  }

  const sessionPlayerStats = Array.from(attendeePlayerIds)
    .map((pId) => {
      const player = players.find((p) => p.id === pId);
      let gamesPlayed = 0;
      let wins = 0;
      let losses = 0;

      for (const sr of allSessionRounds) {
        for (const m of sr.matches) {
          if (m.status !== "completed" || m.team1Score === null || m.team2Score === null) continue;
          const mp = (sr.matchPlayers ?? []).find((entry) => entry.matchId === m.id && entry.playerId === pId);
          if (!mp) continue;
          gamesPlayed += 1;
          if (
            (mp.team === 1 && m.team1Score > m.team2Score) ||
            (mp.team === 2 && m.team2Score > m.team1Score)
          ) {
            wins += 1;
          } else if (
            (mp.team === 1 && m.team1Score < m.team2Score) ||
            (mp.team === 2 && m.team2Score < m.team1Score)
          ) {
            losses += 1;
          }
        }
      }

      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

      return {
        id: pId,
        name: player?.name ?? playerNames[pId] ?? pId,
        gamesPlayed,
        wins,
        losses,
        winRate,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.name.localeCompare(b.name));

  let durationFormatted: string | null = null;
  if (session.endedAt && session.startedAt) {
    const startMs = new Date(session.startedAt).getTime();
    const endMs = new Date(session.endedAt).getTime();
    const diffMinutes = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)));
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hours > 0) {
      durationFormatted = `${hours}h ${mins}m`;
    } else {
      durationFormatted = `${mins}m`;
    }
  }

  const pastRounds = startedRounds.filter((r) => r.round.status === "completed");
  const canEditSessionName = Boolean(canManage || isOrganizer || isHost);
  const formattedSessionDate = new Date(session.startedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6 text-black">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <BackButton
          href={isFromProfile ? "/players" : `/g/${groupId}`}
          label={isFromProfile ? "← Back to Profile" : "← Back to Group"}
          ariaLabel={isFromProfile ? "Go back to profile" : "Go back"}
          className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
        />
        {isCompletedSession ? (
          <Badge variant="muted" className="text-xs font-black uppercase">
            Completed Session
          </Badge>
        ) : (
          canManage && (
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
                disabled={isPending || hasUnsavedScores}
                aria-describedby={hasUnsavedScores ? "unsaved-score-warning" : undefined}
                data-testid="end-session-button"
                className="px-2.5 py-1 rounded-lg bg-[#ff6b6b] border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#ff5252] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
              >
                {isPending ? "Ending..." : "End Session"}
              </button>
            </div>
          )
        )}
      </div>

      {/* Active Session Header Card */}
      {!isCompletedSession && (
        <header className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-1">
          <SessionNameEditor
            groupId={groupId}
            sessionId={session.id}
            initialName={session.name || formattedSessionDate}
            canEdit={canEditSessionName}
            headingTag="h2"
            className="font-display text-2xl sm:text-3xl font-black uppercase text-black"
          />
          <p className="text-xs font-bold text-neutral-600">
            {groupName ?? "Group"} · Started {new Date(session.startedAt).toLocaleDateString()}
          </p>
        </header>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-[#ff6b6b] border-2 border-black shadow-[3px_3px_0px_0px_#000] text-black font-black text-sm">
          {error}
        </div>
      )}

      {/* Main Mode: Completed Session Full View OR Active Round Flow */}
      {isCompletedSession ? (
        <div className="space-y-6" data-testid="completed-session-full-view">
          {/* Completed Session Overview Card */}
          <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-5">
            <div>
              {groupName && (
                <span className="text-xs font-black uppercase tracking-wider text-neutral-500 block mb-1">
                  {groupName}
                </span>
              )}
              <SessionNameEditor
                groupId={groupId}
                sessionId={session.id}
                initialName={session.name || formattedSessionDate}
                canEdit={canEditSessionName}
                headingTag="h2"
                className="font-display text-2xl font-black uppercase text-black"
              />
              <p className="text-sm font-bold text-neutral-600 mt-1">
                {new Date(session.startedAt).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-neutral-50 border-2 border-black rounded-2xl shadow-[2px_2px_0px_0px_#000]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">Courts</span>
                <span className="font-display text-xl font-black text-black">{session.courtCount}</span>
              </div>
              <div className="p-3 bg-neutral-50 border-2 border-black rounded-2xl shadow-[2px_2px_0px_0px_#000]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">Rounds</span>
                <span className="font-display text-xl font-black text-black">{allSessionRounds.length}</span>
              </div>
              <div className="p-3 bg-neutral-50 border-2 border-black rounded-2xl shadow-[2px_2px_0px_0px_#000]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">Total Games</span>
                <span className="font-display text-xl font-black text-black">{totalSessionMatches}</span>
              </div>
              <div className="p-3 bg-neutral-50 border-2 border-black rounded-2xl shadow-[2px_2px_0px_0px_#000]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">Players</span>
                <span className="font-display text-xl font-black text-black">{sessionPlayerStats.length}</span>
              </div>
            </div>

            {/* Time / Duration info */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-neutral-600 pt-1 border-t-2 border-neutral-100">
              <span>
                <strong className="text-black">Started:</strong>{" "}
                {new Date(session.startedAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {session.endedAt && (
                <span>
                  <strong className="text-black">Ended:</strong>{" "}
                  {new Date(session.endedAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
              {durationFormatted && (
                <span>
                  <strong className="text-black">Duration:</strong> {durationFormatted}
                </span>
              )}
            </div>
          </section>

          {/* Session Player Leaderboard / Roster */}
          {sessionPlayerStats.length > 0 && (
            <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
              <h3 className="font-display text-xl font-black uppercase tracking-wider text-black">
                Player Summary
              </h3>
              <div className="divide-y-2 divide-neutral-100">
                {sessionPlayerStats.map((stat) => (
                  <div key={stat.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-black text-black text-sm block">{stat.name}</span>
                      <span className="text-xs font-bold text-neutral-500">
                        {stat.gamesPlayed} game{stat.gamesPlayed !== 1 ? "s" : ""} played
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg border-2 border-black bg-neutral-50 shadow-[1px_1px_0px_0px_#000]">
                        {stat.wins}W – {stat.losses}L
                      </span>
                      {stat.gamesPlayed > 0 && (
                        <span className="text-xs font-bold text-neutral-600">
                          ({stat.winRate}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Categorized Rounds & Games */}
          <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-5">
            <h3 className="font-display text-xl font-black uppercase tracking-wider text-black">
              All Rounds & Matchups
            </h3>
            {allSessionRounds.length === 0 ? (
              <p className="text-sm font-bold text-neutral-600">No rounds played in this session.</p>
            ) : (
              <div className="space-y-4">
                {allSessionRounds.map((sr) => (
                  <div key={sr.round.id} className="border-2 border-black rounded-2xl p-4 bg-neutral-50 shadow-[3px_3px_0px_0px_#000] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-base font-black text-black">
                        Round {sr.round.roundNumber}
                      </span>
                      <Badge variant={sr.round.status === "completed" ? "muted" : "warning"}>
                        {sr.round.status === "completed" ? "Completed" : "In Progress"}
                      </Badge>
                    </div>

                    {(sr.sits ?? []).length > 0 && (
                      <p className="text-xs font-bold text-neutral-600">
                        Sitting out: {(sr.sits ?? []).map((s) => playerNames[s.playerId] ?? s.playerId).join(", ")}
                      </p>
                    )}

                    <div className="space-y-2">
                      {sr.matches.map((m) => {
                        const t1 = (sr.matchPlayers ?? [])
                          .filter((mp) => mp.matchId === m.id && mp.team === 1)
                          .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
                        const t2 = (sr.matchPlayers ?? [])
                          .filter((mp) => mp.matchId === m.id && mp.team === 2)
                          .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
                        const isEditing = editingHistoricalMatchId === m.id;
                        const isT1Winner =
                          m.team1Score !== null &&
                          m.team2Score !== null &&
                          m.team1Score > m.team2Score;
                        const isT2Winner =
                          m.team1Score !== null &&
                          m.team2Score !== null &&
                          m.team2Score > m.team1Score;

                        return (
                          <div
                            key={m.id}
                            className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] text-xs space-y-2"
                            data-testid={`completed-match-${m.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-black">Court {m.courtNumber}</span>
                              <span className="font-display text-sm font-black text-black">
                                {m.status === "cancelled"
                                  ? "Cancelled"
                                  : m.status === "completed"
                                  ? `${m.team1Score ?? 0} – ${m.team2Score ?? 0}`
                                  : "In Play"}
                              </span>
                            </div>

                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between">
                                <span className={`font-bold ${isT1Winner ? "font-black text-black" : "text-neutral-800"}`}>
                                  {t1.join(" & ") || "Team 1"}
                                </span>
                                <span
                                  className={`font-mono text-xs px-2 py-0.5 rounded border-2 border-black font-black ${
                                    isT1Winner ? "bg-[#ccff00] text-black shadow-[1px_1px_0px_0px_#000]" : "bg-neutral-100 text-neutral-800"
                                  }`}
                                >
                                  {m.team1Score ?? 0}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`font-bold ${isT2Winner ? "font-black text-black" : "text-neutral-800"}`}>
                                  {t2.join(" & ") || "Team 2"}
                                </span>
                                <span
                                  className={`font-mono text-xs px-2 py-0.5 rounded border-2 border-black font-black ${
                                    isT2Winner ? "bg-[#ccff00] text-black shadow-[1px_1px_0px_0px_#000]" : "bg-neutral-100 text-neutral-800"
                                  }`}
                                >
                                  {m.team2Score ?? 0}
                                </span>
                              </div>
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
                            ) : canManage ? (
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
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          {/* Main Mode: Round In Progress (Score Entry) OR Proposed Round */}
          {isRoundInProgress ? (
            <div className="space-y-4">
              <ResultsEntryView
                roundId={latestStarted.round.id}
                roundNumber={latestStarted.round.roundNumber}
                matches={scoreEntries}
                fieldErrors={fieldErrors}
                isPending={isPending}
                onSubmitResult={canManage ? handleSaveResult : undefined}
                onCancelMatch={canManage ? handleCancelMatch : undefined}
                onNextRound={canManage ? handleNextRound : undefined}
                canManage={canManage}
                scoreDrafts={scoreDrafts}
                onScoreChange={handleScoreChange}
                hasUnsavedScores={hasUnsavedScores}
              />
              {canManage && (
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
              )}
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
              playerAccounts={playerAccounts}
              isPending={isPending}
              currentViewerPlayerId={currentViewerPlayerId}
              partnerSynergy={partnerSynergy}
              courtSynergies={courtSynergies}
              isOrganizer={isOrganizer}
              onRegenerate={canManage ? handleRegenerate : undefined}
              onStartRound={canManage ? handleStartRound : undefined}
              canManage={canManage}
            />
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] space-y-4">
              <p className="font-display text-xl font-black uppercase text-black">
                {canManage ? "Ready for the next round?" : "Waiting for Next Round"}
              </p>
              {canManage ? (
                <Button type="button" variant="primary" onClick={handleRegenerate} disabled={isPending} className="font-display text-lg uppercase tracking-wider">
                  Generate Round {(latestStarted?.round.roundNumber ?? 0) + 1}
                </Button>
              ) : (
                <p className="text-sm font-bold text-neutral-600">
                  The organizer has not started the next round yet.
                </p>
              )}
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
                        const t1 = (past.matchPlayers ?? [])
                          .filter((mp) => mp.matchId === m.id && mp.team === 1)
                          .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
                        const t2 = (past.matchPlayers ?? [])
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
                            ) : canManage ? (
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
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Attendance Modal */}
      {canManage && showAttendanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] max-h-[85vh] overflow-y-auto text-black">
            <div className="flex items-center justify-between pb-2 border-b-2 border-neutral-100">
              <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black">Session Attendance</h3>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="inline-flex items-center gap-1 text-neutral-600 hover:text-black hover:bg-neutral-100 active:bg-neutral-200 font-black text-sm px-2.5 py-1 -mr-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <XIcon className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>
            <p className="text-xs font-bold text-neutral-600">
              Manage player arrivals or early departures mid-session.
            </p>
            <div className="space-y-2">
              {sortedPlayers.map((p) => {
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
                      <span className="text-xs font-bold text-neutral-500">Rating: {formatDupr(p.rating)}</span>
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

      {showInProgressModal && (
        <Modal
          isOpen={showInProgressModal}
          onClose={() => !isPending && setShowInProgressModal(false)}
          size="md"
          role="alertdialog"
          showCloseButton={false}
          closeOnBackdropClick={!isPending}
          closeOnEscape={!isPending}
        >
          <div className="space-y-4 text-black" data-testid="in-progress-warning-modal">
            <h3 className="font-display text-xl font-black uppercase tracking-tight text-black">
              End Session?
            </h3>
            <p className="text-sm font-bold text-neutral-800">
              You have these games in progress:
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1" data-testid="in-progress-match-list">
              {inProgressMatches.map((match) => {
                const { team1, team2 } = getMatchTeams(match);
                return (
                  <div
                    key={match.id}
                    className="p-3 bg-neutral-50 border-2 border-black rounded-xl text-xs flex items-center justify-between shadow-[2px_2px_0px_0px_#000]"
                  >
                    <div>
                      <span className="font-black text-black block">Court {match.courtNumber}</span>
                      <span className="font-bold text-neutral-700">{team1} vs {team2}</span>
                    </div>
                    <Badge variant="warning">In Play</Badge>
                  </div>
                );
              })}
            </div>
            <p className="text-sm font-bold text-neutral-800">
              Are you sure you want to end it?
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={doNotAskAgain}
                onChange={(e) => setDoNotAskAgain(e.target.checked)}
                data-testid="do-not-ask-again-checkbox"
                className="w-4 h-4 rounded border-2 border-black accent-black cursor-pointer"
              />
              <span className="text-xs font-bold text-neutral-700">
                Do not ask me again
              </span>
            </label>
            <div className="flex gap-3 justify-end pt-3 border-t-2 border-neutral-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInProgressModal(false)}
                disabled={isPending}
                data-testid="cancel-end-session-button"
                className="font-display uppercase tracking-wider text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmEndSessionWithProgress}
                disabled={isPending}
                data-testid="confirm-end-session-button"
                className="font-display uppercase tracking-wider text-xs bg-[#ff6b6b] hover:bg-[#ff5252] text-black"
              >
                {isPending ? "Ending..." : "End Session"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
