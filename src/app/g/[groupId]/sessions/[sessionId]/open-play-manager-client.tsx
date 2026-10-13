"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/groups/back-button";
import { Badge } from "@/components/ui/badge";
import { formatDupr } from "@/lib/domain/rating-display";
import {
  addOpenPlayGuestAction,
  addOpenPlayPlayerAction,
  endOpenPlaySessionAction,
  joinOpenPlaySessionAction,
  removeOpenPlayPlayerAction,
  submitOpenPlayGameAction,
} from "@/app/actions/open-play";
import { cancelMatchAction } from "@/app/actions/results";
import type {
  AttendanceRecord,
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
  isMember = false,
  currentViewerPlayerId = null,
  isFromProfile = false,
}: OpenPlayManagerClientProps) {
  const router = useRouter();

  // Match submission state
  const [matchType, setMatchType] = useState<"doubles" | "singles">("doubles");
  const [t1p1, setT1p1] = useState("");
  const [t1p2, setT1p2] = useState("");
  const [t2p1, setT2p1] = useState("");
  const [t2p2, setT2p2] = useState("");
  const [t1Score, setT1Score] = useState("");
  const [t2Score, setT2Score] = useState("");

  // Guest / Add player state
  const [guestName, setGuestName] = useState("");
  const [selectedRosterPlayerId, setSelectedRosterPlayerId] = useState("");

  // Loading & feedback states
  const [isSubmittingGame, setIsSubmittingGame] = useState(false);
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Maps
  const playerMap = new Map<string, PlayerRecord>(players.map((p) => [p.id, p]));

  // Checked-in players
  const presentAttendance = attendance.filter((a) => a.leftRound === null);
  const presentPlayerIds = new Set(presentAttendance.map((a) => a.playerId));
  const checkedInPlayers = players.filter((p) => presentPlayerIds.has(p.id));

  // Group players not yet checked in
  const availableRosterPlayers = players.filter(
    (p) => !presentPlayerIds.has(p.id) && p.active,
  );

  const isViewerCheckedIn = Boolean(
    currentViewerPlayerId && presentPlayerIds.has(currentViewerPlayerId),
  );

  const isSessionActive = session.status === "active";

  // Games list from started rounds
  const allMatches = startedRounds.flatMap((sr) =>
    sr.matches.map((m) => {
      const t1 = sr.matchPlayers
        .filter((mp) => mp.matchId === m.id && mp.team === 1)
        .map((mp) => playerMap.get(mp.playerId)?.name ?? mp.playerId);
      const t2 = sr.matchPlayers
        .filter((mp) => mp.matchId === m.id && mp.team === 2)
        .map((mp) => playerMap.get(mp.playerId)?.name ?? mp.playerId);
      return {
        ...m,
        team1Names: t1,
        team2Names: t2,
      };
    }),
  );

  // Handlers
  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);
    try {
      const res = await joinOpenPlaySessionAction({ groupId, sessionId: session.id });
      if (res.ok) {
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
      const res = await addOpenPlayGuestAction({
        groupId,
        sessionId: session.id,
        guestName: guestName.trim(),
      });
      if (res.ok) {
        setGuestName("");
        showToast(`Added guest ${res.data.name}!`);
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
        const addedName = playerMap.get(selectedRosterPlayerId)?.name ?? "Player";
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
    try {
      const res = await removeOpenPlayPlayerAction({
        groupId,
        sessionId: session.id,
        playerId,
      });
      if (res.ok) {
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
        setT1Score("");
        setT2Score("");
        setT1p1("");
        setT1p2("");
        setT2p1("");
        setT2p2("");
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

  const handleCancelMatch = async (matchId: string) => {
    if (!confirm("Are you sure you want to cancel this game result?")) return;
    try {
      const res = await cancelMatchAction({ groupId, matchId });
      if (res.ok) {
        showToast("Game cancelled.");
        router.refresh();
      } else {
        setError(res.error ?? "Failed to cancel game.");
      }
    } catch {
      setError("An unexpected error occurred.");
    }
  };

  const handleEndSession = async () => {
    if (!confirm("Are you sure you want to end this Open Play session?")) return;
    setIsEnding(true);
    setError(null);
    try {
      const res = await endOpenPlaySessionAction({ groupId, sessionId: session.id });
      if (res.ok) {
        showToast("Open Play session ended.");
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
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-black uppercase text-black">
              Open Play Session
            </h1>
            <p className="text-xs font-bold text-neutral-600">
              {groupName ?? "Group"} · Started {new Date(session.startedAt).toLocaleDateString()}
            </p>
          </div>

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
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-100 border-2 border-red-500 rounded-xl text-red-700 text-xs font-bold">
            {error}
          </div>
        )}
      </header>

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

        {/* Add Player / Guest Forms (if session is active) */}
        {isSessionActive && (
          <div className="pt-4 border-t-2 border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Add from Roster */}
            {availableRosterPlayers.length > 0 && (
              <form onSubmit={handleAddPlayer} className="space-y-2">
                <label
                  htmlFor="roster-player-select"
                  className="block text-xs font-black uppercase tracking-wider text-black"
                >
                  Add Group Member
                </label>
                <div className="flex gap-2">
                  <select
                    id="roster-player-select"
                    value={selectedRosterPlayerId}
                    onChange={(e) => setSelectedRosterPlayerId(e.target.value)}
                    className="flex-1 p-2 rounded-xl border-2 border-black bg-white text-xs font-bold shadow-[2px_2px_0px_0px_#000]"
                  >
                    <option value="">Select player...</option>
                    {availableRosterPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatDupr(p.rating)})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!selectedRosterPlayerId || isAddingPlayer}
                    className="px-3 py-2 rounded-xl bg-black text-white font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] disabled:opacity-50 cursor-pointer"
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
                Add Guest
              </label>
              <div className="flex gap-2">
                <input
                  id="guest-name-input"
                  type="text"
                  placeholder="Guest player name..."
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="flex-1 p-2 rounded-xl border-2 border-black bg-white text-xs font-bold shadow-[2px_2px_0px_0px_#000]"
                />
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
      {isSessionActive && (
        <section
          className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4"
          data-testid="submit-game-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-black uppercase text-black">
                Submit Game
              </h2>
              <p className="text-xs font-bold text-neutral-600">
                Record a match played between session players.
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
                onClick={() => setMatchType("singles")}
                className={`py-1 px-3 text-xs font-black uppercase border-l-2 border-black ${
                  matchType === "singles" ? "bg-[#ccff00] text-black" : "bg-white text-neutral-600"
                }`}
              >
                Singles (1v1)
              </button>
            </div>
          </div>

          {checkedInPlayers.length < (matchType === "doubles" ? 4 : 2) ? (
            <p className="text-xs font-bold text-neutral-500 bg-neutral-100 p-3 rounded-xl border border-neutral-300">
              Need at least {matchType === "doubles" ? "4 players" : "2 players"} checked into the
              session to record a {matchType} game. Add or join players above!
            </p>
          ) : (
            <form onSubmit={handleSubmitGame} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Team 1 Card */}
                <div className="p-4 bg-[#ccff00]/20 border-2 border-black rounded-2xl space-y-3 shadow-[2px_2px_0px_0px_#000]">
                  <h3 className="font-display text-sm font-black uppercase text-black">Team 1</h3>
                  <div className="space-y-2">
                    <select
                      aria-label="Team 1 Player 1"
                      value={t1p1}
                      onChange={(e) => setT1p1(e.target.value)}
                      className="w-full p-2 rounded-xl border-2 border-black bg-white text-xs font-bold"
                    >
                      <option value="">Select Player 1...</option>
                      {checkedInPlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    {matchType === "doubles" && (
                      <select
                        aria-label="Team 1 Player 2"
                        value={t1p2}
                        onChange={(e) => setT1p2(e.target.value)}
                        className="w-full p-2 rounded-xl border-2 border-black bg-white text-xs font-bold"
                      >
                        <option value="">Select Player 2...</option>
                        {checkedInPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
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
                    <select
                      aria-label="Team 2 Player 1"
                      value={t2p1}
                      onChange={(e) => setT2p1(e.target.value)}
                      className="w-full p-2 rounded-xl border-2 border-black bg-white text-xs font-bold"
                    >
                      <option value="">Select Player 1...</option>
                      {checkedInPlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    {matchType === "doubles" && (
                      <select
                        aria-label="Team 2 Player 2"
                        value={t2p2}
                        onChange={(e) => setT2p2(e.target.value)}
                        className="w-full p-2 rounded-xl border-2 border-black bg-white text-xs font-bold"
                      >
                        <option value="">Select Player 2...</option>
                        {checkedInPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
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
                {isSubmittingGame ? "Recording Game..." : "Record Game Result"}
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
                        ? "Cancelled"
                        : "In Play"}
                    </Badge>

                    {isSessionActive && isOrganizer && isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleCancelMatch(m.id)}
                        className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
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

