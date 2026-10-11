"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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

  // Edit Matchup Modal State
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [slot1Choice, setSlot1Choice] = useState<string>("");
  const [slot2Choice, setSlot2Choice] = useState<string>("");
  const [score1Input, setScore1Input] = useState<string>("");
  const [score2Input, setScore2Input] = useState<string>("");

  const currentBracket = tournament.brackets[effectiveActiveDivision];
  const participants = currentBracket?.participants ?? [];
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
  const championParticipant = participants.find((p) => p.id === finalMatch?.winnerId);

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
        setTournament(res.data);
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
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to reshuffle matchups.");
    } finally {
      setIsPending(false);
    }
  };

  const openEditModal = (match: TournamentMatch) => {
    setEditingMatch(match);
    setSlot1Choice(match.participant1Id ?? "");
    setSlot2Choice(match.participant2Id ?? "");
    setScore1Input(match.score1 !== null ? String(match.score1) : "");
    setScore2Input(match.score2 !== null ? String(match.score2) : "");
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
        setTournament(res.data);
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
      <header className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-center justify-between mb-3">
          <Link
            href={`/g/${tournament.groupId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 font-display text-sm font-black uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-transform"
          >
            ← Back to Group
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={tournament.status === "completed" ? "success" : "default"}>
              {tournament.status === "completed" ? "Completed" : "Active Tournament"}
            </Badge>
            {isOrganizer && (
              <button
                type="button"
                onClick={handleToggleStatus}
                className="text-xs font-black uppercase text-black hover:underline cursor-pointer p-1"
              >
                {tournament.status === "completed" ? "Reopen" : "Mark Finished"}
              </button>
            )}
          </div>
        </div>

        {editingName && isOrganizer ? (
          <div className="flex gap-2 items-center mt-2">
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              className="font-display text-2xl font-black uppercase bg-white border-2 border-black rounded-xl px-3 py-1 flex-1 shadow-[2px_2px_0px_0px_#000]"
            />
            <Button size="sm" variant="primary" onClick={handleSaveName}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditingName(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black">
              {tournament.name}
            </h1>
            {isOrganizer && (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-xs font-black uppercase text-neutral-600 hover:text-black underline cursor-pointer ml-2"
              >
                Rename
              </button>
            )}
          </div>
        )}

        <p className="text-xs font-bold text-neutral-600 mt-1">
          {tournament.divisions.length} Division{tournament.divisions.length === 1 ? "" : "s"} · Single Elimination Bracket
        </p>

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
          <span className="text-3xl block">🏆</span>
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
            className="font-display uppercase text-xs"
          >
            🎲 Reshuffle Matchups
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
            >
              🎲 Generate Matchups
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
                              BYE
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
                              <span className="text-sm">✓</span>
                            )}
                            <span className="font-bold text-sm truncate">
                              {p1 ? p1.name : isBye ? "BYE" : "TBD"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.score1 !== null && (
                              <span className="font-display font-black text-base px-2 py-0.5 rounded bg-white/80 border border-black">
                                {m.score1}
                              </span>
                            )}
                            {isOrganizer && p1 && !isBye && m.winnerId !== p1.id && (
                              <button
                                type="button"
                                onClick={() => handleSetWinner(m.id, p1.id, m.score1, m.score2)}
                                disabled={isPending}
                                className="text-[11px] font-black uppercase px-2 py-1 rounded-lg bg-black text-white hover:bg-neutral-800 cursor-pointer transition-colors"
                              >
                                Win
                              </button>
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
                              <span className="text-sm">✓</span>
                            )}
                            <span className="font-bold text-sm truncate">
                              {p2 ? p2.name : isBye ? "BYE" : "TBD"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.score2 !== null && (
                              <span className="font-display font-black text-base px-2 py-0.5 rounded bg-white/80 border border-black">
                                {m.score2}
                              </span>
                            )}
                            {isOrganizer && p2 && !isBye && m.winnerId !== p2.id && (
                              <button
                                type="button"
                                onClick={() => handleSetWinner(m.id, p2.id, m.score1, m.score2)}
                                disabled={isPending}
                                className="text-[11px] font-black uppercase px-2 py-1 rounded-lg bg-black text-white hover:bg-neutral-800 cursor-pointer transition-colors"
                              >
                                Win
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Clear Winner Undo Control */}
                      {isOrganizer && m.winnerId && !isBye && (
                        <div className="mt-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleSetWinner(m.id, null, null, null)}
                            disabled={isPending}
                            className="text-[10px] font-black uppercase text-neutral-500 hover:text-black underline cursor-pointer"
                          >
                            Reset Winner
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
                {participants.map((p) => (
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
                {participants.map((p) => (
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
