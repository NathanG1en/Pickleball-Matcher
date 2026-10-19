"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/groups/back-button";
import { Badge } from "@/components/ui/badge";
import { SessionSignOff } from "@/components/sessions/session-signoff";
import { SessionNameEditor } from "@/components/sessions/session-name-editor";
import { SessionOptionsMenu } from "@/components/sessions/session-options-menu";
import { FilterablePlayerSelect } from "@/components/groups/filterable-player-select";
import { formatDupr } from "@/lib/domain/rating-display";
import {
  addOpenPlayGuestAction,
  addOpenPlayPlayerAction,
  deleteOpenPlayGameAction,
  endOpenPlaySessionAction,
  joinOpenPlaySessionAction,
  removeOpenPlayPlayerAction,
  submitOpenPlayGameAction,
  updateOpenPlayGameAction,
} from "@/app/actions/open-play";
import type {
  AttendanceRecord,
  MatchPlayerRecord,
  PlayerRecord,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";

export interface OpenPlayManagerClientProps {
  readonly groupId: string;
  readonly groupName?: string;
  readonly session: SessionRecord;
  readonly players: readonly PlayerRecord[];
  readonly attendance?: readonly AttendanceRecord[];
  readonly startedRounds: readonly StartedRoundRecord[];
  readonly isOrganizer?: boolean;
  readonly isHost?: boolean;
  readonly isMember?: boolean;
  readonly currentViewerPlayerId?: string | null;
  readonly isFromProfile?: boolean;
}

export function OpenPlayManagerClient({
  groupId,
  groupName,
  session,
  players,
  attendance = [],
  startedRounds,
  isOrganizer = false,
  isHost = false,
  isMember = false,
  currentViewerPlayerId = null,
  isFromProfile = false,
}: OpenPlayManagerClientProps) {
  const router = useRouter();

  // Local state for instant UI updates without waiting for router.refresh()
  const [prevPlayers, setPrevPlayers] = useState(players);
  const [localPlayers, setLocalPlayers] = useState<readonly PlayerRecord[]>(players);
  if (players !== prevPlayers) {
    setPrevPlayers(players);
    const serverIds = new Set(players.map((p) => p.id));
    const pendingLocal = localPlayers.filter((p) => !serverIds.has(p.id));
    setLocalPlayers([...players, ...pendingLocal]);
  }

  const [prevAttendance, setPrevAttendance] = useState(attendance);
  const [localAttendance, setLocalAttendance] = useState<readonly AttendanceRecord[]>(attendance);
  if (attendance !== prevAttendance) {
    setPrevAttendance(attendance);
    const serverPids = new Set(attendance.map((a) => a.playerId));
    const pendingLocal = localAttendance.filter((a) => !serverPids.has(a.playerId));
    setLocalAttendance([...attendance, ...pendingLocal]);
  }

  // Maps
  const playerMap = useMemo(() => new Map<string, PlayerRecord>(localPlayers.map((p) => [p.id, p])), [localPlayers]);

  // Checked-in players
  const presentAttendance = localAttendance.filter((a) => a.leftRound === null);
  const presentPlayerIds = useMemo(() => new Set(presentAttendance.map((a) => a.playerId)), [presentAttendance]);
  const checkedInPlayers = useMemo(
    () =>
      localPlayers
        .filter((p) => presentPlayerIds.has(p.id) && p.active)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [localPlayers, presentPlayerIds],
  );

  // Group players not yet checked in
  const availableRosterPlayers = useMemo(
    () =>
      localPlayers
        .filter((p) => !presentPlayerIds.has(p.id) && p.active)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [localPlayers, presentPlayerIds],
  );

  const isViewerCheckedIn = Boolean(
    currentViewerPlayerId && presentPlayerIds.has(currentViewerPlayerId),
  );

  const isSessionActive = session.status === "active";
  const canManage = Boolean(isOrganizer || isHost);
  const canEditOrDelete = isSessionActive ? (canManage || isMember) : canManage;

  const selectableGamePlayers = checkedInPlayers;

  const [prevStartedRounds, setPrevStartedRounds] = useState(startedRounds);
  const [localStartedRounds, setLocalStartedRounds] = useState<readonly StartedRoundRecord[]>(startedRounds);
  if (startedRounds !== prevStartedRounds) {
    setPrevStartedRounds(startedRounds);
    const serverMatchIds = new Set(startedRounds.flatMap((sr) => sr.matches.map((m) => m.id)));
    const pendingLocalMatches = localStartedRounds.flatMap((sr) =>
      sr.matches.filter((m) => !serverMatchIds.has(m.id))
    );
    const pendingLocalMatchPlayers = localStartedRounds.flatMap((sr) =>
      sr.matchPlayers.filter((mp) => !serverMatchIds.has(mp.matchId))
    );
    if (startedRounds.length > 0) {
      setLocalStartedRounds(
        startedRounds.map((sr, idx) =>
          idx === 0
            ? {
                ...sr,
                matches: [...sr.matches, ...pendingLocalMatches],
                matchPlayers: [...sr.matchPlayers, ...pendingLocalMatchPlayers],
              }
            : sr
        )
      );
    } else if (pendingLocalMatches.length > 0) {
      setLocalStartedRounds(localStartedRounds);
    } else {
      setLocalStartedRounds(startedRounds);
    }
  }

  const [deletedMatchIds, setDeletedMatchIds] = useState<Set<string>>(() => new Set());

  // Games list from started rounds (excludes deleted/cancelled games)
  const allMatches = useMemo(() => localStartedRounds.flatMap((sr) =>
    sr.matches
      .filter((m) => m.status !== "cancelled" && !deletedMatchIds.has(m.id))
      .map((m) => {
        const t1MPs = sr.matchPlayers.filter((mp) => mp.matchId === m.id && mp.team === 1);
        const t2MPs = sr.matchPlayers.filter((mp) => mp.matchId === m.id && mp.team === 2);
        const t1 = t1MPs.map((mp) => playerMap.get(mp.playerId)?.name ?? mp.playerId);
        const t2 = t2MPs.map((mp) => playerMap.get(mp.playerId)?.name ?? mp.playerId);
        return {
          ...m,
          team1PlayerIds: t1MPs.map((mp) => mp.playerId),
          team2PlayerIds: t2MPs.map((mp) => mp.playerId),
          team1Names: t1,
          team2Names: t2,
        };
      }),
  ), [localStartedRounds, playerMap, deletedMatchIds]);

  // Automatically find the last game in the session for the logged in user (or most recent game in session)
  const lastSessionGame = useMemo(() => {
    const recent = [...allMatches].reverse();
    const candidate = currentViewerPlayerId
      ? (recent.find(
          (m) =>
            m.status === "completed" &&
            (m.team1PlayerIds.includes(currentViewerPlayerId) ||
              m.team2PlayerIds.includes(currentViewerPlayerId)),
        ) ?? recent.find((m) => m.status === "completed"))
      : recent.find((m) => m.status === "completed");
    if (!candidate) return null;
    const allPids = [...candidate.team1PlayerIds, ...candidate.team2PlayerIds];
    if (allPids.some((pid) => !presentPlayerIds.has(pid))) return null;
    return candidate;
  }, [allMatches, currentViewerPlayerId, presentPlayerIds]);

  // Helper to compute autopopulated match slots, ensuring current viewer is always the first player (t1p1)
  const getAutopopulatedSlots = (
    game: typeof lastSessionGame,
  ): {
    matchType: "doubles" | "singles";
    t1p1: string;
    t1p2: string;
    t2p1: string;
    t2p2: string;
  } => {
    const isViewerPresent = Boolean(
      currentViewerPlayerId && presentPlayerIds.has(currentViewerPlayerId),
    );

    if (game) {
      const isSingles = game.team1PlayerIds.length === 1;
      let slotT1P1 = game.team1PlayerIds[0] ?? "";
      let slotT1P2 = game.team1PlayerIds[1] ?? "";
      let slotT2P1 = game.team2PlayerIds[0] ?? "";
      let slotT2P2 = game.team2PlayerIds[1] ?? "";

      if (isViewerPresent && currentViewerPlayerId) {
        if (slotT1P1 === currentViewerPlayerId) {
          // Already player 1
        } else if (slotT1P2 === currentViewerPlayerId) {
          // User was player 2 on Team 1 -> put user as player 1
          slotT1P2 = slotT1P1;
          slotT1P1 = currentViewerPlayerId;
        } else if (slotT2P1 === currentViewerPlayerId) {
          // User was player 1 on Team 2 -> put user's team as Team 1
          const prevT1P1 = slotT1P1;
          const prevT1P2 = slotT1P2;
          slotT1P1 = currentViewerPlayerId;
          slotT1P2 = isSingles ? "" : slotT2P2;
          slotT2P1 = prevT1P1;
          slotT2P2 = isSingles ? "" : prevT1P2;
        } else if (slotT2P2 === currentViewerPlayerId) {
          // User was player 2 on Team 2 -> put user's team as Team 1 with user as player 1
          const prevT1P1 = slotT1P1;
          const prevT1P2 = slotT1P2;
          slotT1P1 = currentViewerPlayerId;
          slotT1P2 = isSingles ? "" : slotT2P1;
          slotT2P1 = prevT1P1;
          slotT2P2 = isSingles ? "" : prevT1P2;
        } else {
          // User was not in this game, but is checked in -> user is always the autopopulated first player
          slotT1P1 = currentViewerPlayerId;
        }
      }

      return {
        matchType: isSingles ? "singles" : "doubles",
        t1p1: slotT1P1,
        t1p2: slotT1P2,
        t2p1: slotT2P1,
        t2p2: slotT2P2,
      };
    }

    return {
      matchType: "doubles",
      t1p1: isViewerPresent && currentViewerPlayerId ? currentViewerPlayerId : "",
      t1p2: "",
      t2p1: "",
      t2p2: "",
    };
  };

  const initialSlots = getAutopopulatedSlots(lastSessionGame);

  // Match submission state (automatically populated from last game if available, user first)
  const [matchType, setMatchType] = useState<"doubles" | "singles">(initialSlots.matchType);
  const [t1p1, setT1p1] = useState(initialSlots.t1p1);
  const [t1p2, setT1p2] = useState(initialSlots.t1p2);
  const [t2p1, setT2p1] = useState(initialSlots.t2p1);
  const [t2p2, setT2p2] = useState(initialSlots.t2p2);
  const [t1Score, setT1Score] = useState("");
  const [t2Score, setT2Score] = useState("");

  // Automatically update when a new lastSessionGame is recorded/available
  const [prevLastGameId, setPrevLastGameId] = useState(() => lastSessionGame?.id ?? null);
  if (lastSessionGame && lastSessionGame.id !== prevLastGameId) {
    setPrevLastGameId(lastSessionGame.id);
    const slots = getAutopopulatedSlots(lastSessionGame);
    setMatchType(slots.matchType);
    setT1p1(slots.t1p1);
    setT1p2(slots.t1p2);
    setT2p1(slots.t2p1);
    setT2p2(slots.t2p2);
  }

  // Automatically populate viewer as first player upon joining if not set
  const [hasSetInitialViewer, setHasSetInitialViewer] = useState(() =>
    Boolean(currentViewerPlayerId && presentPlayerIds.has(currentViewerPlayerId)),
  );
  if (!hasSetInitialViewer && currentViewerPlayerId && presentPlayerIds.has(currentViewerPlayerId)) {
    setHasSetInitialViewer(true);
    if (!t1p1) {
      setT1p1(currentViewerPlayerId);
    }
  }

  // Check if a player is selected in another slot in the current match
  const isPlayerSelectedElsewhere = (
    playerId: string,
    currentSlot: "t1p1" | "t1p2" | "t2p1" | "t2p2",
  ) => {
    if (!playerId) return false;
    if (currentSlot !== "t1p1" && t1p1 === playerId) return true;
    if (currentSlot !== "t1p2" && matchType === "doubles" && t1p2 === playerId) return true;
    if (currentSlot !== "t2p1" && t2p1 === playerId) return true;
    if (currentSlot !== "t2p2" && matchType === "doubles" && t2p2 === playerId) return true;
    return false;
  };

  const getSlotOptions = (slot: "t1p1" | "t1p2" | "t2p1" | "t2p2") => {
    return selectableGamePlayers.map((p) => ({
      id: p.id,
      name: p.name,
      disabled: isPlayerSelectedElsewhere(p.id, slot),
    }));
  };

  // Guest / Add player state
  const [guestName, setGuestName] = useState("");
  const [guestPreset, setGuestPreset] = useState("3.5");
  const [isCustomGuestRating, setIsCustomGuestRating] = useState(false);
  const [customGuestRatingInput, setCustomGuestRatingInput] = useState("3.5");
  const [selectedRosterPlayerId, setSelectedRosterPlayerId] = useState("");

  const rosterPlayerOptions = useMemo(
    () =>
      availableRosterPlayers.map((p) => ({
        id: p.id,
        name: `${p.name} (${formatDupr(p.rating)})`,
      })),
    [availableRosterPlayers],
  );

  // Loading & feedback states
  const [isSubmittingGame, setIsSubmittingGame] = useState(false);
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [justEndedSession, setJustEndedSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
  }, []);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
    setSuccessToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setSuccessToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  // Handlers
  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);
    try {
      const res = await joinOpenPlaySessionAction({ groupId, sessionId: session.id });
      if (res.ok) {
        if (currentViewerPlayerId) {
          setLocalAttendance((prev) => {
            const filtered = prev.filter((a) => a.playerId !== currentViewerPlayerId);
            return [
              ...filtered,
              {
                sessionId: session.id,
                playerId: currentViewerPlayerId,
                joinedRound: 1,
                leftRound: null,
              },
            ];
          });
        }
        showToast("You joined Open Play!");
        router.refresh();
      } else {
        setError(res.error ?? "Failed to join session.");
      }
    } catch {
      setError("An unexpected error occurred while joining.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    setIsAddingGuest(true);
    setError(null);
    try {
      const rating = isCustomGuestRating
        ? parseFloat(customGuestRatingInput) || 3.5
        : parseFloat(guestPreset);
      const res = await addOpenPlayGuestAction({
        groupId,
        sessionId: session.id,
        guestName: guestName.trim(),
        initialRating: rating,
      });
      if (res.ok) {
        const guestPlayer = res.data;
        setLocalPlayers((prev) => {
          if (prev.some((p) => p.id === guestPlayer.id)) return prev;
          return [...prev, guestPlayer];
        });
        setLocalAttendance((prev) => {
          const filtered = prev.filter((a) => a.playerId !== guestPlayer.id);
          return [
            ...filtered,
            {
              sessionId: session.id,
              playerId: guestPlayer.id,
              joinedRound: 1,
              leftRound: null,
            },
          ];
        });
        setGuestName("");
        setGuestPreset("3.5");
        setIsCustomGuestRating(false);
        setCustomGuestRatingInput("3.5");
        showToast(`Added guest ${guestPlayer.name}!`);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to add guest.");
      }
    } catch {
      setError("An unexpected error occurred while adding guest.");
    } finally {
      setIsAddingGuest(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRosterPlayerId) return;
    setIsAddingPlayer(true);
    setError(null);
    try {
      const res = await addOpenPlayPlayerAction({
        groupId,
        sessionId: session.id,
        playerId: selectedRosterPlayerId,
      });
      if (res.ok) {
        const playerIdToAdd = selectedRosterPlayerId;
        const addedName = playerMap.get(playerIdToAdd)?.name ?? "Player";
        setLocalAttendance((prev) => {
          const filtered = prev.filter((a) => a.playerId !== playerIdToAdd);
          return [
            ...filtered,
            {
              sessionId: session.id,
              playerId: playerIdToAdd,
              joinedRound: 1,
              leftRound: null,
            },
          ];
        });
        setSelectedRosterPlayerId("");
        showToast(`Added ${addedName} to session!`);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to add player.");
      }
    } catch {
      setError("An unexpected error occurred while adding player.");
    } finally {
      setIsAddingPlayer(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    setError(null);
    if (t1p1 === playerId) setT1p1("");
    if (t1p2 === playerId) setT1p2("");
    if (t2p1 === playerId) setT2p1("");
    if (t2p2 === playerId) setT2p2("");
    try {
      const res = await removeOpenPlayPlayerAction({
        groupId,
        sessionId: session.id,
        playerId,
      });
      if (res.ok) {
        setLocalAttendance((prev) =>
          prev.map((a) => (a.playerId === playerId ? { ...a, leftRound: 1 } : a)),
        );
        showToast("Player removed from session.");
        router.refresh();
      } else {
        setError(res.error ?? "Failed to remove player.");
      }
    } catch {
      setError("An unexpected error occurred.");
    }
  };

  const handleSubmitGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const team1Ids = matchType === "doubles" ? [t1p1, t1p2] : [t1p1];
    const team2Ids = matchType === "doubles" ? [t2p1, t2p2] : [t2p1];

    if (team1Ids.some((id) => !id) || team2Ids.some((id) => !id)) {
      setError("Please select all players for both teams.");
      return;
    }

    const allSelected = [...team1Ids, ...team2Ids];
    if (new Set(allSelected).size !== allSelected.length) {
      setError("A player cannot be selected more than once in the same game.");
      return;
    }

    if (allSelected.some((id) => !presentPlayerIds.has(id))) {
      setError("All players in a game must be currently checked in to the open play session.");
      return;
    }

    const s1 = parseInt(t1Score, 10);
    const s2 = parseInt(t2Score, 10);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError("Please enter valid scores (non-negative whole numbers).");
      return;
    }

    if (s1 === s2) {
      setError("Scores cannot be tied. Enter two different scores.");
      return;
    }

    setIsSubmittingGame(true);
    try {
      const res = await submitOpenPlayGameAction({
        groupId,
        sessionId: session.id,
        team1PlayerIds: team1Ids,
        team2PlayerIds: team2Ids,
        team1Score: s1,
        team2Score: s2,
      });

      if (res.ok) {
        const newMatch = res.data;
        const newMatchPlayers: MatchPlayerRecord[] = [
          ...team1Ids.map((p) => ({ matchId: newMatch.id, playerId: p, team: 1 as const, ratingBefore: null, ratingAfter: null })),
          ...team2Ids.map((p) => ({ matchId: newMatch.id, playerId: p, team: 2 as const, ratingBefore: null, ratingAfter: null })),
        ];

        setLocalStartedRounds((prev) => {
          if (prev.length === 0) {
            const newSr: StartedRoundRecord = {
              round: {
                id: newMatch.roundId,
                sessionId: session.id,
                roundNumber: 1,
                status: "started",
                seed: 0,
                scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
                createdAt: new Date(),
                startedAt: new Date(),
                completedAt: null,
                version: 1,
              },
              matches: [newMatch],
              matchPlayers: newMatchPlayers,
              sits: [],
            };
            return [newSr];
          }
          return prev.map((sr) =>
            sr.round.id === newMatch.roundId || prev.length === 1
              ? {
                  ...sr,
                  matches: [...sr.matches.filter((m) => m.id !== newMatch.id), newMatch],
                  matchPlayers: [...sr.matchPlayers.filter((mp) => mp.matchId !== newMatch.id), ...newMatchPlayers],
                }
              : sr
          );
        });

        setT1Score("");
        setT2Score("");
        showToast("Game submitted successfully!");
        router.refresh();
      } else {
        setError(res.error ?? "Failed to submit game.");
      }
    } catch {
      setError("An unexpected error occurred while submitting game.");
    } finally {
      setIsSubmittingGame(false);
    }
  };

  // Edit match state and handlers
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editMatchType, setEditMatchType] = useState<"doubles" | "singles">("doubles");
  const [editT1p1, setEditT1p1] = useState("");
  const [editT1p2, setEditT1p2] = useState("");
  const [editT2p1, setEditT2p1] = useState("");
  const [editT2p2, setEditT2p2] = useState("");
  const [editT1Score, setEditT1Score] = useState("");
  const [editT2Score, setEditT2Score] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleStartEdit = (match: (typeof allMatches)[number]) => {
    setEditingMatchId(match.id);
    const isSingles = match.team1PlayerIds.length === 1 && match.team2PlayerIds.length === 1;
    setEditMatchType(isSingles ? "singles" : "doubles");
    setEditT1p1(match.team1PlayerIds[0] ?? "");
    setEditT1p2(match.team1PlayerIds[1] ?? "");
    setEditT2p1(match.team2PlayerIds[0] ?? "");
    setEditT2p2(match.team2PlayerIds[1] ?? "");
    setEditT1Score(String(match.team1Score ?? ""));
    setEditT2Score(String(match.team2Score ?? ""));
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingMatchId(null);
    setError(null);
  };

  const isEditPlayerSelectedElsewhere = (
    playerId: string,
    currentSlot: "t1p1" | "t1p2" | "t2p1" | "t2p2",
  ) => {
    if (!playerId) return false;
    if (currentSlot !== "t1p1" && editT1p1 === playerId) return true;
    if (currentSlot !== "t1p2" && editMatchType === "doubles" && editT1p2 === playerId) return true;
    if (currentSlot !== "t2p1" && editT2p1 === playerId) return true;
    if (currentSlot !== "t2p2" && editMatchType === "doubles" && editT2p2 === playerId) return true;
    return false;
  };

  const editSelectablePlayers = useMemo(() => {
    if (!editingMatchId) return checkedInPlayers;
    const editingMatch = allMatches.find((m) => m.id === editingMatchId);
    if (!editingMatch) return checkedInPlayers;
    const ids = new Set(checkedInPlayers.map((p) => p.id));
    const list = [...checkedInPlayers];
    for (const pid of [...editingMatch.team1PlayerIds, ...editingMatch.team2PlayerIds]) {
      if (!ids.has(pid)) {
        const p = playerMap.get(pid);
        if (p) {
          ids.add(p.id);
          list.push(p);
        }
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [checkedInPlayers, editingMatchId, allMatches, playerMap]);

  const getEditSlotOptions = (slot: "t1p1" | "t1p2" | "t2p1" | "t2p2") => {
    return editSelectablePlayers.map((p) => ({
      id: p.id,
      name: p.name,
      disabled: isEditPlayerSelectedElsewhere(p.id, slot),
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatchId) return;
    setError(null);

    const team1Ids = editMatchType === "doubles" ? [editT1p1, editT1p2] : [editT1p1];
    const team2Ids = editMatchType === "doubles" ? [editT2p1, editT2p2] : [editT2p1];

    if (team1Ids.some((id) => !id) || team2Ids.some((id) => !id)) {
      setError("Please select all players for both teams.");
      return;
    }

    const allSelected = [...team1Ids, ...team2Ids];
    if (new Set(allSelected).size !== allSelected.length) {
      setError("A player cannot be selected more than once in the same game.");
      return;
    }

    const editingMatch = allMatches.find((m) => m.id === editingMatchId);
    const existingMatchPids = new Set(
      editingMatch ? [...editingMatch.team1PlayerIds, ...editingMatch.team2PlayerIds] : [],
    );
    if (allSelected.some((id) => !presentPlayerIds.has(id) && !existingMatchPids.has(id))) {
      setError("All players in a game must be currently checked in to the open play session.");
      return;
    }

    const s1 = parseInt(editT1Score, 10);
    const s2 = parseInt(editT2Score, 10);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError("Please enter valid scores (non-negative whole numbers).");
      return;
    }

    if (s1 === s2) {
      setError("Scores cannot be tied. Enter two different scores.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await updateOpenPlayGameAction({
        groupId,
        sessionId: session.id,
        matchId: editingMatchId,
        team1PlayerIds: team1Ids,
        team2PlayerIds: team2Ids,
        team1Score: s1,
        team2Score: s2,
      });

      if (res.ok) {
        const updatedMatchId = editingMatchId;
        const updatedMatchPlayers: MatchPlayerRecord[] = [
          ...team1Ids.map((p) => ({ matchId: updatedMatchId, playerId: p, team: 1 as const, ratingBefore: null, ratingAfter: null })),
          ...team2Ids.map((p) => ({ matchId: updatedMatchId, playerId: p, team: 2 as const, ratingBefore: null, ratingAfter: null })),
        ];

        setLocalStartedRounds((prev) =>
          prev.map((sr) => ({
            ...sr,
            matches: sr.matches.map((m) =>
              m.id === updatedMatchId
                ? { ...m, team1Score: s1, team2Score: s2 }
                : m
            ),
            matchPlayers: [
              ...sr.matchPlayers.filter((mp) => mp.matchId !== updatedMatchId),
              ...updatedMatchPlayers,
            ],
          }))
        );

        setEditingMatchId(null);
        showToast("Game updated successfully!");
        router.refresh();
      } else {
        setError(res.error ?? "Failed to update game.");
      }
    } catch {
      setError("An unexpected error occurred while updating the game.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm("Are you sure you want to delete this game result?")) return;
    setDeletedMatchIds((prev) => new Set([...prev, matchId]));
    try {
      const res = await deleteOpenPlayGameAction({
        groupId,
        sessionId: session.id,
        matchId,
      });
      if (res.ok) {
        showToast("Game deleted.");
        router.refresh();
      } else {
        setDeletedMatchIds((prev) => {
          const next = new Set(prev);
          next.delete(matchId);
          return next;
        });
        setError(res.error ?? "Failed to delete game.");
      }
    } catch {
      setDeletedMatchIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
      setError("An unexpected error occurred while deleting game.");
    }
  };

  const handleEndSession = async () => {
    if (!confirm("Are you sure you want to end this Open Play session?")) return;
    setIsEnding(true);
    setError(null);
    try {
      const res = await endOpenPlaySessionAction({ groupId, sessionId: session.id });
      if (res.ok) {
        setJustEndedSession(true);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to end session.");
      }
    } catch {
      setError("An unexpected error occurred while ending session.");
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div
          role="status"
          className="fixed top-4 right-4 z-50 bg-[#ccff00] border-2 border-black rounded-xl p-3 font-black text-black shadow-[3px_3px_0px_0px_#000] text-sm animate-bounce"
        >
          ✓ {successToast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex items-center justify-between">
          <BackButton
            href={isFromProfile ? "/players" : `/g/${groupId}`}
            label={isFromProfile ? "← Back to Profile" : "← Back to Group"}
            ariaLabel={isFromProfile ? "Go back to profile" : "Go back"}
          />
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-black text-[#ccff00]">
              Open Play
            </Badge>
            <Badge variant={isSessionActive ? "warning" : "muted"}>
              {isSessionActive ? "In Progress" : "Completed"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="min-w-0 flex-1">
            <SessionNameEditor
              groupId={groupId}
              sessionId={session.id}
              initialName={session.name || "Open Play Session"}
              canEdit={isOrganizer || isHost}
              headingTag="h1"
              className="font-display text-2xl sm:text-3xl font-black uppercase text-black"
            />
            <p className="text-xs font-bold text-neutral-600">
              {groupName ?? "Group"} · Started {new Date(session.startedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSessionActive && isOrganizer && (
              <button
                type="button"
                onClick={handleEndSession}
                disabled={isEnding}
                data-testid="end-session-button"
                className="py-2 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-display text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer self-start sm:self-auto"
              >
                {isEnding ? "Ending..." : "End Session"}
              </button>
            )}
            {(isOrganizer || isHost) && (
              <SessionOptionsMenu
                groupId={groupId}
                sessionId={session.id}
                sessionName={session.name}
                redirectTo={isFromProfile ? "/players" : `/g/${groupId}`}
              />
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-100 border-2 border-red-500 rounded-xl text-red-700 text-xs font-bold">
            {error}
          </div>
        )}
      </header>

      {!isSessionActive && (
        <div role={justEndedSession ? "status" : undefined} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-bold">
          <span>Session complete</span>
          <SessionSignOff play={justEndedSession} />
        </div>
      )}

      {/* Attendance & Join Section */}
      <section className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-black uppercase text-black">
              Players in Session ({checkedInPlayers.length})
            </h2>
            <p className="text-xs font-bold text-neutral-600">
              Check in to play or add players and guests.
            </p>
          </div>

          {/* Join Open Play Button for group members not checked in */}
          {isSessionActive && isMember && !isViewerCheckedIn && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={isJoining}
              data-testid="join-open-play-button"
              className="py-2.5 px-5 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black font-display text-sm font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
            >
              {isJoining ? "Joining..." : "Join Open Play"}
            </button>
          )}

          {isSessionActive && isViewerCheckedIn && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ccff00]/40 border border-black rounded-full text-xs font-black text-black">
              ✓ You&apos;re Checked In
            </span>
          )}
        </div>

        {/* Players Chips */}
        {checkedInPlayers.length === 0 ? (
          <p className="text-xs font-bold text-neutral-500 italic py-2">
            No players checked in yet. Join or add players below!
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1" data-testid="open-play-attendees">
            {checkedInPlayers.map((p) => {
              const isViewer = p.id === currentViewerPlayerId;
              return (
                <div
                  key={p.id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-black text-xs font-bold shadow-[2px_2px_0px_0px_#000] ${
                    isViewer ? "bg-[#ccff00]" : "bg-neutral-50"
                  }`}
                >
                  <span className="font-black text-black">{p.name}</span>
                  <span className="text-[10px] text-neutral-600 font-mono">
                    {formatDupr(p.rating)}
                  </span>
                  {isViewer && (
                    <span className="text-[9px] uppercase font-black bg-black text-white px-1.5 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                  {isSessionActive && (isOrganizer || isViewer) && (
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(p.id)}
                      title="Leave / Remove from session"
                      className="ml-1 text-neutral-500 hover:text-black font-black text-sm cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Player / Guest Forms (if session is active or organizer/host) */}
        {(isSessionActive || canManage) && (
          <div className="pt-4 border-t-2 border-neutral-100 flex flex-col gap-4">
            {/* Add from Roster */}
            {availableRosterPlayers.length > 0 && (
              <form onSubmit={handleAddPlayer} className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                  Add Existing Group Member
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <FilterablePlayerSelect
                      ariaLabel="Add Existing Group Member"
                      placeholder="Select player..."
                      value={selectedRosterPlayerId}
                      onChange={(val) => setSelectedRosterPlayerId(val)}
                      options={rosterPlayerOptions}
                      dataTestId="roster-player-select"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!selectedRosterPlayerId || isAddingPlayer}
                    className="px-4 py-2 rounded-xl bg-black text-white font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isAddingPlayer ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>
            )}

            {/* Add Guest */}
            <form onSubmit={handleAddGuest} className="space-y-2">
              <label
                htmlFor="guest-name-input"
                className="block text-xs font-black uppercase tracking-wider text-black"
              >
                Add Guest to Roster
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="guest-name-input"
                  type="text"
                  placeholder="Guest player name..."
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="flex-1 p-2 rounded-xl border-2 border-black bg-white text-xs font-bold shadow-[2px_2px_0px_0px_#000]"
                />
                <select
                  id="guest-rating-select"
                  aria-label="Guest rating"
                  value={isCustomGuestRating ? "custom" : guestPreset}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setIsCustomGuestRating(true);
                    } else {
                      setIsCustomGuestRating(false);
                      setGuestPreset(e.target.value);
                      setCustomGuestRatingInput(e.target.value);
                    }
                  }}
                  className="p-2 rounded-xl border-2 border-black bg-white text-xs font-bold shadow-[2px_2px_0px_0px_#000]"
                >
                  <option value="2.0">2.0 (Beginner)</option>
                  <option value="2.5">2.5 (Adv. Beginner)</option>
                  <option value="3.0">3.0 (Intermediate)</option>
                  <option value="3.5">3.5 (Adv. Intermediate)</option>
                  <option value="4.0">4.0 (Competitive)</option>
                  <option value="4.5">4.5 (Adv. Competitive)</option>
                  <option value="custom">Custom...</option>
                </select>
                {isCustomGuestRating && (
                  <input
                    type="number"
                    aria-label="Custom guest rating"
                    min={2.0}
                    max={8.0}
                    step={0.1}
                    value={customGuestRatingInput}
                    onChange={(e) => setCustomGuestRatingInput(e.target.value)}
                    className="w-20 p-2 rounded-xl border-2 border-black bg-white text-xs font-bold font-mono shadow-[2px_2px_0px_0px_#000]"
                  />
                )}
                <button
                  type="submit"
                  disabled={!guestName.trim() || isAddingGuest}
                  className="px-3 py-2 rounded-xl bg-black text-white font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] disabled:opacity-50 cursor-pointer"
                >
                  {isAddingGuest ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Submit Game Section */}
      {(isSessionActive || canManage) && (
        <section
          className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4"
          data-testid="submit-game-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-black uppercase text-black">
                {isSessionActive ? "Submit Game" : "Add Game"}
              </h2>
              <p className="text-xs font-bold text-neutral-600">
                {isSessionActive
                  ? "Record a match played between session players."
                  : "Record an additional match for this ended session."}
              </p>
            </div>

            {/* Match Type Switcher */}
            <div className="flex border-2 border-black rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_#000]">
              <button
                type="button"
                onClick={() => setMatchType("doubles")}
                className={`py-1 px-3 text-xs font-black uppercase ${
                  matchType === "doubles" ? "bg-[#ccff00] text-black" : "bg-white text-neutral-600"
                }`}
              >
                Doubles (2v2)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMatchType("singles");
                  setT1p2("");
                  setT2p2("");
                }}
                className={`py-1 px-3 text-xs font-black uppercase border-l-2 border-black ${
                  matchType === "singles" ? "bg-[#ccff00] text-black" : "bg-white text-neutral-600"
                }`}
              >
                Singles (1v1)
              </button>
            </div>
          </div>

          {selectableGamePlayers.length < (matchType === "doubles" ? 4 : 2) ? (
            <p className="text-xs font-bold text-neutral-500 bg-neutral-100 p-3 rounded-xl border border-neutral-300">
              Need at least {matchType === "doubles" ? "4 players" : "2 players"} to record a {matchType} game. Add or join players above!
            </p>
          ) : (
            <form onSubmit={handleSubmitGame} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Team 1 Card */}
                <div className="p-4 bg-[#ccff00]/20 border-2 border-black rounded-2xl space-y-3 shadow-[2px_2px_0px_0px_#000]">
                  <h3 className="font-display text-sm font-black uppercase text-black">Team 1</h3>
                  <div className="space-y-2">
                    <FilterablePlayerSelect
                      ariaLabel="Team 1 Player 1"
                      placeholder="Select Player 1..."
                      value={t1p1}
                      onChange={(val) => {
                        if (isPlayerSelectedElsewhere(val, "t1p1")) return;
                        setT1p1(val);
                      }}
                      options={getSlotOptions("t1p1")}
                      dataTestId="select-team-1-player-1"
                    />

                    {matchType === "doubles" && (
                      <FilterablePlayerSelect
                        ariaLabel="Team 1 Player 2"
                        placeholder="Select Player 2..."
                        value={t1p2}
                        onChange={(val) => {
                          if (isPlayerSelectedElsewhere(val, "t1p2")) return;
                          setT1p2(val);
                        }}
                        options={getSlotOptions("t1p2")}
                        dataTestId="select-team-1-player-2"
                      />
                    )}

                    <div className="pt-2">
                      <label className="block text-[11px] font-black uppercase text-black mb-1">
                        Team 1 Points
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 11"
                        value={t1Score}
                        onChange={(e) => setT1Score(e.target.value)}
                        aria-label="Team 1 Score"
                        className="w-full p-2.5 rounded-xl border-2 border-black bg-white font-mono font-black text-lg text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Team 2 Card */}
                <div className="p-4 bg-[#fde047]/20 border-2 border-black rounded-2xl space-y-3 shadow-[2px_2px_0px_0px_#000]">
                  <h3 className="font-display text-sm font-black uppercase text-black">Team 2</h3>
                  <div className="space-y-2">
                    <FilterablePlayerSelect
                      ariaLabel="Team 2 Player 1"
                      placeholder="Select Player 1..."
                      value={t2p1}
                      onChange={(val) => {
                        if (isPlayerSelectedElsewhere(val, "t2p1")) return;
                        setT2p1(val);
                      }}
                      options={getSlotOptions("t2p1")}
                      dataTestId="select-team-2-player-1"
                    />

                    {matchType === "doubles" && (
                      <FilterablePlayerSelect
                        ariaLabel="Team 2 Player 2"
                        placeholder="Select Player 2..."
                        value={t2p2}
                        onChange={(val) => {
                          if (isPlayerSelectedElsewhere(val, "t2p2")) return;
                          setT2p2(val);
                        }}
                        options={getSlotOptions("t2p2")}
                        dataTestId="select-team-2-player-2"
                      />
                    )}

                    <div className="pt-2">
                      <label className="block text-[11px] font-black uppercase text-black mb-1">
                        Team 2 Points
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 9"
                        value={t2Score}
                        onChange={(e) => setT2Score(e.target.value)}
                        aria-label="Team 2 Score"
                        className="w-full p-2.5 rounded-xl border-2 border-black bg-white font-mono font-black text-lg text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingGame}
                data-testid="submit-game-button"
                className="w-full py-3.5 px-6 rounded-xl bg-black hover:bg-neutral-900 text-white font-display text-base font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer transition-all"
              >
                {isSubmittingGame ? "Recording Game..." : isSessionActive ? "Record Game Result" : "Add Game Result"}
              </button>
            </form>
          )}
        </section>
      )}

      {/* Games Played Section */}
      <section className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <h2 className="font-display text-xl font-black uppercase text-black">
          Games Played ({allMatches.length})
        </h2>

        {allMatches.length === 0 ? (
          <p className="text-xs font-bold text-neutral-500 italic py-2">
            No games submitted yet for this session. Record your first game above!
          </p>
        ) : (
          <div className="space-y-3" data-testid="open-play-matches-list">
            {allMatches.map((m, idx) => {
              const isT1Winner = (m.team1Score ?? 0) > (m.team2Score ?? 0);
              const isCompleted = m.status === "completed";
              const isCancelled = m.status === "cancelled";
              const isEditing = editingMatchId === m.id;

              if (isEditing) {
                return (
                  <form
                    key={m.id}
                    onSubmit={handleSaveEdit}
                    data-testid={`edit-game-form-${m.id}`}
                    className="p-4 bg-white border-2 border-black rounded-2xl space-y-4 shadow-[2px_2px_0px_0px_#000]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-black">
                        Edit Game {idx + 1}
                      </span>
                      <div className="flex border-2 border-black rounded-xl overflow-hidden shadow-[1px_1px_0px_0px_#000]">
                        <button
                          type="button"
                          onClick={() => setEditMatchType("doubles")}
                          className={`py-0.5 px-2 text-[11px] font-black uppercase ${
                            editMatchType === "doubles" ? "bg-[#ccff00] text-black" : "bg-white text-neutral-600"
                          }`}
                        >
                          Doubles
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditMatchType("singles");
                            setEditT1p2("");
                            setEditT2p2("");
                          }}
                          className={`py-0.5 px-2 text-[11px] font-black uppercase border-l-2 border-black ${
                            editMatchType === "singles" ? "bg-[#ccff00] text-black" : "bg-white text-neutral-600"
                          }`}
                        >
                          Singles
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Team 1 */}
                      <div className="p-3 bg-[#ccff00]/20 border-2 border-black rounded-xl space-y-2">
                        <span className="text-[11px] font-black uppercase text-black block">Team 1</span>
                        <FilterablePlayerSelect
                          ariaLabel="Edit Team 1 Player 1"
                          placeholder="Select Player 1..."
                          value={editT1p1}
                          onChange={(val) => {
                            if (isEditPlayerSelectedElsewhere(val, "t1p1")) return;
                            setEditT1p1(val);
                          }}
                          options={getEditSlotOptions("t1p1")}
                          sizeVariant="sm"
                          dataTestId={`select-edit-team-1-player-1-${m.id}`}
                        />
                        {editMatchType === "doubles" && (
                          <FilterablePlayerSelect
                            ariaLabel="Edit Team 1 Player 2"
                            placeholder="Select Player 2..."
                            value={editT1p2}
                            onChange={(val) => {
                              if (isEditPlayerSelectedElsewhere(val, "t1p2")) return;
                              setEditT1p2(val);
                            }}
                            options={getEditSlotOptions("t1p2")}
                            sizeVariant="sm"
                            dataTestId={`select-edit-team-1-player-2-${m.id}`}
                          />
                        )}
                        <div>
                          <label className="block text-[10px] font-black uppercase text-black mb-0.5">Score</label>
                          <input
                            type="number"
                            min="0"
                            aria-label="Edit Team 1 Score"
                            value={editT1Score}
                            onChange={(e) => setEditT1Score(e.target.value)}
                            className="w-full p-1.5 rounded-lg border-2 border-black bg-white font-mono font-black text-center text-sm"
                          />
                        </div>
                      </div>

                      {/* Team 2 */}
                      <div className="p-3 bg-[#fde047]/20 border-2 border-black rounded-xl space-y-2">
                        <span className="text-[11px] font-black uppercase text-black block">Team 2</span>
                        <FilterablePlayerSelect
                          ariaLabel="Edit Team 2 Player 1"
                          placeholder="Select Player 1..."
                          value={editT2p1}
                          onChange={(val) => {
                            if (isEditPlayerSelectedElsewhere(val, "t2p1")) return;
                            setEditT2p1(val);
                          }}
                          options={getEditSlotOptions("t2p1")}
                          sizeVariant="sm"
                          dataTestId={`select-edit-team-2-player-1-${m.id}`}
                        />
                        {editMatchType === "doubles" && (
                          <FilterablePlayerSelect
                            ariaLabel="Edit Team 2 Player 2"
                            placeholder="Select Player 2..."
                            value={editT2p2}
                            onChange={(val) => {
                              if (isEditPlayerSelectedElsewhere(val, "t2p2")) return;
                              setEditT2p2(val);
                            }}
                            options={getEditSlotOptions("t2p2")}
                            sizeVariant="sm"
                            dataTestId={`select-edit-team-2-player-2-${m.id}`}
                          />
                        )}
                        <div>
                          <label className="block text-[10px] font-black uppercase text-black mb-0.5">Score</label>
                          <input
                            type="number"
                            min="0"
                            aria-label="Edit Team 2 Score"
                            value={editT2Score}
                            onChange={(e) => setEditT2Score(e.target.value)}
                            className="w-full p-1.5 rounded-lg border-2 border-black bg-white font-mono font-black text-center text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSavingEdit}
                        data-testid={`cancel-edit-game-button-${m.id}`}
                        className="py-1 px-3 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black uppercase tracking-wider cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        data-testid={`save-edit-game-button-${m.id}`}
                        className="py-1 px-4 rounded-xl border-2 border-black bg-black text-white hover:bg-neutral-900 text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] disabled:opacity-60 cursor-pointer"
                      >
                        {isSavingEdit ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <article
                  key={m.id}
                  className="p-3.5 bg-neutral-50 border-2 border-black rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_#000]"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                      Game {idx + 1}
                    </span>
                    <div className="text-sm font-bold flex flex-wrap items-center gap-1.5 text-black">
                      <span className={isCompleted && isT1Winner ? "font-black underline" : ""}>
                        {m.team1Names.join(" & ")}
                      </span>
                      <span className="text-xs font-normal text-neutral-500">vs</span>
                      <span className={isCompleted && !isT1Winner ? "font-black underline" : ""}>
                        {m.team2Names.join(" & ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={isCompleted ? "success" : isCancelled ? "muted" : "warning"}
                      className="font-mono text-sm px-3 py-1"
                    >
                      {isCompleted
                        ? `${m.team1Score} – ${m.team2Score}`
                        : isCancelled
                        ? "Deleted"
                        : "In Play"}
                    </Badge>

                    {canEditOrDelete && isCompleted && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(m)}
                          data-testid={`edit-game-button-${m.id}`}
                          className="text-xs font-bold text-neutral-700 hover:text-black hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMatch(m.id)}
                          data-testid={`delete-game-button-${m.id}`}
                          className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

