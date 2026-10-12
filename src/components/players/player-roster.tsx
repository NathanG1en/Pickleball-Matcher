"use client";

import React, { useState } from "react";
import { Button, ConfirmDialog, Input, Label } from "@/components/ui";
import { formatDupr, eloToDupr, getSkillTier, duprToElo } from "@/lib/domain/rating-display";
import type { PlayerRecord } from "@/lib/domain/types";

export interface PlayerRosterProps {
  readonly groupId: string;
  readonly players: readonly PlayerRecord[];
  readonly isPending?: boolean;
  readonly onAddPlayer?: (name: string, initialRating: number) => void;
  readonly onDeletePlayer?: (player: PlayerRecord) => void;
  readonly canManage?: boolean;
}

export function PlayerRoster({
  players,
  isPending = false,
  onAddPlayer,
  onDeletePlayer,
  canManage = true,
}: PlayerRosterProps) {
  const [name, setName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("3.500");
  const [customRating, setCustomRating] = useState(false);
  const [customRatingInput, setCustomRatingInput] = useState("3.500");
  const [playerToDelete, setPlayerToDelete] = useState<PlayerRecord | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && onAddPlayer) {
      const dupr = customRating ? parseFloat(customRatingInput) || 3.5 : parseFloat(selectedPreset);
      const elo = duprToElo(dupr);
      onAddPlayer(name.trim(), elo);
      setName("");
      setSelectedPreset("3.500");
      setCustomRating(false);
      setCustomRatingInput("3.500");
    }
  };

  const showAddForm = canManage && Boolean(onAddPlayer);
  const showDelete = canManage && Boolean(onDeletePlayer);

  return (
    <div className="player-roster space-y-6">
      {/* Add Player Form */}
      {showAddForm && (
        <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] text-black">
          <h2 className="font-display text-2xl font-black uppercase text-black mb-1">Add Player</h2>
          <p className="text-xs font-bold text-neutral-600 mb-4">
            Add a regular player to your group&apos;s roster.
          </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="player-name-input">
              Player Name
            </Label>
            <Input
              id="player-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jordan Smith"
            />
          </div>

          <div>
            <label htmlFor="player-rating-select" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Initial Skill Level
            </label>
            <select
              id="player-rating-select"
              value={selectedPreset}
              disabled={customRating}
              onChange={(e) => {
                setSelectedPreset(e.target.value);
                if (!customRating) setCustomRatingInput(e.target.value);
              }}
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-2.5 text-black font-bold shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow disabled:opacity-60"
            >
              <option value="2.000">Beginner Level (2.000 – 2.499)</option>
              <option value="2.500">Advanced Beginner Level (2.500 – 2.999)</option>
              <option value="3.000">Intermediate Level (3.000 – 3.499)</option>
              <option value="3.500">Advanced Intermediate Level (3.500 – 3.999)</option>
              <option value="4.000">Competitive Level (4.000 – 4.499)</option>
              <option value="4.500">Advanced Competitive Level (4.500 – 4.999)</option>
            </select>

            <label className="flex items-center gap-2 text-xs font-bold text-black mt-2">
              <input
                type="checkbox"
                checked={customRating}
                onChange={(e) => {
                  setCustomRating(e.target.checked);
                  if (!e.target.checked) setCustomRatingInput(selectedPreset);
                }}
                className="h-4 w-4 accent-black"
              />
              Enter custom rating (e.g. 5.000+)
            </label>

            {customRating && (
              <div className="mt-2">
                <Input
                  id="custom-player-rating"
                  type="number"
                  min={2.0}
                  max={8.0}
                  step={0.001}
                  value={customRatingInput}
                  onChange={(e) => setCustomRatingInput(e.target.value)}
                  placeholder="e.g. 5.250"
                />
              </div>
            )}
          </div>

          <Button type="submit" variant="primary" disabled={!name.trim() || isPending} className="font-display text-base uppercase tracking-wider">
            Add Player
          </Button>
        </form>
      </section>
      )}

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
                  Rating: {formatDupr(player.rating)} ({getSkillTier(eloToDupr(player.rating)).name}) · {player.ratedGamesPlayed} games played
                </span>
              </div>
              <div className="flex items-center gap-3">
                {showDelete && (
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
      <ConfirmDialog
        isOpen={Boolean(showDelete && playerToDelete)}
        onClose={() => setPlayerToDelete(null)}
        onConfirm={() => {
          if (playerToDelete && onDeletePlayer) {
            onDeletePlayer(playerToDelete);
            setPlayerToDelete(null);
          }
        }}
        title="Are you sure?"
        description={
          <>
            Are you sure you want to delete <span className="font-black text-black">{playerToDelete?.name}</span> from the roster?
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        disabled={isPending}
      />
    </div>
  );
}
