"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export interface AttendancePlayer {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly rating: number;
}

export interface AttendanceManagerProps {
  readonly groupId: string;
  readonly players: readonly AttendancePlayer[];
  readonly selectedPlayerIds?: readonly string[];
  readonly courtCount?: number;
  readonly maxCourts?: number;
  readonly isEditingSession?: boolean;
  readonly isPending?: boolean;
  readonly onSubmit?: (data: { courtCount: number; selectedPlayerIds: string[] }) => void;
  readonly onAddGuest?: (name: string) => void;
}

export function AttendanceManager({
  players,
  selectedPlayerIds: initialSelected = [],
  courtCount: initialCourts = 2,
  maxCourts = 6,
  isEditingSession = false,
  isPending = false,
  onSubmit,
  onAddGuest,
}: AttendanceManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelected.length > 0 ? initialSelected : players.filter((p) => p.active).map((p) => p.id)),
  );
  const [courts, setCourts] = useState<number>(initialCourts);
  const [guestName, setGuestName] = useState<string>("");

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(players.map((p) => p.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const decreaseCourts = () => {
    if (courts > 1) setCourts((c) => c - 1);
  };

  const increaseCourts = () => {
    if (courts < maxCourts) setCourts((c) => c + 1);
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim() && onAddGuest) {
      onAddGuest(guestName.trim());
      setGuestName("");
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        courtCount: courts,
        selectedPlayerIds: Array.from(selectedIds),
      });
    }
  };

  const count = selectedIds.size;
  const neededCourts = Math.floor(count / 4);

  return (
    <div className="attendance-manager space-y-6 pb-28">
      {/* Court Count Card */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-white mb-1">Available Courts</h2>
        <p className="text-sm text-slate-400 mb-4">
          Each court hosts 4 players per round.
        </p>

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Decrease courts"
            disabled={courts <= 1}
            onClick={decreaseCourts}
            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-bold text-white flex items-center justify-center border border-slate-700"
          >
            -
          </button>
          <div className="text-center px-4">
            <span
              aria-label="Court count"
              className="text-3xl font-extrabold text-emerald-400"
            >
              {courts}
            </span>
            <span className="block text-xs uppercase tracking-wider text-slate-400 mt-0.5">
              {courts === 1 ? "Court" : "Courts"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Increase courts"
            disabled={courts >= maxCourts}
            onClick={increaseCourts}
            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-bold text-white flex items-center justify-center border border-slate-700"
          >
            +
          </button>

          {neededCourts > 0 && neededCourts !== courts && (
            <p className="text-xs text-amber-400/90 ml-auto">
              Tip: {count} players can fill {neededCourts} court{neededCourts > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </section>

      {/* Players Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Who is Playing Today?</h2>
            <p className="text-sm text-emerald-400 font-medium">
              {count} players selected
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-slate-300 hover:text-white underline p-1"
            >
              Select All
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-slate-400 hover:text-slate-200 underline p-1"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Player Roster Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {players.map((player) => {
            const isSelected = selectedIds.has(player.id);
            return (
              <label
                key={player.id}
                htmlFor={`player-check-${player.id}`}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? "bg-emerald-950/40 border-emerald-600/80 text-white"
                    : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <input
                  id={`player-check-${player.id}`}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => togglePlayer(player.id)}
                  className="w-5 h-5 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                />
                <span className="font-semibold text-base flex-1">{player.name}</span>
                <span className="text-xs text-slate-400">{Math.round(player.rating)}</span>
              </label>
            );
          })}
        </div>

        {/* Add Guest / Quick Player Form */}
        <form onSubmit={handleAddGuest} className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            placeholder="Add guest or new player..."
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={!guestName.trim()}>
            + Add
          </Button>
        </form>
      </section>

      {/* Sticky Mobile Action Bar */}
      <div className="mobile-action-bar fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs uppercase text-slate-400">Ready</p>
            <p className="text-sm font-bold text-white">
              {count} players · {courts} court{courts > 1 ? "s" : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={count < 4 || isPending}
            onClick={handleSubmit}
            className="flex-1 max-w-xs shadow-lg shadow-emerald-950/50"
          >
            {isPending
              ? "Saving..."
              : isEditingSession
              ? "Update Attendance"
              : "Start Session"}
          </Button>
        </div>
      </div>
    </div>
  );
}
