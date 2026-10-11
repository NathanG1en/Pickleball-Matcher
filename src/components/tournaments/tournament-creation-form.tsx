"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  TOURNAMENT_DIVISIONS,
  TOURNAMENT_DIVISION_DESCRIPTIONS,
  TOURNAMENT_DIVISION_LABELS,
  type PlayerRecord,
  type TournamentDivision,
} from "@/lib/domain/types";
import { createTournamentAction } from "@/app/actions/tournaments";
import { createPlayerAction } from "@/app/actions/players";
import { createParticipantsForDivision } from "@/lib/tournament/bracket";
import { createIdempotencyKey } from "@/lib/utils/idempotency";

interface TournamentCreationFormProps {
  readonly groupId: string;
  readonly groupName: string;
  readonly initialPlayers: readonly PlayerRecord[];
}

export function TournamentCreationForm({
  groupId,
  groupName,
  initialPlayers,
}: TournamentCreationFormProps) {
  const router = useRouter();
  const [players, setPlayers] = useState<readonly PlayerRecord[]>(initialPlayers);
  const [name, setName] = useState<string>(`${groupName} Championship`);
  const [selectedDivisions, setSelectedDivisions] = useState<Set<TournamentDivision>>(
    new Set(TOURNAMENT_DIVISIONS),
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    new Set(initialPlayers.map((p) => p.id)),
  );
  const [guestName, setGuestName] = useState<string>("");
  const [guestGender, setGuestGender] = useState<"male" | "female">("male");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Division selection handlers
  const toggleDivision = (division: TournamentDivision) => {
    setSelectedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(division)) next.delete(division);
      else next.add(division);
      return next;
    });
  };

  const selectAllDivisions = () => {
    setSelectedDivisions(new Set(TOURNAMENT_DIVISIONS));
  };

  const clearAllDivisions = () => {
    setSelectedDivisions(new Set());
  };

  // Player selection handlers
  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPlayers = () => {
    setSelectedPlayerIds(new Set(players.map((p) => p.id)));
  };

  const clearAllPlayers = () => {
    setSelectedPlayerIds(new Set());
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      const res = await createPlayerAction({
        groupId,
        name: guestName.trim(),
        initialRating: 1000,
        idempotencyKey: createIdempotencyKey("guest"),
      });

      if (res.ok) {
        const newPlayer: PlayerRecord = {
          ...res.data,
          gender: guestGender,
        };
        setPlayers((prev) => [...prev, newPlayer]);
        setSelectedPlayerIds((prev) => new Set([...prev, newPlayer.id]));
        setGuestName("");
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to add player.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a tournament name.");
      return;
    }

    if (selectedDivisions.size === 0) {
      setError("Please select at least one division.");
      return;
    }

    if (selectedPlayerIds.size < 2) {
      setError("Please select at least 2 players.");
      return;
    }

    setIsSubmitting(true);
    try {
      const playerGenders: Record<string, "male" | "female" | null> = {};
      for (const p of players) {
        playerGenders[p.id] = p.gender ?? null;
      }

      const result = await createTournamentAction({
        groupId,
        name: name.trim(),
        divisions: Array.from(selectedDivisions),
        playerIds: Array.from(selectedPlayerIds),
        playerGenders,
      });

      if (!result.ok) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      router.push(`/g/${groupId}/tournaments/${result.data.id}`);
    } catch {
      setError("An unexpected error occurred while creating the tournament.");
      setIsSubmitting(false);
    }
  };

  const getEntrantCount = (division: TournamentDivision) => {
    const selected = players.filter((p) => selectedPlayerIds.has(p.id));
    return createParticipantsForDivision(division, selected).length;
  };

  const divisionsCount = selectedDivisions.size;
  const playersCount = selectedPlayerIds.size;

  return (
    <form onSubmit={handleSubmit} className="tournament-creation-form space-y-6 pb-28 text-black">
      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border-2 border-rose-800 text-rose-200 text-sm font-bold shadow-[3px_3px_0px_0px_#000]">
          {error}
        </div>
      )}

      {/* Tournament Details Card */}
      <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
        <h2 className="font-display text-2xl font-black uppercase text-black mb-1">
          Tournament Details
        </h2>
        <p className="text-sm font-bold text-neutral-600 mb-4">
          Choose a name for this tournament event.
        </p>

        <div>
          <label htmlFor="tournament-name" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
            Tournament Name
          </label>
          <input
            id="tournament-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer Smash Championship"
            className="w-full bg-white border-2 border-black rounded-xl px-4 py-2.5 text-black font-black text-base shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow"
            required
          />
        </div>
      </section>

      {/* Division Selection Card */}
      <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl font-black uppercase text-black">Select Divisions</h2>
            <p className="text-sm font-black text-black mt-1">
              <span className="bg-[#ccff00] px-2.5 py-0.5 border border-black rounded-md shadow-[1px_1px_0px_0px_#000]">
                {divisionsCount} division{divisionsCount === 1 ? "" : "s"} selected
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllDivisions}
              className="text-xs font-black uppercase text-black hover:underline p-1 cursor-pointer"
            >
              Select All
            </button>
            <span className="text-black font-bold">|</span>
            <button
              type="button"
              onClick={clearAllDivisions}
              className="text-xs font-black uppercase text-neutral-500 hover:text-black hover:underline p-1 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Divisions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {TOURNAMENT_DIVISIONS.map((division) => {
            const isSelected = selectedDivisions.has(division);
            const entrantCount = getEntrantCount(division);
            return (
              <label
                key={division}
                htmlFor={`division-check-${division}`}
                className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                  isSelected
                    ? "bg-[#ccff00] border-black text-black shadow-[3px_3px_0px_0px_#000]"
                    : "bg-white border-neutral-300 text-neutral-700 hover:border-black"
                }`}
              >
                <input
                  id={`division-check-${division}`}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleDivision(division)}
                  className="w-5 h-5 rounded border-2 border-black accent-black cursor-pointer mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-base block">{TOURNAMENT_DIVISION_LABELS[division]}</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black/40 bg-white/80 shrink-0">
                      {entrantCount} {entrantCount === 1 ? "entrant" : "entrants"}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-neutral-600 block mt-0.5">
                    {TOURNAMENT_DIVISION_DESCRIPTIONS[division]}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Players Selection Card */}
      <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl font-black uppercase text-black">Who is Playing Today?</h2>
            <p className="text-sm font-black text-black mt-1">
              <span className="bg-[#ccff00] px-2.5 py-0.5 border border-black rounded-md shadow-[1px_1px_0px_0px_#000]">
                {playersCount} players selected
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllPlayers}
              className="text-xs font-black uppercase text-black hover:underline p-1 cursor-pointer"
            >
              Select All
            </button>
            <span className="text-black font-bold">|</span>
            <button
              type="button"
              onClick={clearAllPlayers}
              className="text-xs font-black uppercase text-neutral-500 hover:text-black hover:underline p-1 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Player Roster Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {players.map((player) => {
            const isSelected = selectedPlayerIds.has(player.id);
            return (
              <div
                key={player.id}
                onClick={() => togglePlayer(player.id)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                  isSelected
                    ? "bg-[#ccff00] border-black text-black shadow-[3px_3px_0px_0px_#000]"
                    : "bg-white border-neutral-300 text-neutral-700 hover:border-black"
                }`}
              >
                <input
                  id={`player-check-${player.id}`}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => togglePlayer(player.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 rounded border-2 border-black accent-black cursor-pointer"
                />
                <span className="font-black text-base flex-1 truncate">{player.name}</span>
                <select
                  value={player.gender ?? ""}
                  onChange={(e) => {
                    e.stopPropagation();
                    const newGender = (e.target.value as "male" | "female") || null;
                    setPlayers((prev) =>
                      prev.map((p) => (p.id === player.id ? { ...p, gender: newGender } : p)),
                    );
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] font-black uppercase px-2 py-1 rounded border-2 border-black bg-white shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                  title="Assign player gender"
                >
                  <option value="">No Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <span className="text-xs font-bold text-neutral-600">{Math.round(player.rating)}</span>
              </div>
            );
          })}
        </div>

        {/* Add Guest / Quick Player Form */}
        <div className="mt-4 pt-4 border-t-2 border-neutral-100 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Add guest player name..."
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="flex-1 bg-white border-2 border-black rounded-xl px-3.5 py-2 text-black font-bold placeholder-neutral-400 text-sm shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow"
          />
          <select
            value={guestGender}
            onChange={(e) => setGuestGender(e.target.value as "male" | "female")}
            className="bg-white border-2 border-black rounded-xl px-3 py-2 text-black font-bold text-sm shadow-[2px_2px_0px_0px_#000]"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <Button
            type="button"
            onClick={handleAddGuest}
            variant="secondary"
            size="sm"
            disabled={!guestName.trim()}
            className="font-display uppercase tracking-wider"
          >
            + Add
          </Button>
        </div>
      </section>

      {/* Sticky Mobile Action Bar */}
      <div className="mobile-action-bar sticky bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t-[3px] border-black z-40 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.06)]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs uppercase font-black tracking-wider text-neutral-500">Ready</p>
            <p className="font-display text-base font-black uppercase text-black tracking-tight">
              {divisionsCount} division{divisionsCount === 1 ? "" : "s"} · {playersCount} players
            </p>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={divisionsCount === 0 || playersCount < 2 || isSubmitting}
            className="flex-1 max-w-xs font-display text-lg tracking-wide uppercase"
          >
            {isSubmitting ? "Generating..." : "Create Tournament →"}
          </Button>
        </div>
      </div>
    </form>
  );
}

