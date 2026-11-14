"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Button, ConfirmDialog, Input, Label, CustomDropdown } from "@/components/ui";
import { formatDupr, duprToElo } from "@/lib/domain/rating-display";
import type { PlayerRecord } from "@/lib/domain/types";
import { PinIcon, ChevronRightIcon } from "@/components/ui/icons";
import { parseProfileVisibilitySettings } from "@/lib/privacy/profile-visibility";
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
  readonly currentAccountId?: string | null;
  readonly isGroupMember?: boolean;
}

export function PlayerRoster({
  groupId,
  players,
  isPending = false,
  onAddPlayer,
  onDeletePlayer,
  canManage = true,
  currentAccountId,
  isGroupMember = true,
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
  const canViewPlayerDetails = useCallback((player: PlayerRecord) => {
    if (!player.accountId) {
      return true;
    }
    if (currentAccountId && currentAccountId === player.accountId) {
      return true;
    }
    const visibility = parseProfileVisibilitySettings(player.visibilitySettings, player.isPublic ?? true);
    if (player.isPublic === false || visibility.profile === "only_you" || visibility.ratingStats === "only_you") {
      return false;
    }
    if ((visibility.profile === "group_members" || visibility.ratingStats === "group_members") && !isGroupMember) {
      return false;
    }
    return true;
  }, [currentAccountId, isGroupMember]);

  const hasGenderData = useMemo(
    () => players.some((p) => canViewPlayerDetails(p) && Boolean(p.gender)),
    [players, canViewPlayerDetails],
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
      result = result.filter((p) => canViewPlayerDetails(p) && p.gender === filterGender);
    }

    const compareFn = (a: PlayerRecord, b: PlayerRecord) => {
      switch (sortOption) {
        case "name_asc":
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        case "name_desc":
          return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
        case "rating_desc": {
          const aCan = canViewPlayerDetails(a);
          const bCan = canViewPlayerDetails(b);
          if (!aCan && !bCan) return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          if (!aCan) return 1;
          if (!bCan) return -1;
          return b.rating - a.rating || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        case "rating_asc": {
          const aCan = canViewPlayerDetails(a);
          const bCan = canViewPlayerDetails(b);
          if (!aCan && !bCan) return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          if (!aCan) return 1;
          if (!bCan) return -1;
          return a.rating - b.rating || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        case "games_desc": {
          const aCan = canViewPlayerDetails(a);
          const bCan = canViewPlayerDetails(b);
          if (!aCan && !bCan) return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          if (!aCan) return 1;
          if (!bCan) return -1;
          return (b.ratedGamesPlayed ?? 0) - (a.ratedGamesPlayed ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        case "games_asc": {
          const aCan = canViewPlayerDetails(a);
          const bCan = canViewPlayerDetails(b);
          if (!aCan && !bCan) return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          if (!aCan) return 1;
          if (!bCan) return -1;
          return (a.ratedGamesPlayed ?? 0) - (b.ratedGamesPlayed ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        default:
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
    };

    return sortPlayersWithPinned(result, pinnedPlayerIds, undefined, compareFn);
  }, [players, pinnedPlayerIds, searchQuery, filterType, filterGender, sortOption, canViewPlayerDetails]);
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
        <section className="bg-[#FFFDF7] border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] text-black">
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
            <CustomDropdown
              id="player-gender-select"
              ariaLabel="Gender"
              value={gender}
              onChange={(val) => setGender(val as "male" | "female")}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
              sizeVariant="md"
              className="w-full"
              buttonClassName="w-full justify-between"
            />
          </div>

          <div>
            <label htmlFor="player-rating-select" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Initial Skill Level
            </label>
            <CustomDropdown
              id="player-rating-select"
              ariaLabel="Initial Skill Level"
              value={selectedPreset}
              disabled={customRating}
              onChange={(val) => {
                setSelectedPreset(val);
                if (!customRating) setCustomRatingInput(val);
              }}
              options={[
                { value: "2.0", label: "Beginner Level (2.0 – 2.499)" },
                { value: "2.5", label: "Advanced Beginner Level (2.5 – 2.999)" },
                { value: "3.0", label: "Intermediate Level (3.0 – 3.499)" },
                { value: "3.5", label: "Advanced Intermediate Level (3.5 – 3.999)" },
                { value: "4.0", label: "Competitive Level (4.0 – 4.499)" },
                { value: "4.5", label: "Advanced Competitive Level (4.5 – 4.999)" },
              ]}
              sizeVariant="md"
              className="w-full"
              buttonClassName="w-full justify-between"
            />

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
      <section className="bg-[#FFFDF7] border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] text-black space-y-4">
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
              <div className="flex items-center gap-1.5">
                <label htmlFor="player-roster-filter" className="sr-only sm:not-sr-only text-[10px] font-black uppercase text-neutral-800 shrink-0">
                  Filter:
                </label>
                <CustomDropdown
                  id="player-roster-filter"
                  ariaLabel="Filter roster"
                  value={filterType}
                  onChange={(val) => setFilterType(val as PlayerRosterFilterType)}
                  options={[
                    { value: "all", label: `All (${players.length})` },
                    { value: "pinned", label: `Pinned (${pinnedCount})` },
                    { value: "members", label: `Members (${memberCount})` },
                    { value: "guests", label: `Guests (${guestCount})` },
                  ]}
                  sizeVariant="xs"
                />
              </div>

              {hasGenderData && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="player-roster-gender-filter" className="sr-only sm:not-sr-only text-[10px] font-black uppercase text-neutral-800 shrink-0">
                    Gender:
                  </label>
                  <CustomDropdown
                    id="player-roster-gender-filter"
                    ariaLabel="Filter by gender"
                    value={filterGender}
                    onChange={(val) => setFilterGender(val as PlayerRosterFilterGender)}
                    options={[
                      { value: "all", label: "All Genders" },
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                    ]}
                    sizeVariant="xs"
                  />
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <label htmlFor="player-roster-sort" className="sr-only sm:not-sr-only text-[10px] font-black uppercase text-neutral-800 shrink-0">
                  Sort:
                </label>
                <CustomDropdown
                  id="player-roster-sort"
                  ariaLabel="Sort roster"
                  value={sortOption}
                  onChange={(val) => setSortOption(val as PlayerRosterSortOption)}
                  options={[
                    { value: "name_asc", label: "Name (A–Z)" },
                    { value: "name_desc", label: "Name (Z–A)" },
                    { value: "rating_desc", label: "Rating (High–Low)" },
                    { value: "rating_asc", label: "Rating (Low–High)" },
                    { value: "games_desc", label: "Most Games" },
                    { value: "games_asc", label: "Least Games" },
                  ]}
                  sizeVariant="xs"
                  align="right"
                />
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
          <div className="rounded-xl border-2 border-black bg-[#FFFDF7] divide-y-2 divide-neutral-200 px-3.5 shadow-[4px_4px_0px_0px_#171717]">
            {filteredAndSortedPlayers.map((player) => {
              const isPinned = pinnedPlayerIds.has(player.id);
              return (
                <div key={player.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Line 1: Name and Username */}
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="truncate text-base font-black text-black">
                        {player.name}
                      </span>
                      {player.username && (
                        <Link
                          href={`/players/${encodeURIComponent(player.username)}`}
                          className="truncate text-xs font-bold text-neutral-500 hover:text-black hover:underline cursor-pointer shrink"
                        >
                          @{player.username}
                        </Link>
                      )}
                    </div>

                    {/* Line 2: Unified Muted Metadata Subline */}
                    {canViewPlayerDetails(player) ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 flex-wrap mt-1">
                        <span>
                          <span className="hidden sm:inline">Rating: </span>
                          {formatDupr(player.rating)}
                        </span>
                        {player.gender && (
                          <>
                            <span aria-hidden="true" className="text-neutral-400">·</span>
                            <span className="uppercase text-[11px] font-bold text-neutral-600">
                              <span className="sm:hidden">{player.gender === "male" ? "M" : player.gender === "female" ? "F" : player.gender}</span>
                              <span className="hidden sm:inline">{player.gender}</span>
                            </span>
                          </>
                        )}
                        <span aria-hidden="true" className="text-neutral-400">·</span>
                        <span>
                          {player.ratedGamesPlayed} {player.ratedGamesPlayed === 1 ? "game" : "games"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 flex-wrap mt-1">
                        <span>
                          {player.ratedGamesPlayed} {player.ratedGamesPlayed === 1 ? "game" : "games"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="w-[70px] shrink-0 flex items-center justify-end gap-1.5">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => togglePinnedPlayer(groupId, player.id)}
                        aria-label={isPinned ? `Unpin ${player.name}` : `Pin ${player.name} to top`}
                        title={isPinned ? "Unpin player" : "Pin player to top"}
                        data-testid={`pin-player-${player.name}`}
                        className={`w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center transition-all cursor-pointer shadow-[1.5px_1.5px_0px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shrink-0 ${
                          isPinned
                            ? "bg-black text-[#ccff00] hover:bg-neutral-800"
                            : "bg-[#FFFDF7] text-neutral-400 hover:text-black hover:bg-[#ccff00]"
                        }`}
                      >
                        <PinIcon className="w-3.5 h-3.5" filled={isPinned} />
                      </button>
                    )}
                    {!canManage && player.username && (
                      <Link
                        href={`/players/${encodeURIComponent(player.username)}`}
                        aria-label="View profile"
                        title="View profile"
                        className="p-1.5 text-black hover:translate-x-0.5 transition-transform cursor-pointer shrink-0"
                      >
                        <span className="sr-only">View profile</span>
                        <ChevronRightIcon className="w-5 h-5 stroke-[2.5]" />
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
