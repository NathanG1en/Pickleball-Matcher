"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  changeAttendanceAction,
  completeRoundAction,
  endSessionAction,
  proposeRoundAction,
  reshuffleRoundAction,
  startRoundAction,
  undoLatestRoundAction,
  updateCourtConfigAction,
} from "@/app/actions/sessions";
import { cancelMatchAction, recordResultAction } from "@/app/actions/results";
import { isPickleScore } from "@/components/results/pickle-celebration";
import { RoundGenerationIndicator } from "@/components/rounds/round-generation-indicator";
import { CurrentRoundView } from "@/components/rounds/current-round";
import { ResultsEntryView, type MatchScoreEntry, type ScoreDrafts } from "@/components/results/results-entry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ClientDate, ClientTime } from "@/components/ui/client-date-time";
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
import { markSessionEnded } from "@/lib/animations/session-signoff";
import { SessionNameEditor } from "@/components/sessions/session-name-editor";
import { SessionOptionsMenu } from "@/components/sessions/session-options-menu";
import { SessionHighlights } from "@/components/sessions/session-highlights";
import { clearLineupDraft, lineupDraftKey } from "@/lib/rounds/lineup-draft";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import type { PairSynergiesMap } from "@/lib/synergy/lineup";
import { formatSessionDate } from "@/lib/utils/date";

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
  readonly pairSynergies?: PairSynergiesMap;
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
  pairSynergies = {},
  isOrganizer = false,
  isHost = false,
  isFromProfile = false,
}: SessionManagerClientProps) {
  const router = useRouter();

  const sortedPlayers = useMemo(
    () =>
      players
        .filter((p) => p.active)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        ),
    [players],
  );

  const [prevSession, setPrevSession] = useState(session);
  const [currentSession, setCurrentSession] = useState(session);
  const [sessionName, setSessionName] = useState(session.name ?? null);
  if (session !== prevSession) {
    setPrevSession(session);
    setCurrentSession(session);
    setSessionName(session.name ?? null);
  }

  const formattedDate = formatSessionDate(session.startedAt);
  const initialSessionName = sessionName || formattedDate;

  const [prevInitialProposal, setPrevInitialProposal] = useState(initialProposal);
  const [regeneratedProposal, setRegeneratedProposal] = useState<RoundProposal | null>(null);
  if (initialProposal !== prevInitialProposal) {
    setPrevInitialProposal(initialProposal);
    setRegeneratedProposal(null);
  }

  const activeProposal = regeneratedProposal ?? initialProposal;
  const [savingMatchIds, setSavingMatchIds] = useState<Set<string>>(() => new Set());
  const [prevAttendance, setPrevAttendance] = useState(attendance);
  const [currentAttendance, setCurrentAttendance] = useState(attendance);
  if (attendance !== prevAttendance) {
    setPrevAttendance(attendance);
    setCurrentAttendance(attendance);
  }

  const [prevStartedRounds, setPrevStartedRounds] = useState(startedRounds);
  const [localStartedRounds, setLocalStartedRounds] = useState<readonly StartedRoundRecord[]>(startedRounds);
  if (startedRounds !== prevStartedRounds) {
    setPrevStartedRounds(startedRounds);
    setLocalStartedRounds(
      startedRounds.map((sr) => {
        const localSr = localStartedRounds.find((l) => l.round.id === sr.round.id);
        if (!localSr) return sr;
        return {
          ...sr,
          matches: sr.matches.map((serverMatch) => {
            if (serverMatch.status !== "pending") return serverMatch;
            const localMatch = localSr.matches.find((lm) => lm.id === serverMatch.id);
            if (localMatch && (localMatch.status !== "pending" || savingMatchIds.has(serverMatch.id))) {
              return localMatch;
            }
            return serverMatch;
          }),
        };
      })
    );
  }

  const [pickledMatchId, setPickledMatchId] = useState<string | null>(null);
  const [isActionPending, setIsPending] = useState(false);
  const [isGeneratingRound, startGeneratingRound] = useTransition();
  const isPending = isActionPending || isGeneratingRound;
  const [error, setError] = useState<string | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<ScoreDrafts>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showInProgressModal, setShowInProgressModal] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [modalTab, setModalTab] = useState<"attendance" | "court_config">("attendance");
  const [courtConfigCourts, setCourtConfigCourts] = useState<number>(session.courtCount);
  const [courtConfigPlayerCounts, setCourtConfigPlayerCounts] = useState<(2 | 3 | 4)[]>(
    () =>
      session.courtPlayerCounts && session.courtPlayerCounts.length === session.courtCount
        ? [...session.courtPlayerCounts]
        : Array.from({ length: session.courtCount }, () => 4 as const)
  );
  const [courtConfigMessage, setCourtConfigMessage] = useState<string | null>(null);
  const [editingHistoricalMatchId, setEditingHistoricalMatchId] = useState<string | null>(null);
  const [historicalScores, setHistoricalScores] = useState<{ team1: string; team2: string }>({ team1: "", team2: "" });

  const openAttendanceModal = () => {
    setModalTab("attendance");
    setCourtConfigCourts(currentSession.courtCount);
    setCourtConfigPlayerCounts(
      currentSession.courtPlayerCounts && currentSession.courtPlayerCounts.length === currentSession.courtCount
        ? [...currentSession.courtPlayerCounts]
        : Array.from({ length: currentSession.courtCount }, () => 4 as const)
    );
    setCourtConfigMessage(null);
    setShowAttendanceModal(true);
  };

  const presentAttendance = currentAttendance.filter((a) => a.leftRound === null);
  const presentCount = presentAttendance.length;

  const decreaseCourts = () => {
    if (courtConfigCourts > 1) {
      setCourtConfigCourts((c) => c - 1);
      setCourtConfigPlayerCounts((prev) => prev.slice(0, courtConfigCourts - 1));
      setCourtConfigMessage(null);
    }
  };

  const increaseCourts = () => {
    const maxCourts = Math.min(6, Math.max(1, Math.floor(presentCount / 2)));
    if (courtConfigCourts < maxCourts) {
      const nextCourtIndex = courtConfigCourts;
      const currentCapacity = courtConfigPlayerCounts.slice(0, nextCourtIndex).reduce((sum, s) => sum + s, 0);
      const remainingPlayers = presentCount - currentCapacity;
      const nextSize: 2 | 3 | 4 = remainingPlayers >= 4 ? 4 : remainingPlayers >= 3 ? 3 : 2;
      setCourtConfigCourts((c) => c + 1);
      setCourtConfigPlayerCounts((prev) => [...prev.slice(0, nextCourtIndex), nextSize]);
      setCourtConfigMessage(null);
    }
  };

  const handleCourtSizeChange = (index: number, size: 2 | 3 | 4) => {
    setCourtConfigPlayerCounts((prev) => {
      const next = [...prev];
      next[index] = size;
      return next;
    });
    setCourtConfigMessage(null);
  };

  const configCapacity = courtConfigPlayerCounts.slice(0, courtConfigCourts).reduce((sum, s) => sum + s, 0);
  const configSitting = Math.max(0, presentCount - configCapacity);
  const isOverCapacity = configCapacity > presentCount;

  const handleSaveCourtConfig = async () => {
    setIsPending(true);
    setError(null);
    setCourtConfigMessage(null);
    try {
      const res = await updateCourtConfigAction({
        groupId,
        sessionId: currentSession.id,
        sessionVersion: currentSession.version,
        courtCount: courtConfigCourts,
        courtPlayerCounts: courtConfigPlayerCounts.slice(0, courtConfigCourts),
        idempotencyKey: createIdempotencyKey("court_cfg"),
      });
      if (res.ok) {
        setCurrentSession(res.data.session);
        clearLineupDraft(lineupDraftKey(currentSession.id));
        if (res.data.proposal) {
          setRegeneratedProposal(res.data.proposal);
        } else {
          setRegeneratedProposal(null);
        }
        setCourtConfigMessage("Court configuration updated successfully.");
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to update court configuration.");
    } finally {
      setIsPending(false);
    }
  };


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

  const latestStarted = localStartedRounds.at(-1);
  const isRoundInProgress = latestStarted && latestStarted.round.status === "started";

  const [matchmakingVariety, setMatchmakingVariety] = useState<number>(0);

  // Actions
  const handleRegenerate = (variety = matchmakingVariety) => {
    if (isPending) return;
    setError(null);
    startGeneratingRound(async () => {
      try {
        let nextSeed = Math.floor(Math.random() * 0xffff_ffff);
        if (activeProposal && nextSeed === activeProposal.seed) {
          nextSeed = (nextSeed + 1) % 0xffff_ffff;
        }
        const res = await proposeRoundAction({
          groupId,
          sessionId: currentSession.id,
          sessionVersion: currentSession.version,
          seed: nextSeed,
          temperature: variety,
        });
        if (res.ok) {
          clearLineupDraft(lineupDraftKey(currentSession.id));
          setRegeneratedProposal(res.data);
        } else {
          setError(res.error);
        }
      } catch {
        setError("Failed to reshuffle matchups.");
      }
    });
  };

  const handleChangeVariety = (newVariety: number) => {
    setMatchmakingVariety(newVariety);
    handleRegenerate(newVariety);
  };

  const handleReshuffleInProgressRound = async () => {
    if (!latestStarted || isPending) return;
    if (
      !confirm(
        `Are you sure you want to reshuffle Round ${latestStarted.round.roundNumber} matchups? Any entered match scores for this round will be reset.`
      )
    ) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await reshuffleRoundAction({
        groupId,
        sessionId: currentSession.id,
        sessionVersion: currentSession.version,
        roundId: latestStarted.round.id,
        roundVersion: latestStarted.round.version,
        idempotencyKey: createIdempotencyKey("reshuffle"),
        temperature: matchmakingVariety,
      });
      if (res.ok) {
        clearLineupDraft(lineupDraftKey(currentSession.id));
        setRegeneratedProposal(res.data);
        setLocalStartedRounds((prev) => prev.filter((r) => r.round.id !== latestStarted.round.id));
        setScoreDrafts({});
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to reshuffle matchups.");
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
        sessionId: currentSession.id,
        sessionVersion: currentSession.version,
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
        clearLineupDraft(lineupDraftKey(currentSession.id));
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

    setSavingMatchIds((prev) => new Set([...prev, matchId]));
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
        setLocalStartedRounds((prev) =>
          prev.map((sr) =>
            sr.round.id === latestStarted.round.id
              ? {
                  ...sr,
                  matches: sr.matches.map((m) =>
                    m.id === matchId
                      ? {
                          ...m,
                          status: "completed" as const,
                          team1Score,
                          team2Score,
                        }
                      : m
                  ),
                }
              : sr
          )
        );
        setScoreDrafts((prev) => {
          const next = { ...prev };
          delete next[matchId];
          return next;
        });
        setPickledMatchId(isPickleScore(team1Score, team2Score) ? matchId : null);
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
      setSavingMatchIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const handleCancelMatch = async (matchId: string) => {
    if (!latestStarted) return;
    const match = latestStarted.matches.find((m) => m.id === matchId);
    if (!match) return;

    setSavingMatchIds((prev) => new Set([...prev, matchId]));
    try {
      const res = await cancelMatchAction({
        groupId,
        matchId,
        matchVersion: match.version,
        idempotencyKey: createIdempotencyKey(`cancel_${matchId}`),
      });
      if (res.ok) {
        setLocalStartedRounds((prev) =>
          prev.map((sr) =>
            sr.round.id === latestStarted.round.id
              ? {
                  ...sr,
                  matches: sr.matches.map((m) =>
                    m.id === matchId ? { ...m, status: "cancelled" as const } : m
                  ),
                }
              : sr
          )
        );
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to cancel match.");
    } finally {
      setSavingMatchIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const handleNextRound = () => {
    if (!latestStarted || hasUnsavedScores || isPending) return;
    setError(null);
    startGeneratingRound(async () => {
      try {
        const res = await completeRoundAction({
          groupId,
          sessionId: currentSession.id,
          sessionVersion: currentSession.version,
          roundId: latestStarted.round.id,
          roundVersion: latestStarted.round.version,
          idempotencyKey: createIdempotencyKey("next_rd"),
        });
        if (res.ok) {
          startGeneratingRound(() => {
            setRegeneratedProposal(null);
            router.refresh();
          });
        } else {
          setError(res.error);
        }
      } catch {
        setError("Failed to advance to next round.");
      }
    });
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
        sessionId: currentSession.id,
        sessionVersion: currentSession.version,
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

  const inProgressMatches = localStartedRounds
    .filter((sr) => sr.round.status === "started")
    .flatMap((sr) => sr.matches.filter((m) => m.status === "pending"));

  const getMatchTeams = (match: MatchRecord) => {
    const sr = localStartedRounds.find((r) => r.matches.some((m) => m.id === match.id));
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
        sessionId: currentSession.id,
        sessionVersion: currentSession.version,
        idempotencyKey: createIdempotencyKey("end"),
      });
      if (res.ok) {
        markSessionEnded(groupId, currentSession.id);
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
        sessionId: currentSession.id,
        playerId,
        present: !currentlyPresent,
        sessionVersion: currentSession.version,
        idempotencyKey: createIdempotencyKey(`att_${playerId}`),
      });
      if (res.ok) {
        setCurrentAttendance((prev) => {
          const exists = prev.find((a) => a.playerId === playerId);
          if (!exists) {
            return [
              ...prev,
              {
                sessionId: currentSession.id,
                playerId,
                joinedRound: currentSession.currentRoundNumber + 1,
                leftRound: !currentlyPresent ? null : currentSession.currentRoundNumber + 1,
              },
            ];
          }
          return prev.map((a) =>
            a.playerId === playerId
              ? {
                  ...a,
                  leftRound: !currentlyPresent ? null : currentSession.currentRoundNumber + 1,
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
        setLocalStartedRounds((prev) =>
          prev.map((sr) => ({
            ...sr,
            matches: sr.matches.map((m) =>
              m.id === matchId
                ? { ...m, team1Score: t1, team2Score: t2, status: "completed" as const }
                : m
            ),
          }))
        );
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
        setLocalStartedRounds((prev) =>
          prev.map((sr) => ({
            ...sr,
            matches: sr.matches.map((m) =>
              m.id === matchId ? { ...m, status: "cancelled" as const } : m
            ),
          }))
        );
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
  const allSessionRounds = localStartedRounds;
  const totalSessionMatches = allSessionRounds.reduce((acc, r) => acc + r.matches.length, 0);

  // Calculate participating player statistics for the session
  const attendeePlayerIds = new Set<string>();
  for (const att of currentAttendance) {
    const player = players.find((p) => p.id === att.playerId);
    if (player && !player.active) continue;
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

  const pastRounds = localStartedRounds.filter((r) => r.round.status === "completed");
  const canEditSessionName = Boolean(canManage || isOrganizer || isHost);

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
                onClick={openAttendanceModal}
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
        <header className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <SessionNameEditor
                groupId={groupId}
                sessionId={session.id}
                initialName={initialSessionName}
                canEdit={canEditSessionName}
                headingTag="h2"
                className="font-display text-2xl sm:text-3xl font-black uppercase text-black"
                onRenamed={(newName) => setSessionName(newName)}
              />
              <p className="text-xs font-bold text-neutral-600">
                {groupName ?? "Group"}
                {sessionName ? (
                  <>
                    {" · Started "}
                    <ClientDate date={session.startedAt} />
                  </>
                ) : null}
              </p>
            </div>
            {canManage && (
              <div className="shrink-0">
                <SessionOptionsMenu
                  groupId={groupId}
                  sessionId={session.id}
                  sessionName={sessionName}
                  redirectTo={isFromProfile ? "/players" : `/g/${groupId}`}
                  onRenamed={(newName) => setSessionName(newName)}
                />
              </div>
            )}
          </div>
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {groupName && (
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-500 block mb-1">
                    {groupName}
                  </span>
                )}
                <SessionNameEditor
                  groupId={groupId}
                  sessionId={session.id}
                  initialName={initialSessionName}
                  canEdit={canEditSessionName}
                  headingTag="h1"
                  className="font-display text-2xl font-black uppercase text-black"
                  onRenamed={(newName) => setSessionName(newName)}
                />
                {sessionName && (
                  <p className="text-sm font-bold text-neutral-600 mt-1">
                    <ClientDate
                      date={session.startedAt}
                      options={{
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }}
                    />
                  </p>
                )}
              </div>
              {canManage && (
                <div className="shrink-0">
                  <SessionOptionsMenu
                    groupId={groupId}
                    sessionId={session.id}
                    sessionName={sessionName}
                    redirectTo={isFromProfile ? "/players" : `/g/${groupId}`}
                    onRenamed={(newName) => setSessionName(newName)}
                  />
                </div>
              )}
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
              <ClientTime
                date={session.startedAt}
                prefix={<strong className="text-black">Started: </strong>}
              />
              {session.endedAt && (
                <ClientTime
                  date={session.endedAt}
                  prefix={<strong className="text-black">Ended: </strong>}
                />
              )}
              {durationFormatted && (
                <span>
                  <strong className="text-black">Duration:</strong> {durationFormatted}
                </span>
              )}
            </div>
          </section>

          <SessionHighlights rounds={localStartedRounds} players={players} />

          {/* Session Player Leaderboard / Roster */}
          {sessionPlayerStats.length > 0 && (
            <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
              <h2 className="font-display text-xl font-black uppercase tracking-wider text-black">
                Player Summary
              </h2>
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
            <h2 className="font-display text-xl font-black uppercase tracking-wider text-black">
              All Rounds & Matchups
            </h2>
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
                pickledMatchId={pickledMatchId}
                roundId={latestStarted.round.id}
                roundNumber={latestStarted.round.roundNumber}
                matches={scoreEntries}
                fieldErrors={fieldErrors}
                isPending={isPending}
                savingMatchIds={savingMatchIds}
                onSubmitResult={canManage ? handleSaveResult : undefined}
                onCancelMatch={canManage ? handleCancelMatch : undefined}
                onNextRound={canManage ? handleNextRound : undefined}
                onReshuffleRound={canManage ? handleReshuffleInProgressRound : undefined}
                isGeneratingRound={isGeneratingRound}
                canManage={canManage}
                scoreDrafts={scoreDrafts}
                onScoreChange={handleScoreChange}
                hasUnsavedScores={hasUnsavedScores}
              />
              {canManage && (
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={handleReshuffleInProgressRound}
                    disabled={isPending}
                    data-testid="reshuffle-round-link"
                    className="text-xs font-black uppercase text-neutral-600 hover:text-black underline cursor-pointer"
                  >
                    Reshuffle
                  </button>
                  <span className="text-neutral-400">·</span>
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
              draftKey={lineupDraftKey(session.id)}
              draftContext={`${session.version}:${(latestStarted?.round.roundNumber ?? 0) + 1}`}
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
              pairSynergies={pairSynergies}
              isOrganizer={isOrganizer}
              isGeneratingRound={isGeneratingRound}
              canRegenerate={Boolean(canManage)}
              onRegenerate={canManage ? () => handleRegenerate() : undefined}
              onStartRound={canManage ? handleStartRound : undefined}
              canManage={canManage}
              matchmakingVariety={matchmakingVariety}
              onChangeMatchmakingVariety={handleChangeVariety}
            />
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] space-y-4">
              <p className="font-display text-xl font-black uppercase text-black">
                {canManage ? "Ready for the next round?" : "Waiting for Next Round"}
              </p>
              {canManage ? (
                <Button type="button" variant="primary" onClick={() => handleRegenerate()} disabled={isPending} className="font-display text-lg uppercase tracking-wider">
                  {isGeneratingRound ? <RoundGenerationIndicator /> : `Generate Round ${(latestStarted?.round.roundNumber ?? 0) + 1}`}
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

      {/* Attendance & Court Configuration Modal */}
      {canManage && showAttendanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-[8px_8px_0px_0px_#000] max-h-[85vh] overflow-y-auto text-black">
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

            {/* Modal Tabs */}
            <div className="flex items-center gap-2" role="tablist" aria-label="Attendance modal tabs">
              <button
                type="button"
                role="tab"
                id="tab-attendance"
                aria-controls="tabpanel-attendance"
                aria-selected={modalTab === "attendance"}
                onClick={() => setModalTab("attendance")}
                className={`px-3 py-1.5 rounded-xl border-2 font-display text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  modalTab === "attendance"
                    ? "bg-[#ccff00] border-black text-black shadow-[2px_2px_0px_0px_#000]"
                    : "bg-white border-neutral-300 text-neutral-700 hover:border-black"
                }`}
              >
                Attendance
              </button>
              <button
                type="button"
                role="tab"
                id="tab-court-config"
                aria-controls="tabpanel-court-config"
                aria-selected={modalTab === "court_config"}
                onClick={() => setModalTab("court_config")}
                className={`px-3 py-1.5 rounded-xl border-2 font-display text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  modalTab === "court_config"
                    ? "bg-[#ccff00] border-black text-black shadow-[2px_2px_0px_0px_#000]"
                    : "bg-white border-neutral-300 text-neutral-700 hover:border-black"
                }`}
              >
                Court Configuration
              </button>
            </div>

            {modalTab === "attendance" ? (
              <div
                role="tabpanel"
                id="tabpanel-attendance"
                aria-labelledby="tab-attendance"
                className="space-y-4"
              >
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
            ) : (
              <div
                role="tabpanel"
                id="tabpanel-court-config"
                aria-labelledby="tab-court-config"
                className="space-y-4"
              >
                <p className="text-xs font-bold text-neutral-600">
                  Choose each court&apos;s size. 3-player courts play 2v1 and keep scores without affecting ratings; a 2-player court also keeps scores without affecting ratings.
                </p>

                {courtConfigMessage && (
                  <div className="p-2.5 rounded-xl bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black font-black text-xs">
                    {courtConfigMessage}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    aria-label="Decrease courts"
                    disabled={courtConfigCourts <= 1 || isPending}
                    onClick={decreaseCourts}
                    className="w-12 h-12 rounded-xl bg-white hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-black text-black flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
                  >
                    -
                  </button>
                  <div className="text-center px-4">
                    <span
                      aria-label="Court count"
                      className="font-display text-4xl font-black text-black"
                    >
                      {courtConfigCourts}
                    </span>
                    <span className="block text-xs uppercase font-black tracking-wider text-neutral-500 mt-0.5">
                      {courtConfigCourts === 1 ? "Court" : "Courts"}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase courts"
                    disabled={courtConfigCourts >= Math.min(6, Math.max(1, Math.floor(presentCount / 2))) || isPending}
                    onClick={increaseCourts}
                    className="w-12 h-12 rounded-xl bg-white hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-black text-black flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {courtConfigPlayerCounts.slice(0, courtConfigCourts).map((size, index) => (
                    <label key={index} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black p-3 font-bold bg-white shadow-[2px_2px_0px_0px_#000]">
                      <span>Court {index + 1}</span>
                      <select
                        aria-label={`Players on court ${index + 1}`}
                        value={size}
                        onChange={(event) =>
                          handleCourtSizeChange(index, Number(event.target.value) as 2 | 3 | 4)
                        }
                        disabled={isPending}
                        className="rounded-lg border-2 border-black px-2 py-1 bg-white"
                      >
                        {[4, 3, 2].map((playersOnCourt) => (
                          <option key={playersOnCourt} value={playersOnCourt}>
                            {playersOnCourt} players{playersOnCourt === 4 ? " · 2v2" : playersOnCourt === 3 ? " · 2v1" : " · 1v1"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                {(courtConfigPlayerCounts.slice(0, courtConfigCourts).some((s) => s === 3) ||
                  (courtConfigPlayerCounts.slice(0, courtConfigCourts).some((s) => s === 2) && presentCount > configCapacity)) && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-neutral-100 rounded-xl border-2 border-black">
                    <span className="text-xs font-black uppercase text-neutral-700 mr-1">Odd Count Choice:</span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        setCourtConfigPlayerCounts((prev) => {
                          let converted = false;
                          return prev.map((s, idx) => {
                            if (idx < courtConfigCourts && s === 2 && !converted) {
                              converted = true;
                              return 3;
                            }
                            return s;
                          });
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg border-2 border-black text-xs font-black cursor-pointer transition-all ${
                        courtConfigPlayerCounts.slice(0, courtConfigCourts).some((s) => s === 3)
                          ? "bg-[#ccff00] text-black shadow-[2px_2px_0px_0px_#000]"
                          : "bg-white text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      2v1 Match (No Sitters)
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        setCourtConfigPlayerCounts((prev) =>
                          prev.map((s, idx) => (idx < courtConfigCourts && s === 3 ? 2 : s))
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg border-2 border-black text-xs font-black cursor-pointer transition-all ${
                        courtConfigPlayerCounts.slice(0, courtConfigCourts).some((s) => s === 2) && presentCount > configCapacity
                          ? "bg-[#ccff00] text-black shadow-[2px_2px_0px_0px_#000]"
                          : "bg-white text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      1v1 Singles (1 Sitter)
                    </button>
                  </div>
                )}

                {isOverCapacity && (
                  <p className="rounded-lg border border-rose-800 bg-rose-100 px-3 py-2 text-sm font-bold text-rose-950">
                    Total players on courts ({configCapacity}) exceeds present players ({presentCount}). Adjust court sizes or court count.
                  </p>
                )}

                {configSitting > 0 && !isOverCapacity && (
                  <p className="rounded-lg border border-amber-800 bg-amber-100 px-3 py-2 text-sm font-bold text-amber-950">
                    {configSitting} {configSitting === 1 ? "player" : "players"} will sit out each round.
                  </p>
                )}

                <Button
                  type="button"
                  onClick={handleSaveCourtConfig}
                  disabled={isPending || isOverCapacity || courtConfigCourts < 1}
                  className="w-full font-display text-sm uppercase"
                >
                  {isPending ? "Saving..." : "Save Court Configuration"}
                </Button>
              </div>
            )}
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
