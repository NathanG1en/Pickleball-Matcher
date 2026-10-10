"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerRecord } from "@/lib/domain/types";

export interface PlayerRosterProps {
  readonly groupId: string;
  readonly players: readonly PlayerRecord[];
  readonly isPending?: boolean;
  readonly onAddPlayer?: (name: string, initialRating: number) => void;
  readonly onDeletePlayer?: (player: PlayerRecord) => void;
}

export function PlayerRoster({
  players,
  isPending = false,
  onAddPlayer,
  onDeletePlayer,
}: PlayerRosterProps) {
  const [name, setName] = useState("");
  const [initialRating, setInitialRating] = useState(1000);
  const [playerToDelete, setPlayerToDelete] = useState<PlayerRecord | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && onAddPlayer) {
      onAddPlayer(name.trim(), initialRating);
      setName("");
      setInitialRating(1000);
    }
  };

  return (
    <div className="player-roster space-y-6">
      {/* Add Player Form */}
      <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] text-black">
        <h2 className="font-display text-2xl font-black uppercase text-black mb-1">Add Player</h2>
        <p className="text-xs font-bold text-neutral-600 mb-4">
          Add a regular player to your group&apos;s roster.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="player-name-input" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Player Name
            </label>
            <input
              id="player-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jordan Smith"
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-2.5 text-black font-bold placeholder-neutral-400 shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow"
            />
          </div>

          <div>
            <label htmlFor="player-rating-select" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Initial Skill Level
            </label>
            <select
              id="player-rating-select"
              value={initialRating}
              onChange={(e) => setInitialRating(Number(e.target.value))}
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-2.5 text-black font-bold shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow"
            >
              <option value={900}>Beginner / Learning (~900)</option>
              <option value={1000}>Intermediate / Average (~1000)</option>
              <option value={1100}>Advanced / Experienced (~1100)</option>
            </select>
          </div>

          <Button type="submit" variant="primary" disabled={!name.trim() || isPending} className="font-display text-base uppercase tracking-wider">
            Add Player
          </Button>
        </form>
      </section>

      {/* Roster List */}
      <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] text-black">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-black uppercase text-black">Group Roster ({players.length})</h2>
        </div>

        <div className="divide-y-2 divide-neutral-100">
          {players.map((player) => (
            <div key={player.id} className="py-3 flex items-center justify-between">
              <div>
                <span className="font-black text-black text-base block">
                  {player.name}
                  {player.username ? ` (@${player.username})` : ""}
                </span>
                <span className="text-xs font-bold text-neutral-600">
                  Rating: {Math.round(player.rating)} · {player.ratedGamesPlayed} games played
                </span>
              </div>
              <div className="flex items-center gap-3">
                {onDeletePlayer && (
                  <button
                    type="button"
                    onClick={() => setPlayerToDelete(player)}
                    disabled={isPending}
                    className="text-xs font-black uppercase text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {playerToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-[8px_8px_0px_0px_#000] text-black">
            <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black">
              Are you sure?
            </h3>
            <p className="text-sm font-bold text-neutral-700">
              Are you sure you want to delete <span className="font-black text-black">{playerToDelete.name}</span> from the roster?
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlayerToDelete(null)}
                disabled={isPending}
                className="font-display uppercase tracking-wider text-sm"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (playerToDelete && onDeletePlayer) {
                    onDeletePlayer(playerToDelete);
                    setPlayerToDelete(null);
                  }
                }}
                disabled={isPending}
                className="font-display uppercase tracking-wider text-sm"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
