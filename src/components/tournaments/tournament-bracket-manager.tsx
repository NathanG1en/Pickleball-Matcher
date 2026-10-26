"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TrophyIcon, ShuffleIcon, CheckIcon, PencilIcon } from "@/components/ui/icons";
import {
  TOURNAMENT_DIVISION_LABELS,
  type TournamentDivision,
  type TournamentMatch,
  type TournamentParticipant,
  type TournamentRecord,
} from "@/lib/domain/types";
import {
  editTournamentSlotAction,
  reshuffleTournamentDivisionAction,
  updateTournamentMatchAction,
  updateTournamentNameAction,
  updateTournamentStatusAction,
} from "@/app/actions/tournaments";
import { TournamentOptionsMenu } from "@/components/tournaments/tournament-options-menu";

interface TournamentBracketManagerProps {
  readonly initialTournament: TournamentRecord;
  readonly isOrganizer: boolean;
}

export function TournamentBracketManager({
  initialTournament,
  isOrganizer,
}: TournamentBracketManagerProps) {
  const [tournament, setTournament] = useState<TournamentRecord>(initialTournament);
  const [activeDivision, setActiveDivision] = useState<TournamentDivision>(
    initialTournament.divisions[0] ?? "mens_singles",
  );
  const availableDivisions: readonly TournamentDivision[] =
    tournament.divisions.length > 0
      ? tournament.divisions
      : (Object.keys(tournament.brackets) as TournamentDivision[]);
  const effectiveActiveDivision: TournamentDivision = availableDivisions.includes(activeDivision)
    ? activeDivision
    : availableDivisions[0] ?? "mens_singles";

  const [editingName, setEditingName] = useState(false);
  const [tournamentName, setTournamentName] = useState(tournament.name);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline match scores per match ID
  const [matchScores, setMatchScores] = useState<Record<string, { s1: string; s2: string }>>({});

  // Edit Matchup Modal State
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [slot1Choice, setSlot1Choice] = useState<string>("");
  const [slot2Choice, setSlot2Choice] = useState<string>("");
  const [score1Input, setScore1Input] = useState<string>("");
  const [score2Input, setScore2Input] = useState<string>("");

  const currentBracket = tournament.brackets[effectiveActiveDivision];
  const participants = currentBracket?.participants ?? [];
  const sortedParticipants = useMemo(
    () =>
      [...(currentBracket?.participants ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [currentBracket?.participants],
  );
  const matches = currentBracket?.matches ?? [];
  const roundNames = currentBracket?.roundNames ?? [];

  // Group matches by round
  const roundsMap = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    const list = roundsMap.get(m.round) ?? [];
    list.push(m);
    roundsMap.set(m.round, list);
  }
  const roundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  // Final match and champion
  const finalMatch = matches.find(
    (m) => m.round === roundNumbers.length && m.matchNumber === 1,
  );
  const hasFinalResult = finalMatch?.status === "bye" ||
    (finalMatch?.status === "completed" && finalMatch.participant1Id && finalMatch.participant2Id);
  const championParticipant = hasFinalResult
    ? participants.find((p) => p.id === finalMatch?.winnerId &&
      (p.id === finalMatch.participant1Id || p.id === finalMatch.participant2Id))
    : undefined;

  const applyMatchUpdate = (updatedTournament: TournamentRecord) => {
    const updatedMatches = updatedTournament.brackets[effectiveActiveDivision]?.matches ?? [];
    setMatchScores((previousDrafts) => {
      const nextDrafts = { ...previousDrafts };
      for (const updated of updatedMatches) {
        const previous = matches.find((match) => match.id === updated.id);
        if (!previous || previous.participant1Id !== updated.participant1Id ||
          previous.participant2Id !== updated.participant2Id || previous.winnerId !== updated.winnerId ||
          previous.status !== updated.status || previous.score1 !== updated.score1 || previous.score2 !== updated.score2) {
          delete nextDrafts[updated.id];
        }
      }
      return nextDrafts;
    });
    setTournament(updatedTournament);
  };

  const getParticipant = (id: string | null): TournamentParticipant | undefined => {
    if (!id) return undefined;
    return participants.find((p) => p.id === id);
  };

  const handleSetWinner = async (
    matchId: string,
    winnerId: string | null,
    score1?: number | null,
    score2?: number | null,
  ) => {
    if (!isOrganizer) return;
    setIsPending(true);
    setError(null);
    try {
      const res = await updateTournamentMatchAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        division: effectiveActiveDivision,
        matchId,
        winnerId,
        score1,
        score2,
      });
      if (res.ok) {
        applyMatchUpdate(res.data);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to update match.");
    } finally {
      setIsPending(false);
    }
  };

  const handleReshuffle = async () => {
    if (!isOrganizer) return;
    if (
      !confirm(
        "Are you sure you want to reshuffle Round 1 matchups? Any entered match scores in this division will be reset.",
      )
    ) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await reshuffleTournamentDivisionAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        division: effectiveActiveDivision,
      });
      if (res.ok) {
        setTournament(res.data);
        setMatchScores({});
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to reshuffle matchups.");
    } finally {
      setIsPending(false);
    }
  };

  const handleScoreChange = (matchId: string, slot: 1 | 2, val: string) => {
    setMatchScores((prev) => {
      const match = matches.find((m) => m.id === matchId);
      const current = prev[matchId] ?? {
        s1: match?.score1 !== null && match?.score1 !== undefined ? String(match.score1) : "",
        s2: match?.score2 !== null && match?.score2 !== undefined ? String(match.score2) : "",
      };
      return {
        ...prev,
        [matchId]: {
          ...current,
          [slot === 1 ? "s1" : "s2"]: val,
        },
      };
    });
  };

  const getMatchScore = (match: TournamentMatch, slot: 1 | 2): string => {
    const entry = matchScores[match.id];
    if (entry !== undefined) {
      return slot === 1 ? entry.s1 : entry.s2;
    }
    const existing = slot === 1 ? match.score1 : match.score2;
    return existing !== null ? String(existing) : "";
  };

  const handleSaveMatchScore = async (matchId: string) => {
    if (!isOrganizer) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match || !match.participant1Id || !match.participant2Id) return;

    const s1Str = getMatchScore(match, 1).trim();
    const s2Str = getMatchScore(match, 2).trim();

    if (s1Str === "" || s2Str === "") {
      setError("Please enter scores for both participants.");
      return;
    }

    const s1 = parseInt(s1Str, 10);
    const s2 = parseInt(s2Str, 10);

    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > 99 || s2 > 99) {
      setError("Scores must be valid numbers between 0 and 99.");
      return;
    }

    if (s1 === s2) {
      setError("Scores cannot be tied. One participant must win.");
      return;
    }

    const winnerId = s1 > s2 ? match.participant1Id : match.participant2Id;
    await handleSetWinner(match.id, winnerId, s1, s2);
  };

  const handleResetWinner = async (matchId: string) => {
    setMatchScores((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    await handleSetWinner(matchId, null, null, null);
  };

  const openEditModal = (match: TournamentMatch) => {
    setEditingMatch(match);
    setSlot1Choice(match.participant1Id ?? "");
    setSlot2Choice(match.participant2Id ?? "");
    setScore1Input(getMatchScore(match, 1));
    setScore2Input(getMatchScore(match, 2));
  };

  const saveEditModal = async () => {
    if (!editingMatch || !isOrganizer) return;
    setIsPending(true);
    setError(null);

    try {
      // Update slot 1 if changed
      if (slot1Choice !== (editingMatch.participant1Id ?? "")) {
        await editTournamentSlotAction({
          tournamentId: tournament.id,
          groupId: tournament.groupId,
          division: effectiveActiveDivision,
          matchId: editingMatch.id,
          slot: 1,
          newParticipantId: slot1Choice || null,
        });
      }

      // Update slot 2 if changed
      if (slot2Choice !== (editingMatch.participant2Id ?? "")) {
        await editTournamentSlotAction({
          tournamentId: tournament.id,
          groupId: tournament.groupId,
          division: effectiveActiveDivision,
          matchId: editingMatch.id,
          slot: 2,
          newParticipantId: slot2Choice || null,
        });
      }

      // Update scores if provided
      const s1 = score1Input.trim() ? Number(score1Input) : null;
      const s2 = score2Input.trim() ? Number(score2Input) : null;
      let winnerId = editingMatch.winnerId;

      if (s1 !== null && s2 !== null) {
        if (s1 > s2) winnerId = slot1Choice || null;
        else if (s2 > s1) winnerId = slot2Choice || null;
      }

      const res = await updateTournamentMatchAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        division: effectiveActiveDivision,
        matchId: editingMatch.id,
        winnerId,
        score1: s1,
        score2: s2,
      });

      if (res.ok) {
        applyMatchUpdate(res.data);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to save match edits.");
    } finally {
      setIsPending(false);
      setEditingMatch(null);
    }
  };

  const handleSaveName = async () => {
    if (!tournamentName.trim() || !isOrganizer) return;
    try {
      const res = await updateTournamentNameAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        name: tournamentName.trim(),
      });
      if (res.ok) {
        setTournament(res.data);
        setEditingName(false);
      }
    } catch {
      setError("Failed to update tournament name.");
    }
  };

  const handleToggleStatus = async () => {
    if (!isOrganizer) return;
    const nextStatus = tournament.status === "completed" ? "active" : "completed";
    try {
      const res = await updateTournamentStatusAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        status: nextStatus,
      });
      if (res.ok) {
        setTournament(res.data);
      }
    } catch {
      setError("Failed to update tournament status.");
    }
  };

  return (
    <div className="tournament-bracket-manager space-y-6 pb-28 text-black">
      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border-2 border-rose-800 text-rose-200 text-sm font-bold shadow-[3px_3px_0px_0px_#000]">
          {error}
        </div>
      )}

      {/* Header Card */}
      <header className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex items-center justify-between">
          <Link
            href={`/g/${tournament.groupId}`}
            className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform"
          >
            ← Back to Group
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={tournament.status === "completed" ? "success" : "default"}>
              {tournament.status === "completed" ? "Completed" : "Active Tournament"}
            </Badge>
            {isOrganizer && (
              <TournamentOptionsMenu
                groupId={tournament.groupId}
                tournamentId={tournament.id}
                tournamentName={tournament.name}
                status={tournament.status}
                onToggleStatus={handleToggleStatus}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="min-w-0 flex-1">
            {editingName && isOrganizer ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveName();
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  aria-label="Tournament name"
                  required
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="min-w-0 max-w-xs font-display text-2xl sm:text-3xl font-black uppercase bg-white border-2 border-black rounded-xl px-3 py-1.5 shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={isPending || !tournamentName.trim()}
                  className="font-bold uppercase"
                >
                  Save
                </Button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
                  {tournament.name}
                </h1>
                {isOrganizer && (
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    aria-label="Edit tournament name"
                    title="Edit tournament name"
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white p-1.5 text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <PencilIcon className="h-2 w-2" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs font-bold text-neutral-600 mt-1">
              {tournament.divisions.length} Division{tournament.divisions.length === 1 ? "" : "s"} · Single Elimination Bracket
            </p>
          </div>

          {isOrganizer && tournament.status === "active" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleStatus}
                className="px-3 py-1.5 rounded-xl border-2 border-black font-display text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer bg-[#ccff00] hover:bg-[#b8eb00] text-black"
              >
                Mark Finished
              </button>
            </div>
          )}
        </div>

        {/* Division Tabs */}
        {availableDivisions.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2 pt-4 border-t-2 border-neutral-100">
            {availableDivisions.map((div) => {
              const isActive = div === effectiveActiveDivision;
              return (
                <button
                  key={div}
                  type="button"
                  onClick={() => setActiveDivision(div)}
                  className={`px-3.5 py-1.5 rounded-xl border-2 font-display text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#ccff00] border-black text-black shadow-[3px_3px_0px_0px_#000]"
                      : "bg-white border-neutral-300 text-neutral-700 hover:border-black"
                  }`}
                >
                  {TOURNAMENT_DIVISION_LABELS[div] ?? div}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Champion Celebration Banner */}
      {championParticipant && (
        <section className="bg-[#ccff00] border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] text-center space-y-2">
          <TrophyIcon className="h-10 w-10 mx-auto text-black" />
          <h2 className="font-display text-2xl font-black uppercase text-black">
            {TOURNAMENT_DIVISION_LABELS[effectiveActiveDivision]} Champion
          </h2>
          <p className="font-display text-3xl font-black uppercase text-black bg-white inline-block px-5 py-2 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000]">
            {championParticipant.name}
          </p>
        </section>
      )}

      {/* Division Bracket Toolbar */}
      <div className="bg-white border-[3px] border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-display text-lg font-black uppercase text-black block">
            {TOURNAMENT_DIVISION_LABELS[effectiveActiveDivision]}
          </span>
          <span className="text-xs font-bold text-neutral-600">
            {participants.length} Entrants · {roundNumbers.length} Rounds
          </span>
        </div>
        {isOrganizer && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleReshuffle}
            disabled={isPending}
            className="font-display uppercase text-xs inline-flex items-center gap-1.5"
          >
            <ShuffleIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Reshuffle Matchups</span>
          </Button>
        )}
      </div>

      {/* Bracket Tree / Columns */}
      {roundNumbers.length === 0 ? (
        <div className="p-8 text-center bg-white border-[3px] border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] space-y-3">
          <p className="font-display text-lg font-black uppercase text-neutral-800">
            No matchups in this division yet
          </p>
          <p className="text-xs font-bold text-neutral-600">
            Click Reshuffle to generate bracket matchups for this division.
          </p>
          {isOrganizer && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleReshuffle}
              disabled={isPending}
              className="inline-flex items-center gap-1.5"
            >
              <ShuffleIcon className="h-3.5 w-3.5 shrink-0" />
              <span>Generate Matchups</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="bracket-tree space-y-8">
        {roundNumbers.map((roundNum) => {
          const roundMatches = roundsMap.get(roundNum) ?? [];
          const roundName = roundNames[roundNum - 1] ?? `Round ${roundNum}`;
          const isFinals = roundNum === roundNumbers.length;

          return (
            <div key={roundNum} className="round-column space-y-3">
              <div className="flex items-center gap-2">
                <span className="bg-black text-[#ccff00] px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider font-display border border-black shadow-[2px_2px_0px_0px_#000]">
                  {roundName}
                </span>
                <span className="text-xs font-bold text-neutral-500 uppercase">
                  {roundMatches.length} {roundMatches.length === 1 ? "Match" : "Matches"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roundMatches.map((m) => {
                  const p1 = getParticipant(m.participant1Id);
                  const p2 = getParticipant(m.participant2Id);
                  const isBye = m.status === "bye";
                  const isCompleted = m.status === "completed" || isBye;

                  return (
                    <div
                      key={m.id}
                      className={`bracket-match-card rounded-2xl border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] transition-all bg-white relative ${
                        isFinals ? "border-black ring-2 ring-black/20" : ""
                      }`}
                    >
                      {/* Match Header */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-neutral-100">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                          Match {m.matchNumber} {isFinals ? "· Championship" : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isBye ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-neutral-400 bg-neutral-100 text-neutral-600">
                              Skipped
                            </span>
                          ) : isCompleted ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black bg-[#ccff00] text-black">
                              Done
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-neutral-300 bg-white text-neutral-600">
                              In Play
                            </span>
                          )}
                          {isOrganizer && !isBye && (
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              className="text-xs font-bold text-neutral-500 hover:text-black uppercase underline p-1 cursor-pointer"
                              title="Edit matchup or scores"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Participant Slots */}
                      <div className="space-y-2">
                        {/* Slot 1 */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all ${
                            m.winnerId === m.participant1Id && m.winnerId !== null
                              ? "bg-[#ccff00] border-black font-black text-black shadow-[2px_2px_0px_0px_#000]"
                              : "bg-white border-neutral-300 text-neutral-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {m.winnerId === m.participant1Id && m.winnerId !== null && (
                              <CheckIcon className="h-4 w-4 shrink-0 text-black" />
                            )}
                            <span className="font-bold text-sm truncate">
                              {p1 ? p1.name : isBye ? "Skipped" : "TBD"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isOrganizer && p1 && p2 && !isBye ? (
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={getMatchScore(m, 1)}
                                onChange={(e) => handleScoreChange(m.id, 1, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveMatchScore(m.id);
                                  }
                                }}
                                placeholder="0"
                                disabled={isPending}
                                aria-label={p1 ? `${p1.name} score` : "Participant 1 score"}
                                data-testid={`score1-input-${m.id}`}
                                className="w-12 h-8 text-center font-display font-black text-sm bg-white text-black border-2 border-black rounded-lg shadow-[1px_1px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
                              />
                            ) : (
                              m.score1 !== null && (
                                <span className="font-display font-black text-base px-2 py-0.5 rounded bg-white/80 border border-black">
                                  {m.score1}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        {/* Slot 2 */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all ${
                            m.winnerId === m.participant2Id && m.winnerId !== null
                              ? "bg-[#ccff00] border-black font-black text-black shadow-[2px_2px_0px_0px_#000]"
                              : "bg-white border-neutral-300 text-neutral-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {m.winnerId === m.participant2Id && m.winnerId !== null && (
                              <CheckIcon className="h-4 w-4 shrink-0 text-black" />
                            )}
                            <span className="font-bold text-sm truncate">
                              {p2 ? p2.name : isBye ? "Skipped" : "TBD"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isOrganizer && p1 && p2 && !isBye ? (
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={getMatchScore(m, 2)}
                                onChange={(e) => handleScoreChange(m.id, 2, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveMatchScore(m.id);
                                  }
                                }}
                                placeholder="0"
                                disabled={isPending}
                                aria-label={p2 ? `${p2.name} score` : "Participant 2 score"}
                                data-testid={`score2-input-${m.id}`}
                                className="w-12 h-8 text-center font-display font-black text-sm bg-white text-black border-2 border-black rounded-lg shadow-[1px_1px_0px_0px_#000] focus:ring-2 focus:ring-black outline-none"
                              />
                            ) : (
                              m.score2 !== null && (
                                <span className="font-display font-black text-base px-2 py-0.5 rounded bg-white/80 border border-black">
                                  {m.score2}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Organizer Match Controls: Reset & Save */}
                      {isOrganizer && p1 && p2 && !isBye && (
                        <div className="mt-3 pt-2.5 border-t-2 border-neutral-100 flex items-center justify-between gap-2">
                          <div>
                            {m.winnerId && (
                              <button
                                type="button"
                                onClick={() => handleResetWinner(m.id)}
                                disabled={isPending}
                                className="text-[11px] font-black uppercase text-neutral-500 hover:text-black underline cursor-pointer"
                              >
                                Reset Winner
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveMatchScore(m.id)}
                            disabled={isPending}
                            data-testid={`save-score-${m.id}`}
                            className="px-3 py-1 rounded-xl bg-black hover:bg-neutral-800 text-white font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Edit Matchup Modal */}
      {editingMatch && (
        <Modal
          isOpen={true}
          onClose={() => setEditingMatch(null)}
          title={`Edit Match ${editingMatch.matchNumber}`}
        >
          <div className="space-y-4 text-black">
            <p className="text-xs font-bold text-neutral-600">
              Easily change participants or enter match scores.
            </p>

            {/* Slot 1 Selection */}
            <div>
              <label className="block text-xs font-black uppercase text-black mb-1">
                Participant 1
              </label>
              <select
                value={slot1Choice}
                onChange={(e) => setSlot1Choice(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-xl p-2.5 text-sm font-bold shadow-[2px_2px_0px_0px_#000]"
              >
                <option value="">(None / Empty)</option>
                {sortedParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Slot 2 Selection */}
            <div>
              <label className="block text-xs font-black uppercase text-black mb-1">
                Participant 2
              </label>
              <select
                value={slot2Choice}
                onChange={(e) => setSlot2Choice(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-xl p-2.5 text-sm font-bold shadow-[2px_2px_0px_0px_#000]"
              >
                <option value="">(None / Empty)</option>
                {sortedParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t-2 border-neutral-100">
              <div>
                <label className="block text-xs font-black uppercase text-black mb-1">
                  Score 1
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={score1Input}
                  onChange={(e) => setScore1Input(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border-2 border-black rounded-xl p-2 text-center font-display text-lg font-black shadow-[2px_2px_0px_0px_#000]"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-black mb-1">
                  Score 2
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={score2Input}
                  onChange={(e) => setScore2Input(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border-2 border-black rounded-xl p-2 text-center font-display text-lg font-black shadow-[2px_2px_0px_0px_#000]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingMatch(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={saveEditModal}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save Matchup"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
