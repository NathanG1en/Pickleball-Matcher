"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlayerRecord } from "@/lib/domain/types";

export interface PlayerRosterProps {
  readonly groupId: string;
  readonly players: readonly PlayerRecord[];
  readonly isPending?: boolean;
  readonly onAddPlayer?: (name: string, initialRating: number) => void;
  readonly onToggleActive?: (player: PlayerRecord) => void;
}

export function PlayerRoster({
  players,
  isPending = false,
  onAddPlayer,
  onToggleActive,
}: PlayerRosterProps) {
  const [name, setName] = useState("");
  const [initialRating, setInitialRating] = useState(1000);

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
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-white mb-1">Add Player</h2>
        <p className="text-xs text-slate-400 mb-4">
          Add a regular player to your group&apos;s roster.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="player-name-input" className="block text-xs uppercase font-semibold text-slate-400 mb-1">
              Player Name
            </label>
            <input
              id="player-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jordan Smith"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="player-rating-select" className="block text-xs uppercase font-semibold text-slate-400 mb-1">
              Initial Skill Level
            </label>
            <select
              id="player-rating-select"
              value={initialRating}
              onChange={(e) => setInitialRating(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value={900}>Beginner / Learning (~900)</option>
              <option value={1000}>Intermediate / Average (~1000)</option>
              <option value={1100}>Advanced / Experienced (~1100)</option>
            </select>
          </div>

          <Button type="submit" variant="primary" disabled={!name.trim() || isPending}>
            Add Player
          </Button>
        </form>
      </section>

      {/* Roster List */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Group Roster ({players.length})</h2>
        </div>

        <div className="divide-y divide-slate-800">
          {players.map((player) => (
            <div key={player.id} className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">{player.name}</span>
                <span className="text-xs text-slate-400">
                  Rating: {Math.round(player.rating)} · {player.ratedGamesPlayed} games played
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={player.active ? "success" : "muted"}>
                  {player.active ? "Active" : "Inactive"}
                </Badge>
                {onToggleActive && (
                  <button
                    type="button"
                    onClick={() => onToggleActive(player)}
                    disabled={isPending}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    {player.active ? "Deactivate" : "Activate"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
