"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Button, ConfirmDialog, Input, Label } from "@/components/ui";
import { formatDupr, eloToDupr, getSkillTier, duprToElo } from "@/lib/domain/rating-display";
import type { PlayerRecord } from "@/lib/domain/types";
import { PinIcon } from "@/components/ui/icons";
import {
  usePinnedPlayerIds,
  togglePinnedPlayer,
  sortPlayersWithPinned,
} from "@/lib/storage/pinned-players";

export interface PlayerRosterProps {
  readonly groupId: string;
  readonly players: readonly PlayerRecord[];
  readonly isPending?: boolean;
  readonly onAddPlayer?: (name: string, initialRating: number, gender?: "male" | "female") => void;
  readonly onDeletePlayer?: (player: PlayerRecord) => void;
  readonly canManage?: boolean;
}

export function PlayerRoster({
  groupId,
  players,
  isPending = false,
  onAddPlayer,
  onDeletePlayer,
  canManage = true,
}: PlayerRosterProps) {
  type PlayerRosterSortOption = "name_asc" | "name_desc" | "rating_desc" | "rating_asc" | "games_desc" | "games_asc";
  type PlayerRosterFilterType = "all" | "pinned" | "members" | "guests";
  type PlayerRosterFilterGender = "all" | "male" | "female";

  const pinnedPlayerIds = usePinnedPlayerIds(groupId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<PlayerRosterSortOption>("name_asc");
  const [filterType, setFilterType] = useState<PlayerRosterFilterType>("all");
  const [filterGender, setFilterGender] = useState<PlayerRosterFilterGender>("all");

  const pinnedCount = useMemo(
    () => players.filter((p) => pinnedPlayerIds.has(p.id)).length,
    [players, pinnedPlayerIds],
  );
  const memberCount = useMemo(
    () => players.filter((p) => Boolean(p.accountId)).length,
    [players],
  );
  const guestCount = useMemo(
    () => players.filter((p) => !p.accountId).length,
    [players],
  );
  const hasGenderData = useMemo(
    () => players.some((p) => Boolean(p.gender)),
    [players],
  );

  const filteredAndSortedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = [...players];
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.username && p.username.toLowerCase().includes(q.replace(/^@/, "")))
      );
    }

    if (filterType === "pinned") {
      result = result.filter((p) => pinnedPlayerIds.has(p.id));
    } else if (filterType === "members") {
      result = result.filter((p) => Boolean(p.accountId));
    } else if (filterType === "guests") {
      result = result.filter((p) => !p.accountId);
    }

    if (filterGender !== "all") {
      result = result.filter((p) => p.gender === filterGender);
    }

    const compareFn = (a: PlayerRecord, b: PlayerRecord) => {
      switch (sortOption) {
        case "name_asc":
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        case "name_desc":
          return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
        case "rating_desc":
          return b.rating - a.rating || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        case "rating_asc":
          return a.rating - b.rating || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        case "games_desc":
          return (b.ratedGamesPlayed ?? 0) - (a.ratedGamesPlayed ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        case "games_asc":
          return (a.ratedGamesPlayed ?? 0) - (b.ratedGamesPlayed ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        default:
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
    };

    return sortPlayersWithPinned(result, pinnedPlayerIds, undefined, compareFn);
  }, [players, pinnedPlayerIds, searchQuery, filterType, filterGender, sortOption]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [selectedPreset, setSelectedPreset] = useState("3.5");
  const [customRating, setCustomRating] = useState(false);
  const [customRatingInput, setCustomRatingInput] = useState("3.5");
  const [playerToDelete, setPlayerToDelete] = useState<PlayerRecord | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && onAddPlayer) {
      const dupr = customRating ? parseFloat(customRatingInput) || 3.5 : parseFloat(selectedPreset);
      const elo = duprToElo(dupr);
      onAddPlayer(name.trim(), elo, gender);
      setName("");
      setGender("male");
      setSelectedPreset("3.5");
      setCustomRating(false);
      setCustomRatingInput("3.5");
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
            <label htmlFor="player-gender-select" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Gender
            </label>
            <select
              id="player-gender-select"
              value={gender}
              onChange={(e) => setGender(e.target.value as "male" | "female")}
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-2.5 text-black font-bold shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow cursor-pointer"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
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
              <option value="2.0">Beginner Level (2.0 – 2.499)</option>
              <option value="2.5">Advanced Beginner Level (2.5 – 2.999)</option>
              <option value="3.0">Intermediate Level (3.0 – 3.499)</option>
              <option value="3.5">Advanced Intermediate Level (3.5 – 3.999)</option>
              <option value="4.0">Competitive Level (4.0 – 4.499)</option>
              <option value="4.5">Advanced Competitive Level (4.5 – 4.999)</option>
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
              Enter custom rating (e.g. 5.0+)
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
                  placeholder="e.g. 5.25"
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
      <section className="bg-white border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] text-black space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-black uppercase text-black">Group Roster ({players.length})</h2>
        </div>

        {players.length > 0 && (
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                id="player-roster-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roster by name or @username..."
                aria-label="Search roster"
                className="w-full rounded-lg border-2 border-black bg-white px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none placeholder:text-neutral-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black font-black text-sm cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                <label htmlFor="player-roster-filter" className="text-[10px] font-black uppercase text-neutral-800 shrink-0">
                  Filter:
                </label>
                <select
                  id="player-roster-filter"
                  aria-label="Filter roster"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as PlayerRosterFilterType)}
                  className="w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none cursor-pointer"
                >
                  <option value="all">All ({players.length})</option>
                  <option value="pinned">Pinned ({pinnedCount})</option>
                  <option value="members">Members ({memberCount})</option>
                  <option value="guests">Guests ({guestCount})</option>
                </select>
              </div>

              {hasGenderData && (
                <div className="flex items-center gap-1.5 min-w-[100px]">
                  <label htmlFor="player-roster-gender-filter" className="text-[10px] font-black uppercase text-neutral-800 shrink-0">
                    Gender:
                  </label>
                  <select
                    id="player-roster-gender-filter"
                    aria-label="Filter by gender"
                    value={filterGender}
                    onChange={(e) => setFilterGender(e.target.value as PlayerRosterFilterGender)}
                    className="w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none cursor-pointer"
                  >
                    <option value="all">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                <label htmlFor="player-roster-sort" className="text-[10px] font-black uppercase text-neutral-800 shrink-0">
                  Sort:
                </label>
                <select
                  id="player-roster-sort"
                  aria-label="Sort roster"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as PlayerRosterSortOption)}
                  className="w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none cursor-pointer"
                >
                  <option value="name_asc">Name (A–Z)</option>
                  <option value="name_desc">Name (Z–A)</option>
                  <option value="rating_desc">Rating (High–Low)</option>
                  <option value="rating_asc">Rating (Low–High)</option>
                  <option value="games_desc">Most Games</option>
                  <option value="games_asc">Least Games</option>
                </select>
              </div>
            </div>

            {(searchQuery || filterType !== "all" || filterGender !== "all") && (
              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-700 px-1 pt-0.5">
                <span>
                  Showing {filteredAndSortedPlayers.length} of {players.length} players
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterType("all");
                    setFilterGender("all");
                  }}
                  className="font-black uppercase text-neutral-900 underline hover:text-black cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}

        {filteredAndSortedPlayers.length === 0 ? (
          <div className="rounded-xl border-2 border-black bg-neutral-50 p-4 text-center space-y-2">
            <p className="text-xs font-bold text-neutral-600">
              No players found matching your search or filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterType("all");
                setFilterGender("all");
              }}
              className="text-xs font-black uppercase underline hover:text-black cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="divide-y-2 divide-neutral-100">
            {filteredAndSortedPlayers.map((player) => {
              const isPinned = pinnedPlayerIds.has(player.id);
              return (
                <div key={player.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-black text-black text-base block truncate">
                      {player.name}
                      {player.username ? (
                        <>
                          {" "}
                          (
                          <Link
                            href={`/players/${encodeURIComponent(player.username)}`}
                            className="underline hover:text-black cursor-pointer"
                          >
                            @{player.username}
                          </Link>
                          )
                        </>
                      ) : (
                        ""
                      )}
                      {player.gender && (
                        <span className="ml-2 rounded border border-black/40 bg-neutral-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-neutral-800 align-middle">
                          {player.gender}
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-bold text-neutral-600 block mt-0.5">
                      Rating: {formatDupr(player.rating)} ({getSkillTier(eloToDupr(player.rating)).name}) · {player.ratedGamesPlayed} games played
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => togglePinnedPlayer(groupId, player.id)}
                        aria-label={isPinned ? `Unpin ${player.name}` : `Pin ${player.name} to top`}
                        title={isPinned ? "Unpin player" : "Pin player to top"}
                        data-testid={`pin-player-${player.name}`}
                        className={`p-1.5 rounded-lg border-2 border-black transition-all cursor-pointer shadow-[1px_1px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 shrink-0 ${
                          isPinned
                            ? "bg-black text-[#ccff00] hover:bg-neutral-800"
                            : "bg-white text-neutral-400 hover:text-black hover:bg-neutral-100"
                        }`}
                      >
                        <PinIcon className="w-3.5 h-3.5" filled={isPinned} />
                      </button>
                    )}
                    {!canManage && player.username && (
                      <Link
                        href={`/players/${encodeURIComponent(player.username)}`}
                        className="rounded-lg border-2 border-black bg-white px-2.5 py-1 text-[11px] font-black uppercase text-black shadow-[1.5px_1.5px_0px_0px_#000] hover:bg-[#ccff00] active:translate-x-0.5 active:translate-y-0.5 transition-transform shrink-0"
                      >
                        View profile
                      </Link>
                    )}
                    {showDelete && (
                      <button
                        type="button"
                        onClick={() => setPlayerToDelete(player)}
                        disabled={isPending}
                        className="text-xs font-black uppercase text-rose-600 hover:text-rose-800 hover:underline cursor-pointer ml-1"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
          !playerToDelete?.accountId ? (
            `Are you sure you want to remove "${playerToDelete?.name}"? They have played ${playerToDelete?.ratedGamesPlayed ?? 0} ${(playerToDelete?.ratedGamesPlayed ?? 0) === 1 ? "game" : "games"}.`
          ) : (
            <>
              Are you sure you want to delete <span className="font-black text-black">{playerToDelete?.name}</span> from the roster?
            </>
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        disabled={isPending}
      />
    </div>
  );
}
