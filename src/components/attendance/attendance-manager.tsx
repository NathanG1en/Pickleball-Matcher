"use client";

import type { StayTogetherPair } from "@/lib/matchmaking/types";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCourtRebalanceChoices, type CourtChoice } from "@/lib/matchmaking/court-rebalance";
import { SetupCourtIllustration } from "@/components/attendance/setup-court-illustration";
import { Button } from "@/components/ui/button";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { RatingSlider } from "@/components/ui/rating-slider";
import { ChevronDownIcon, PinIcon, SearchIcon } from "@/components/ui/icons";
import { formatDupr } from "@/lib/domain/rating-display";
import {
  sortPlayersWithPinned,
  togglePinnedPlayer,
  usePinnedPlayerIds,
} from "@/lib/storage/pinned-players";

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
  readonly submitLabel?: string;
  readonly initialAddGuestOpen?: boolean;
  readonly onSubmit?: (data: { courtCount: number; courtPlayerCounts: (2 | 3 | 4)[]; selectedPlayerIds: string[]; stayTogetherPairs: readonly StayTogetherPair[] }) => void;
  readonly onAddGuest?: (name: string, initialRating?: number, gender?: "male" | "female") => void;
}

export function AttendanceManager({
  groupId,
  players,
  selectedPlayerIds: initialSelected = [],
  courtCount: initialCourts,
  maxCourts = 6,
  isEditingSession = false,
  isPending = false,
  submitLabel,
  initialAddGuestOpen = false,
  onSubmit,
  onAddGuest,
}: AttendanceManagerProps) {
  const pinnedPlayerIds = usePinnedPlayerIds(groupId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelected.length > 0 ? initialSelected : players.map((p) => p.id)),
  );

  const sortedPlayers = useMemo(
    () => sortPlayersWithPinned(players, pinnedPlayerIds),
    [players, pinnedPlayerIds],
  );

  const displayedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedPlayers;
    return sortedPlayers.filter((p) => p.name.toLowerCase().includes(q));
  }, [sortedPlayers, searchQuery]);

  const pinnedCount = useMemo(
    () => players.filter((p) => pinnedPlayerIds.has(p.id)).length,
    [players, pinnedPlayerIds],
  );
  const initialSelectedCount = initialSelected.length || players.length;
  const initialIdealCourts = Math.min(
    maxCourts,
    Math.max(1, Math.floor(initialSelectedCount / 4) + (initialSelectedCount % 4 >= 2 ? 1 : 0))
  );
  const defaultCourtCount = (() => {
    if (initialCourts !== undefined) {
      if (initialSelectedCount >= initialCourts * 4 + 2) {
        return Math.min(maxCourts, Math.max(initialCourts + 1, initialIdealCourts));
      }
      return Math.min(maxCourts, Math.max(1, initialCourts));
    }
    return initialIdealCourts;
  })();

  const [courts, setCourts] = useState<number>(defaultCourtCount);
  const [courtPlayerCounts, setCourtPlayerCounts] = useState<(2 | 3 | 4)[]>(() => {
    let remaining = initialSelectedCount;
    return Array.from({ length: defaultCourtCount }, (_, idx) => {
      const courtsLeft = defaultCourtCount - idx - 1;
      const minNeededLater = courtsLeft * 2;
      const maxPossibleLater = courtsLeft * 4;
      const minThis = Math.max(2, remaining - maxPossibleLater);
      const maxThis = Math.min(4, remaining - minNeededLater);
      const size = Math.min(4, Math.max(2, Math.max(minThis, Math.min(4, maxThis)))) as 2 | 3 | 4;
      remaining -= size;
      return size;
    });
  });
  const [guestName, setGuestName] = useState<string>("");
  const [guestGender, setGuestGender] = useState<"male" | "female">("male");
  const [guestRating, setGuestRating] = useState<number>(3.5);
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(initialAddGuestOpen);

  const [stayTogetherPairs, setStayTogetherPairs] = useState<readonly StayTogetherPair[]>([]);

  const handlePlayerCountChange = (newSelectedIds: Set<string>) => {
    const newCount = newSelectedIds.size;
    setSelectedIds(newSelectedIds);

    // Automatically add court if there are at least 2 more people than the current courts allow
    if (newCount >= courts * 4 + 2 && courts < Math.min(maxCourts, Math.floor(newCount / 2))) {
      const ideal = Math.floor(newCount / 4) + (newCount % 4 >= 2 ? 1 : 0);
      const targetCourts = Math.min(
        Math.min(maxCourts, Math.floor(newCount / 2)),
        Math.max(courts + 1, ideal)
      );
      setCourts(targetCourts);
      setCourtPlayerCounts(() => {
        let remaining = newCount;
        return Array.from({ length: targetCourts }, (_, idx) => {
          const courtsLeft = targetCourts - idx - 1;
          const minNeededLater = courtsLeft * 2;
          const maxPossibleLater = courtsLeft * 4;
          const minThis = Math.max(2, remaining - maxPossibleLater);
          const maxThis = Math.min(4, remaining - minNeededLater);
          const size = Math.min(4, Math.max(2, Math.max(minThis, Math.min(4, maxThis)))) as 2 | 3 | 4;
          remaining -= size;
          return size;
        });
      });
    } else if (courts > Math.max(1, Math.floor(newCount / 2))) {
      const targetCourts = Math.max(1, Math.floor(newCount / 2));
      setCourts(targetCourts);
      setCourtPlayerCounts((prev) => prev.slice(0, targetCourts));
    }
  };

  const prevPlayersRef = useRef(players);
  useEffect(() => {
    if (players.length > prevPlayersRef.current.length) {
      const prevIds = new Set(prevPlayersRef.current.map((p) => p.id));
      const newPlayerIds = players.filter((p) => !prevIds.has(p.id)).map((p) => p.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of newPlayerIds) next.add(id);
        const newCount = next.size;
        if (newCount >= courts * 4 + 2 && courts < Math.min(maxCourts, Math.floor(newCount / 2))) {
          const ideal = Math.floor(newCount / 4) + (newCount % 4 >= 2 ? 1 : 0);
          const targetCourts = Math.min(
            Math.min(maxCourts, Math.floor(newCount / 2)),
            Math.max(courts + 1, ideal)
          );
          setCourts(targetCourts);
          setCourtPlayerCounts(() => {
            let remaining = newCount;
            return Array.from({ length: targetCourts }, (_, idx) => {
              const courtsLeft = targetCourts - idx - 1;
              const minNeededLater = courtsLeft * 2;
              const maxPossibleLater = courtsLeft * 4;
              const minThis = Math.max(2, remaining - maxPossibleLater);
              const maxThis = Math.min(4, remaining - minNeededLater);
              const size = Math.min(4, Math.max(2, Math.max(minThis, Math.min(4, maxThis)))) as 2 | 3 | 4;
              remaining -= size;
              return size;
            });
          });
        }
        return next;
      });
    }
    prevPlayersRef.current = players;
  }, [players, courts, maxCourts]);

  const togglePlayer = (id: string) => {
    if (selectedIds.has(id)) setStayTogetherPairs((pairs) => pairs.filter((pair) => !pair.includes(id)));
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    handlePlayerCountChange(next);
  };

  const selectAll = () => {
    handlePlayerCountChange(new Set(players.map((p) => p.id)));
  };

  const clearAll = () => {
    setStayTogetherPairs([]);
    setSelectedIds(new Set());
  };

  const decreaseCourts = () => {
    if (courts > 1) {
      const nextCourts = courts - 1;
      setCourts(nextCourts);
      setCourtPlayerCounts((previous) => {
        if (nextCourts * 4 <= count) {
          return Array.from({ length: nextCourts }, () => 4 as const);
        }
        return previous.slice(0, nextCourts);
      });
    }
  };

  const increaseCourts = () => {
    if (courts < Math.min(maxCourts, Math.floor(count / 2))) {
      const nextCourts = courts + 1;
      setCourts(nextCourts);
      setCourtPlayerCounts((previous) => {
        const currentCapacity = previous.slice(0, courts).reduce((sum, s) => sum + s, 0);
        const rem = count - currentCapacity;
        const nextSize: 2 | 3 | 4 = rem >= 4 ? 4 : rem >= 3 ? 3 : 2;
        return [...previous.slice(0, courts), nextSize];
      });
    }
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const nameToAdd = guestName.trim();
    if (nameToAdd && onAddGuest) {
      const ratingToAdd = guestRating;
      const genderToAdd = guestGender;
      setGuestName("");
      setGuestGender("male");
      setGuestRating(3.5);
      onAddGuest(nameToAdd, ratingToAdd, genderToAdd);
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        courtCount: courts,
        courtPlayerCounts: courtPlayerCounts.slice(0, courts),
        selectedPlayerIds: Array.from(selectedIds),
        stayTogetherPairs,
      });
    }
  };

  const count = selectedIds.size;
  const capacity = courtPlayerCounts.slice(0, courts).reduce((sum, size) => sum + size, 0);
  const sittingCount = Math.max(0, count - capacity);

  const rebalanceChoices = useMemo(() => {
    return getCourtRebalanceChoices(count, courts, maxCourts);
  }, [count, courts, maxCourts]);

  const currentCourts = courtPlayerCounts.slice(0, courts);
  const isChoiceCurrent = (choice: CourtChoice) =>
    choice.courtCount === courts &&
    choice.courts.length === currentCourts.length &&
    choice.courts.every((s, i) => s === currentCourts[i]);

  return (
    <div className="attendance-manager space-y-6 pb-28 text-black">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Court Count Card (Left column on desktop) */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-6">
          <section className="bg-[#FFFDF7] border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
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
                onClick={decreaseCourts}
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
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {courtPlayerCounts.slice(0, courts).map((size, index) => (
                <div key={index} className="flex items-center justify-between gap-1.5 rounded-xl border-2 border-black p-2 sm:p-2.5 font-bold bg-[#FFFDF7] shadow-[2px_2px_0px_0px_#000]">
                  <span className="text-xs font-black uppercase tracking-wide text-neutral-900 shrink-0">Court {index + 1}</span>
                  <CustomDropdown
                    ariaLabel={`Players on court ${index + 1}`}
                    value={String(size)}
                    onChange={(val) => setCourtPlayerCounts((previous) => previous.map((value, item) => item === index ? Number(val) as 2 | 3 | 4 : value))}
                    align="right"
                    options={[
                      { value: "4", label: "4 players · 2v2" },
                      { value: "3", label: "3 players · 2v1" },
                      { value: "2", label: "2 players · 1v1" },
                    ]}
                    sizeVariant="xs"
                    className="min-w-0 flex-1 max-w-[155px]"
                    buttonClassName="w-full justify-between rounded-lg shadow-[1px_1px_0px_0px_#000] py-1 px-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
            {rebalanceChoices.length > 1 && (
              <div className="mt-4 p-3 bg-neutral-100 rounded-xl border-2 border-black space-y-2">
                <span className="text-xs font-black uppercase text-neutral-700 block">
                  {count % 2 !== 0 ? `Odd Count Options (${count} Players):` : `Quick Presets (${count} Players):`}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rebalanceChoices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => {
                        setCourts(choice.courtCount);
                        setCourtPlayerCounts(choice.courts);
                      }}
                      data-testid={`setup-preset-${choice.id}`}
                      className={`px-3 py-2 rounded-lg border-2 border-black text-left cursor-pointer transition-all ${
                        isChoiceCurrent(choice)
                          ? "bg-[#ccff00] text-black shadow-[2px_2px_0px_0px_#000]"
                          : "bg-white text-neutral-800 hover:bg-neutral-50 shadow-[1px_1px_0px_0px_#000]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-black uppercase">{choice.title}</span>
                        <span className="text-[10px] font-black">{choice.badge}</span>
                      </div>
                      <span className="text-[11px] font-bold text-neutral-600 block">{choice.summary}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sittingCount > 0 && <p className="mt-3 rounded-lg border border-amber-800 bg-amber-100 px-3 py-2 text-sm font-bold text-amber-950">{sittingCount} {sittingCount === 1 ? "player" : "players"} will sit out each round.</p>}
          </section>
        </div>

        {/* Players Section (Right column on desktop) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6">
          <section className="bg-[#FFFDF7] border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
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

        {/* Search & Filter Bar */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
              <SearchIcon className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players by name..."
              aria-label="Search players"
              data-testid="attendance-player-search"
              className="w-full pl-9 pr-8 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs sm:text-sm font-bold text-black placeholder-neutral-400 shadow-[2px_2px_0px_0px_#000] focus:bg-white focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-shadow"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear player search"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-black text-neutral-500 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          {pinnedCount > 0 && (
            <div
              data-testid="attendance-pinned-badge"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 border-black bg-neutral-100 text-xs font-black text-black shrink-0 shadow-[1px_1px_0px_0px_#000]"
            >
              <PinIcon className="w-3.5 h-3.5" filled />
              <span>{pinnedCount} Pinned</span>
            </div>
          )}
        </div>

        {/* Player Roster Grid */}
        {displayedPlayers.length === 0 ? (
          <div className="p-6 text-center rounded-xl border-2 border-dashed border-neutral-300">
            <p className="text-sm font-bold text-neutral-500">
              No players match &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-2 text-xs font-black uppercase text-black underline cursor-pointer"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {displayedPlayers.map((player) => {
              const isSelected = selectedIds.has(player.id);
              const isPinned = pinnedPlayerIds.has(player.id);
              return (
                <label
                  key={player.id}
                  htmlFor={`player-check-${player.id}`}
                  data-testid={`player-card-${player.name}`}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                    isSelected
                      ? "bg-[#ccff00] border-black text-black shadow-[3px_3px_0px_0px_#000]"
                      : "bg-[#FFFDF7] border-neutral-300 text-neutral-700 hover:border-black"
                  }`}
                >
                  <input
                    id={`player-check-${player.id}`}
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePlayer(player.id)}
                    className="w-5 h-5 rounded border-2 border-black accent-black cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-base truncate">{player.name}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-neutral-600 shrink-0">
                    {formatDupr(player.rating)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      togglePinnedPlayer(groupId, player.id);
                    }}
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
                </label>
              );
            })}
          </div>
        )}

        {/* Add Guest / Quick Player Form */}
        <div className="mt-4 pt-4 border-t-2 border-neutral-100">
          <button
            type="button"
            onClick={() => setIsAddGuestOpen((prev) => !prev)}
            aria-expanded={isAddGuestOpen}
            aria-controls="normal-session-add-guest-form"
            data-testid="toggle-add-guest"
            className="w-full flex items-center justify-between text-left cursor-pointer group py-1"
          >
            <span className="block text-xs font-black uppercase tracking-wider text-black group-hover:text-neutral-700">
              Add Guest Player
            </span>
            <ChevronDownIcon
              className={`h-4 w-4 text-black transform transition-transform duration-200 shrink-0 ${
                isAddGuestOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {isAddGuestOpen && (
            <form id="normal-session-add-guest-form" onSubmit={handleAddGuest} className="mt-3 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  aria-label="Guest player name"
                  placeholder="Add guest or new player..."
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="flex-1 bg-white border-2 border-black rounded-xl px-3.5 py-2 text-black font-bold placeholder-neutral-400 text-sm shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow"
                />
                <CustomDropdown
                  id="normal-session-guest-gender"
                  ariaLabel="Guest Gender"
                  value={guestGender}
                  onChange={(val) => setGuestGender(val as "male" | "female")}
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                  sizeVariant="sm"
                  className="shrink-0"
                />
                <button
                  type="submit"
                  disabled={!guestName.trim()}
                  className="px-5 py-2 rounded-xl border-2 border-black bg-[#ccff00] text-black hover:bg-[#b8e600] text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 cursor-pointer shrink-0 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="bg-neutral-50 border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#000]">
                <RatingSlider
                  id="normal-session-guest-rating"
                  dataTestId="normal-session-guest-rating"
                  label="Guest Rating"
                  value={guestRating}
                  onChange={setGuestRating}
                  showDescription={true}
                />
              </div>
            </form>
          )}
        </div>
      </section>
        </div>
      </div>

      {/* Sticky Mobile Action Bar */}
      <div className="mobile-action-bar sticky bottom-0 left-0 right-0 p-4 bg-[#FFFDF7]/95 backdrop-blur-md border-t-[3px] border-black z-40 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.06)]">
        <div className="max-w-xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center justify-between gap-4">
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
            data-testid="continue-to-pairings-button"
            className="flex-1 max-w-xs font-display text-lg tracking-wide uppercase"
          >
            {isPending
              ? "Saving..."
              : isEditingSession
              ? "Update Attendance"
              : submitLabel ?? "Continue to Pairings →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
