"use client";

import React, { useMemo, useState } from "react";
import { SetupCourtIllustration } from "@/components/attendance/setup-court-illustration";
import { Button } from "@/components/ui/button";
import { formatDupr } from "@/lib/domain/rating-display";

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
  readonly onSubmit?: (data: { courtCount: number; courtPlayerCounts: (2 | 3 | 4)[]; selectedPlayerIds: string[] }) => void;
  readonly onAddGuest?: (name: string, initialRating?: number) => void;
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
  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [players],
  );
  const initialSelectedCount = initialSelected.length || players.length;
  const defaultCourtCount = Math.min(initialCourts, Math.max(1, Math.floor(initialSelectedCount / 4) + (initialSelectedCount % 4 >= 2 ? 1 : 0)));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelected.length > 0 ? initialSelected : players.map((p) => p.id)),
  );
  const [courts, setCourts] = useState<number>(defaultCourtCount);
  const [courtPlayerCounts, setCourtPlayerCounts] = useState<(2 | 3 | 4)[]>(() => {
    let remaining = initialSelectedCount;
    return Array.from({ length: defaultCourtCount }, () => {
      const size = Math.min(4, Math.max(2, remaining)) as 2 | 3 | 4;
      remaining -= size;
      return size;
    });
  });
  const [guestName, setGuestName] = useState<string>("");
  const [guestRatingPreset, setGuestRatingPreset] = useState<string>("3.5");
  const [isCustomGuestRating, setIsCustomGuestRating] = useState<boolean>(false);
  const [customGuestRating, setCustomGuestRating] = useState<string>("3.5");

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
    if (courts < Math.min(maxCourts, Math.floor(count / 2))) {
      const nextSize: 2 | 3 | 4 = count >= (courts + 1) * 4 ? 4 : count >= (courts + 1) * 3 ? 3 : 2;
      setCourts((c) => c + 1);
      setCourtPlayerCounts((previous) => [...previous.slice(0, courts), nextSize]);
    }
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim() && onAddGuest) {
      const dupr = isCustomGuestRating
        ? parseFloat(customGuestRating) || 3.5
        : parseFloat(guestRatingPreset);
      onAddGuest(guestName.trim(), dupr);
      setGuestName("");
      setGuestRatingPreset("3.5");
      setIsCustomGuestRating(false);
      setCustomGuestRating("3.5");
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        courtCount: courts,
        courtPlayerCounts: courtPlayerCounts.slice(0, courts),
        selectedPlayerIds: Array.from(selectedIds),
      });
    }
  };

  const count = selectedIds.size;
  const capacity = courtPlayerCounts.slice(0, courts).reduce((sum, size) => sum + size, 0);
  const sittingCount = Math.max(0, count - capacity);

  return (
    <div className="attendance-manager space-y-6 pb-28 text-black">
      {/* Court Count Card */}
      <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black uppercase text-black">Available Courts</h2>
          {!isEditingSession && <SetupCourtIllustration />}
        </div>
        <p className="text-sm font-bold text-neutral-600 mb-4">
          Choose each court&apos;s size. 3-player courts play 2v1 and keep scores without affecting ratings; a 2-player court also keeps scores without affecting ratings.
        </p>

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Decrease courts"
            disabled={courts <= 1}
            onClick={() => { decreaseCourts(); setCourtPlayerCounts((previous) => previous.slice(0, -1)); }}
            className="w-12 h-12 rounded-xl bg-white hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-black text-black flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            -
          </button>
          <div className="text-center px-4">
            <span
              aria-label="Court count"
              className="font-display text-4xl font-black text-black"
            >
              {courts}
            </span>
            <span className="block text-xs uppercase font-black tracking-wider text-neutral-500 mt-0.5">
              {courts === 1 ? "Court" : "Courts"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Increase courts"
            disabled={courts >= Math.min(maxCourts, Math.floor(count / 2))}
            onClick={increaseCourts}
            className="w-12 h-12 rounded-xl bg-white hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-black text-black flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            +
          </button>

        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {courtPlayerCounts.slice(0, courts).map((size, index) => (
            <label key={index} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black p-3 font-bold">
              <span>Court {index + 1}</span>
              <select
                aria-label={`Players on court ${index + 1}`}
                value={size}
                onChange={(event) => setCourtPlayerCounts((previous) => previous.map((value, item) => item === index ? Number(event.target.value) as 2 | 3 | 4 : value))}
                className="rounded-lg border-2 border-black px-2 py-1"
              >
                {[4, 3, 2].map((playersOnCourt) => <option key={playersOnCourt} value={playersOnCourt}>{playersOnCourt} players{playersOnCourt === 4 ? " · 2v2" : playersOnCourt === 3 ? " · 2v1" : " · 1v1"}</option>)}
              </select>
            </label>
          ))}
        </div>
        {sittingCount > 0 && <p className="mt-3 rounded-lg border border-amber-800 bg-amber-100 px-3 py-2 text-sm font-bold text-amber-950">{sittingCount} {sittingCount === 1 ? "player" : "players"} will sit out each round.</p>}
      </section>

      {/* Players Section */}
      <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl font-black uppercase text-black">Who is Playing Today?</h2>
            <p className="text-sm font-black text-black mt-1">
              <span className="bg-[#ccff00] px-2.5 py-0.5 border border-black rounded-md shadow-[1px_1px_0px_0px_#000]">
                {count} players selected
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-black uppercase text-black hover:underline p-1 cursor-pointer"
            >
              Select All
            </button>
            <span className="text-black font-bold">|</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-black uppercase text-neutral-500 hover:text-black hover:underline p-1 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Player Roster Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sortedPlayers.map((player) => {
            const isSelected = selectedIds.has(player.id);
            return (
              <label
                key={player.id}
                htmlFor={`player-check-${player.id}`}
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
                  className="w-5 h-5 rounded border-2 border-black accent-black cursor-pointer"
                />
                <span className="font-black text-base flex-1">{player.name}</span>
                <span className="text-xs font-bold text-neutral-600">{formatDupr(player.rating)}</span>
              </label>
            );
          })}
        </div>

        {/* Add Guest / Quick Player Form */}
        <form onSubmit={handleAddGuest} className="mt-4 pt-4 border-t-2 border-neutral-100 space-y-2">
          <label className="block text-xs font-black uppercase tracking-wider text-black">
            Add Guest Player
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              aria-label="Guest player name"
              placeholder="Add guest or new player..."
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="flex-1 bg-white border-2 border-black rounded-xl px-3.5 py-2 text-black font-bold placeholder-neutral-400 text-sm shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow"
            />
            <select
              id="normal-session-guest-rating"
              aria-label="Guest rating"
              value={isCustomGuestRating ? "custom" : guestRatingPreset}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setIsCustomGuestRating(true);
                } else {
                  setIsCustomGuestRating(false);
                  setGuestRatingPreset(e.target.value);
                  setCustomGuestRating(e.target.value);
                }
              }}
              className="bg-white border-2 border-black rounded-xl px-3 py-2 text-black font-bold text-xs shadow-[2px_2px_0px_0px_#000]"
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
                value={customGuestRating}
                onChange={(e) => setCustomGuestRating(e.target.value)}
                className="w-20 bg-white border-2 border-black rounded-xl px-2.5 py-2 text-black font-mono font-bold text-xs shadow-[2px_2px_0px_0px_#000]"
              />
            )}
            <Button type="submit" variant="secondary" size="sm" disabled={!guestName.trim()} className="font-display uppercase tracking-wider">
              Add
            </Button>
          </div>
        </form>
      </section>

      {/* Sticky Mobile Action Bar */}
      <div className="mobile-action-bar sticky bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t-[3px] border-black z-40 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.06)]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs uppercase font-black tracking-wider text-neutral-500">Ready</p>
            <p className="font-display text-base font-black uppercase text-black tracking-tight">
              {count} players · {courts} court{courts > 1 ? "s" : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={count < 2 || capacity > count || isPending}
            onClick={handleSubmit}
            className="flex-1 max-w-xs font-display text-lg tracking-wide uppercase"
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
