"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addGroupOrganizerAction,
  addGroupPlayerByUsernameAction,
  removeGroupOrganizerAction,
  removeGroupPlayerAction,
  transferGroupHostAction,
} from "@/app/actions/group-organizers";
import {
  searchPlayersByUsernameAction,
  addPlayerByAccountIdAction,
  createPlayerAction,
  type SearchPlayerResult,
} from "@/app/actions/players";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import type { GroupOrganizerRecord, PlayerRecord } from "@/lib/domain/types";
import { LinkGuestModal } from "./link-guest-modal";
import { EditGuestModal } from "./edit-guest-modal";
import { MergeGuestModal } from "./merge-guest-modal";
import { ConfirmGroupNameModal } from "./confirm-group-name-modal";
import { ConfirmDialog, RatingSlider } from "@/components/ui";
import { formatDupr, eloToDupr, getSkillTier } from "@/lib/domain/rating-display";
import {
  SearchIcon,
  UserPlusIcon,
  LockIcon,
  HandshakeIcon,
  CheckIcon,
  PinIcon,
} from "@/components/ui/icons";
import {
  usePinnedPlayerIds,
  togglePinnedPlayer,
  sortPlayersWithPinned,
} from "@/lib/storage/pinned-players";

export function getRemoveGuestConfirmationMessage(name: string, gamesPlayed: number): string {
  return `Are you sure you want to remove "${name}"? They have played ${gamesPlayed} ${gamesPlayed === 1 ? "game" : "games"}.`;
}

export function GroupOrganizersPanel({
  groupId,
  groupName = "",
  players,
  organizers,
  isHost,
  isOrganizer = false,
}: {
  groupId: string;
  groupName?: string;
  players: readonly PlayerRecord[];
  organizers: readonly GroupOrganizerRecord[];
  isHost: boolean;
  isOrganizer?: boolean;
}) {
  const router = useRouter();
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);
  const [linkingPlayer, setLinkingPlayer] = useState<PlayerRecord | null>(null);
  const [editingGuest, setEditingGuest] = useState<PlayerRecord | null>(null);
  const [mergingGuest, setMergingGuest] = useState<PlayerRecord | null>(null);
  const [guestToRemove, setGuestToRemove] = useState<PlayerRecord | null>(null);
  const [transferTarget, setTransferTarget] = useState<PlayerRecord | null>(null);
  const [transferPending, setTransferPending] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  type RosterSortOption = "name_asc" | "name_desc" | "rating_desc" | "rating_asc" | "games_desc" | "games_asc";
  type RosterFilterType = "all" | "pinned" | "organizers" | "members" | "guests";
  type RosterFilterGender = "all" | "male" | "female";

  const pinnedPlayerIds = usePinnedPlayerIds(groupId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<RosterSortOption>("name_asc");
  const [filterType, setFilterType] = useState<RosterFilterType>("all");
  const [filterGender, setFilterGender] = useState<RosterFilterGender>("all");

  const pinnedCount = useMemo(
    () => players.filter((p) => pinnedPlayerIds.has(p.id)).length,
    [players, pinnedPlayerIds],
  );
  const organizerCount = useMemo(
    () => players.filter((p) => p.accountId && organizers.some((o) => o.accountId === p.accountId)).length,
    [players, organizers],
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
    const seen = new Set<string>();
    const uniquePlayers = players.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const q = searchQuery.trim().toLowerCase();
    let result = uniquePlayers;
    if (q) {
      result = result.filter((p) => {
        const organizer = p.accountId ? organizers.find((o) => o.accountId === p.accountId) : undefined;
        const uName = p.username || organizer?.username || "";
        return (
          p.name.toLowerCase().includes(q) ||
          uName.toLowerCase().includes(q.replace(/^@/, ""))
        );
      });
    }

    if (filterType === "pinned") {
      result = result.filter((p) => pinnedPlayerIds.has(p.id));
    } else if (filterType === "organizers") {
      result = result.filter((p) => p.accountId && organizers.some((o) => o.accountId === p.accountId));
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
  }, [players, organizers, pinnedPlayerIds, searchQuery, filterType, filterGender, sortOption]);

  // Mode switch: "search" | "guest"
  const [addMode, setAddMode] = useState<"search" | "guest">("search");
  const [isAddOpen, setIsAddOpen] = useState(true);

  // Search mode state
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState<readonly SearchPlayerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHasRun, setSearchHasRun] = useState(false);
  const [addingAccountId, setAddingAccountId] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  // Guest mode state
  const [guestName, setGuestName] = useState("");
  const [guestGender, setGuestGender] = useState<"male" | "female">("male");
  const [guestRating, setGuestRating] = useState<number>(3.5);
  const [guestSaving, setGuestSaving] = useState(false);

  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [rosterMessage, setRosterMessage] = useState<string | null>(null);

  // Live search for public users as user types
  useEffect(() => {
    const trimmed = username.replace(/^@/, "").trim();
    if (trimmed.length < 2) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchPlayersByUsernameAction({ query: trimmed, groupId });
        if (!cancelled) {
          if (res.ok) {
            setSearchResults(res.data);
          } else {
            setSearchResults([]);
          }
          setSearchHasRun(true);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
          setSearchHasRun(true);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, groupId]);

  const closeAllMenus = () => {
    document.querySelectorAll<HTMLDetailsElement>("details[data-player-menu][open]").forEach((el) => {
      el.removeAttribute("open");
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const openDetails = document.querySelectorAll<HTMLDetailsElement>("details[data-player-menu][open]");
      openDetails.forEach((el) => {
        if (!el.contains(event.target as Node)) {
          el.removeAttribute("open");
        }
      });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAllMenus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleAddSearchedPlayer = async (accountId: string) => {
    setAddingAccountId(accountId);
    setAddMessage(null);
    try {
      const res = await addPlayerByAccountIdAction({ groupId, accountId });
      if (res.ok) {
        setAddMessage("Player added to the roster.");
        setUsername("");
        setSearchResults([]);
        router.refresh();
      } else {
        setAddMessage(res.error ?? "Failed to add player.");
      }
    } catch {
      setAddMessage("Failed to add player.");
    } finally {
      setAddingAccountId(null);
    }
  };

  const handleAddGuest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = guestName.trim();
    if (!trimmed || guestSaving) return;
    setGuestSaving(true);
    setAddMessage(null);
    const ratingToAdd = guestRating;
    setGuestRating(3.5);
    try {
      const res = await createPlayerAction({
        groupId,
        name: trimmed,
        gender: guestGender,
        initialRating: ratingToAdd,
        idempotencyKey: createIdempotencyKey("guest_add"),
      });
      if (res.ok) {
        setAddMessage(`Guest player "${trimmed}" added to the roster.`);
        setGuestName("");
        setGuestGender("male");
        router.refresh();
      } else {
        setAddMessage(res.error ?? "Failed to add guest player.");
      }
    } catch {
      setAddMessage("Failed to add guest player.");
    } finally {
      setGuestSaving(false);
    }
  };

  const addPlayerByUsername = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = username.replace(/^@/, "").trim();
    if (!clean) return;

    setLookupPending(true);
    setAddMessage(null);

    const matching = searchResults.find(
      (r) => r.username.toLowerCase() === clean.toLowerCase()
    );
    if (matching) {
      if (matching.alreadyInGroup) {
        setAddMessage("Player is already on the roster.");
        setLookupPending(false);
        return;
      }
      await handleAddSearchedPlayer(matching.accountId);
      setLookupPending(false);
      return;
    }

    const result = await addGroupPlayerByUsernameAction({ groupId, username: clean });
    setAddMessage(result.ok ? "Player added to the roster." : result.error ?? "Unable to find that player.");
    if (result.ok) {
      setUsername("");
      setSearchResults([]);
      router.refresh();
    }
    setLookupPending(false);
  };

  const makeOrganizer = async (playerId: string) => {
    closeAllMenus();
    setPendingPlayerId(playerId);
    setRosterMessage(null);
    const result = await addGroupOrganizerAction({ groupId, playerId });
    setRosterMessage(result.ok ? "Player is now a group organizer." : result.error ?? "Unable to add organizer.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  const removeOrganizer = async (playerId: string) => {
    closeAllMenus();
    setPendingPlayerId(playerId);
    setRosterMessage(null);
    const result = await removeGroupOrganizerAction({ groupId, playerId });
    setRosterMessage(result.ok ? "Player is no longer a group organizer." : result.error ?? "Unable to remove organizer.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  const removePlayer = async (playerId: string) => {
    closeAllMenus();
    setPendingPlayerId(playerId);
    setRosterMessage(null);
    const result = await removeGroupPlayerAction({ groupId, playerId });
    setRosterMessage(result.ok ? "Player removed from the group." : result.error ?? "Unable to remove player.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  const handleTransferHost = async (confirmationName: string) => {
    if (!transferTarget) return;
    setTransferPending(true);
    setTransferError(null);
    try {
      const res = await transferGroupHostAction({
        groupId,
        playerId: transferTarget.id,
        confirmationName,
      });
      if (res.ok) {
        setRosterMessage(`Host privileges transferred to ${transferTarget.name}.`);
        setTransferTarget(null);
        router.refresh();
      } else {
        setTransferError(res.error ?? "Failed to transfer host privileges.");
      }
    } catch {
      setTransferError("Failed to transfer host privileges.");
    } finally {
      setTransferPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Player / Guest Section */}
      {(isHost || isOrganizer) && (
        <section
          aria-label="Add to roster"
          className="space-y-3 rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_#000]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-black bg-[#ccff00] shadow-[1px_1px_0px_0px_#000]">
                <UserPlusIcon className="h-4 w-4 text-black" />
              </div>
              <div>
                <h2 className="font-display text-lg font-black uppercase text-black">Add to Roster</h2>
                <p className="text-xs font-semibold text-neutral-600">
                  Find players by username or add guest players.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAddOpen((prev) => !prev)}
              aria-expanded={isAddOpen}
              aria-label={isAddOpen ? "Collapse add to roster" : "Expand add to roster"}
              className="rounded-lg border-2 border-black bg-neutral-100 px-2.5 py-1 text-[11px] font-black uppercase text-black shadow-[1px_1px_0px_0px_#000] hover:bg-neutral-200 active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer shrink-0"
            >
              {isAddOpen ? "Collapse" : "Expand"}
            </button>
          </div>

          {isAddOpen && (
            <div className="space-y-3 pt-1 border-t-2 border-neutral-100">
              {/* Mode Switch Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-100 border border-neutral-200 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode("search");
                    setAddMessage(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                    addMode === "search"
                      ? "bg-black text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.4)]"
                      : "text-neutral-800 hover:bg-black/10"
                  }`}
                >
                  <SearchIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Find Player</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMode("guest");
                    setAddMessage(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                    addMode === "guest"
                      ? "bg-black text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.4)]"
                      : "text-neutral-800 hover:bg-black/10"
                  }`}
                >
                  <UserPlusIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Add Guest</span>
                </button>
              </div>

          {addMode === "search" ? (
            <div className="relative">
              <form onSubmit={addPlayerByUsername} className="flex gap-2">
                <label htmlFor="roster-player-username" className="sr-only">Look up player by username</label>
                <div className="relative flex-1">
                  <input
                    id="roster-player-username"
                    required
                    minLength={2}
                    maxLength={24}
                    value={username}
                    onChange={(event) => {
                      const val = event.target.value;
                      setUsername(val);
                      if (addMessage) setAddMessage(null);
                      if (val.replace(/^@/, "").trim().length < 2) {
                        setSearchResults([]);
                        setSearchHasRun(false);
                        setIsSearching(false);
                      }
                    }}
                    placeholder="Find player by username"
                    autoComplete="off"
                    className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                  />
                  {isSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-neutral-500 animate-pulse">
                      Searching…
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={lookupPending}
                  className="rounded-lg border-2 border-black bg-black px-3 py-2 text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 cursor-pointer"
                >
                  {lookupPending ? "Adding…" : "Add"}
                </button>
              </form>

              {/* Live Search Results Dropdown */}
              {username.replace(/^@/, "").trim().length >= 2 && searchHasRun && (
                <div className="mt-2 rounded-xl border-2 border-black bg-white p-2 shadow-[3px_3px_0px_0px_#000] space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                      Public Accounts ({searchResults.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchResults([])}
                      className="text-[10px] font-bold text-neutral-400 hover:text-black cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                  {searchResults.length === 0 ? (
                    <p className="px-2 py-1 text-xs font-bold text-neutral-500">
                      No registered players found matching &ldquo;{username}&rdquo;.
                    </p>
                  ) : (
                    <ul className="divide-y divide-neutral-100 max-h-56 overflow-y-auto">
                      {searchResults.map((result) => (
                        <li key={result.accountId} className="flex items-center justify-between gap-2 py-2 px-1">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-black truncate">{result.name}</span>
                              <span className="rounded bg-neutral-100 border border-neutral-300 px-1 py-0.5 text-[10px] font-bold text-neutral-700">
                                @{result.username}
                              </span>
                              {result.isRestricted && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-500">
                                  <LockIcon className="h-3 w-3 shrink-0" />
                                  <span>Private</span>
                                </span>
                              )}
                            </div>
                            {!result.isRestricted && (
                              <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-600 mt-0.5">
                                {result.rating !== undefined && (
                                  <span>Rating: {formatDupr(result.rating)}</span>
                                )}
                                {result.bestPartner && (
                                  <span className="inline-flex items-center gap-1 text-amber-700">
                                    <span>·</span>
                                    <HandshakeIcon className="h-3 w-3 shrink-0" />
                                    <span>Best: @{result.bestPartner.username} ({result.bestPartner.synergyScore > 0 ? `+${result.bestPartner.synergyScore}%` : `${result.bestPartner.synergyScore}%`})</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={result.alreadyInGroup || addingAccountId === result.accountId}
                            onClick={() => handleAddSearchedPlayer(result.accountId)}
                            className={`shrink-0 rounded-lg border-2 border-black px-2.5 py-1 text-[11px] font-black uppercase shadow-[1px_1px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 disabled:shadow-none ${
                              result.alreadyInGroup
                                ? "bg-neutral-200 text-neutral-500 cursor-default"
                                : "bg-[#ccff00] text-black hover:bg-[#b8e600] cursor-pointer"
                            }`}
                          >
                            {result.alreadyInGroup ? (
                              <span className="inline-flex items-center gap-1">
                                <span>In Roster</span>
                                <CheckIcon className="h-3 w-3 shrink-0" />
                              </span>
                            ) : addingAccountId === result.accountId ? (
                              "Adding…"
                            ) : (
                              "Add"
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleAddGuest} className="space-y-3 rounded-xl border-2 border-black bg-white/70 p-3 shadow-[2px_2px_0px_0px_#000]">
              <p className="text-[11px] font-bold text-neutral-600">
                Guests don&apos;t need an account to play, but their sessions won&apos;t be saved.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="guest-player-name"
                  aria-label="Guest Name"
                  required
                  maxLength={60}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest Name"
                  className="flex-1 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none"
                />
                <select
                  id="guest-player-gender"
                  aria-label="Guest Gender"
                  value={guestGender}
                  onChange={(e) => setGuestGender(e.target.value as "male" | "female")}
                  className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none cursor-pointer"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <button
                  type="submit"
                  disabled={guestSaving || !guestName.trim()}
                  className="rounded-lg border-2 border-black bg-[#ccff00] px-4 py-1.5 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8e600] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 cursor-pointer shrink-0"
                >
                  {guestSaving ? "Adding…" : "Add"}
                </button>
              </div>
              <RatingSlider
                id="guest-player-rating"
                label="Guest starting skill level"
                value={guestRating}
                onChange={setGuestRating}
                dataTestId="guest-player-rating"
                showDescription={true}
              />
            </form>
          )}

          {addMessage && (
            <p role="status" className="text-xs font-bold text-neutral-800 bg-[#ccff00]/40 p-2 rounded-lg border border-black/40">
              {addMessage}
            </p>
          )}
        </div>
      )}
    </section>
  )}

      {/* Roster Directory Section */}
      <section
        aria-label="Group roster"
        className="space-y-3 rounded-2xl border-2 border-black bg-[#fef08a] p-4 shadow-[3px_3px_0px_0px_#000]"
      >
        <div>
          <h2 className="font-display text-xl font-black uppercase">Roster ({players.length})</h2>
          <p className="text-xs font-semibold text-neutral-700">Players and group organizers.</p>
        </div>

        {players.length > 0 && (
          <div className="space-y-2 pt-1">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              id="roster-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roster by name or @username..."
              aria-label="Search roster"
              data-testid="roster-search-input"
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

          {/* Filter & Sort controls row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <label htmlFor="roster-filter" className="text-[10px] font-black uppercase text-neutral-800 shrink-0">
                Filter:
              </label>
              <select
                id="roster-filter"
                aria-label="Filter roster"
                data-testid="roster-filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as RosterFilterType)}
                className="w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none cursor-pointer"
              >
                <option value="all">All ({players.length})</option>
                <option value="pinned">Pinned ({pinnedCount})</option>
                <option value="organizers">Organizers ({organizerCount})</option>
                <option value="members">Members ({memberCount})</option>
                <option value="guests">Guests ({guestCount})</option>
              </select>
            </div>

            {hasGenderData && (
              <div className="flex items-center gap-1.5 min-w-[100px]">
                <label htmlFor="roster-gender-filter" className="text-[10px] font-black uppercase text-neutral-800 shrink-0">
                  Gender:
                </label>
                <select
                  id="roster-gender-filter"
                  aria-label="Filter by gender"
                  data-testid="roster-gender-filter-select"
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value as RosterFilterGender)}
                  className="w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <label htmlFor="roster-sort" className="text-[10px] font-black uppercase text-neutral-800 shrink-0">
                Sort:
              </label>
              <select
                id="roster-sort"
                aria-label="Sort roster"
                data-testid="roster-sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as RosterSortOption)}
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

      {players.length === 0 ? (
        <p className="rounded-lg border border-black bg-white px-3 py-3 text-sm font-bold text-neutral-700">No players on the roster yet.</p>
      ) : filteredAndSortedPlayers.length === 0 ? (
        <div className="rounded-xl border-2 border-black bg-white p-4 text-center space-y-2">
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
        <ul className="divide-y-2 divide-neutral-200 rounded-xl border-2 border-black bg-white px-3" data-testid="roster-players-list">
          {filteredAndSortedPlayers.map((player) => {
            const organizer = player.accountId ? organizers.find(({ accountId }) => accountId === player.accountId) : undefined;
            const playerUsername = player.username || organizer?.username;
            const isPinned = pinnedPlayerIds.has(player.id);
            return (
              <li key={player.id} className="flex items-center justify-between gap-3 py-3" data-testid={`roster-player-row-${player.name}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-black">
                      {player.name}
                      {playerUsername ? (
                        <>
                          {" "}
                          (
                          <Link
                            href={`/players/${encodeURIComponent(playerUsername)}`}
                            className="underline hover:text-black cursor-pointer"
                          >
                            @{playerUsername}
                          </Link>
                          )
                        </>
                      ) : (
                        ""
                      )}
                    </span>
                    {player.gender && (
                      <span className="rounded border border-black/40 bg-neutral-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-neutral-800">
                        {player.gender}
                      </span>
                    )}
                    {organizer && (
                      <span
                        className={`rounded-full border border-black px-2 py-1 text-[9px] font-black uppercase ${
                          organizer.isHost ? "bg-[#fde047]" : "bg-[#e0f2fe]"
                        }`}
                      >
                        {organizer.isHost ? "Host" : "Organizer"}
                      </span>
                    )}
                  </div>
                  <span className="block text-xs font-bold text-neutral-600">
                    Rating: {formatDupr(player.rating)} ({getSkillTier(eloToDupr(player.rating)).name}) · {player.ratedGamesPlayed} games
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(isHost || isOrganizer) ? (
                    <>
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
                      <details className="relative" data-player-menu>
                        <summary aria-label={`Options for ${player.name}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border-2 border-black bg-white text-xl font-black leading-none shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100">···</summary>
                        <div className="absolute right-0 top-10 z-20 min-w-48 rounded-xl border-2 border-black bg-white p-1.5 shadow-[3px_3px_0px_0px_#000]">
                          <button
                            type="button"
                            onClick={() => {
                              closeAllMenus();
                              togglePinnedPlayer(groupId, player.id);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase hover:bg-[#ccff00] cursor-pointer"
                          >
                            {isPinned ? "Unpin player" : "Pin player"}
                          </button>
                          <div className="my-1 border-t border-neutral-200" />
                        {playerUsername && (
                          <Link
                            href={`/players/${encodeURIComponent(playerUsername)}`}
                            onClick={closeAllMenus}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase text-black hover:bg-[#ccff00] cursor-pointer transition-colors"
                          >
                            View profile
                          </Link>
                        )}
                        {organizer?.isHost ? (
                          <button
                            type="button"
                            disabled
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Group host
                          </button>
                        ) : (
                          <>
                            {isHost && (
                              <>
                                {organizer ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={pendingPlayerId === player.id}
                                      onClick={() => void removeOrganizer(player.id)}
                                      className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {pendingPlayerId === player.id ? "Removing…" : "Remove group organizer"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={pendingPlayerId === player.id}
                                      onClick={() => {
                                        closeAllMenus();
                                        setTransferError(null);
                                        setTransferTarget(player);
                                      }}
                                      className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase hover:bg-[#ccff00] cursor-pointer"
                                    >
                                      Transfer host
                                    </button>
                                    <div className="my-1 border-t border-neutral-200" />
                                  </>
                                ) : player.accountId ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={pendingPlayerId === player.id}
                                      onClick={() => void makeOrganizer(player.id)}
                                      className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase hover:bg-[#ccff00] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {pendingPlayerId === player.id ? "Adding…" : "Make a group organizer"}
                                    </button>
                                    <div className="my-1 border-t border-neutral-200" />
                                  </>
                                ) : null}
                              </>
                            )}
                            {!player.accountId && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeAllMenus();
                                    setEditingGuest(player);
                                  }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase hover:bg-[#ccff00] cursor-pointer"
                                >
                                  Edit guest
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeAllMenus();
                                    setMergingGuest(player);
                                  }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase hover:bg-[#ccff00] cursor-pointer"
                                >
                                  Merge with another guest player
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeAllMenus();
                                    setLinkingPlayer(player);
                                  }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase hover:bg-[#ccff00] cursor-pointer"
                                >
                                  Link to public player
                                </button>
                                <div className="my-1 border-t border-neutral-200" />
                              </>
                            )}
                            {(!organizer || isHost) ? (
                              <button
                                type="button"
                                disabled={pendingPlayerId === player.id}
                                onClick={() => {
                                  if (!player.accountId) {
                                    closeAllMenus();
                                    setGuestToRemove(player);
                                  } else {
                                    void removePlayer(player.id);
                                  }
                                }}
                                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {pendingPlayerId === player.id ? "Removing…" : "Remove player"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium uppercase disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Group organizer
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </details>
                  </>
                ) : (
                    playerUsername && (
                      <Link
                        href={`/players/${encodeURIComponent(playerUsername)}`}
                        className="rounded-lg border-2 border-black bg-white px-2.5 py-1 text-[11px] font-black uppercase text-black shadow-[1.5px_1.5px_0px_0px_#000] hover:bg-[#ccff00] active:translate-x-0.5 active:translate-y-0.5 transition-transform shrink-0 mr-2"
                      >
                        View profile
                      </Link>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rosterMessage && <p role="status" className="text-xs font-bold">{rosterMessage}</p>}
      {linkingPlayer && (
        <LinkGuestModal
          key={linkingPlayer.id}
          isOpen={true}
          onClose={() => setLinkingPlayer(null)}
          guestPlayer={linkingPlayer}
          groupId={groupId}
          onLinked={(linkedAccountName) => {
            setRosterMessage(`Successfully linked ${linkingPlayer.name} to ${linkedAccountName}.`);
            setLinkingPlayer(null);
            router.refresh();
          }}
        />
      )}
      {editingGuest && (
        <EditGuestModal
          key={editingGuest.id}
          isOpen={true}
          onClose={() => setEditingGuest(null)}
          guestPlayer={editingGuest}
          groupId={groupId}
          onGuestUpdated={(updatedName, updatedGender) => {
            setRosterMessage(`Guest "${updatedName}" updated${updatedGender ? ` (${updatedGender})` : ""}.`);
            setEditingGuest(null);
            router.refresh();
          }}
        />
      )}
      {mergingGuest && (
        <MergeGuestModal
          key={mergingGuest.id}
          isOpen={true}
          onClose={() => setMergingGuest(null)}
          guestPlayer={mergingGuest}
          allPlayers={players}
          groupId={groupId}
          onMerged={(mergedPlayer) => {
            setRosterMessage(`Merged guest players into "${mergedPlayer.name}".`);
            setMergingGuest(null);
            router.refresh();
          }}
        />
      )}
      <ConfirmGroupNameModal
        isOpen={Boolean(transferTarget)}
        onClose={() => {
          setTransferTarget(null);
          setTransferError(null);
        }}
        onConfirm={handleTransferHost}
        title="Transfer Host"
        description="You are about to transfer host privileges. Are you sure? Enter in the name of the group to continue."
        groupName={groupName}
        confirmButtonText="Transfer Host"
        pendingButtonText="Transferring…"
        confirmVariant="danger"
        error={transferError}
        isPending={transferPending}
        onClearError={() => setTransferError(null)}
      />
      <ConfirmDialog
        isOpen={Boolean(guestToRemove)}
        onClose={() => setGuestToRemove(null)}
        onConfirm={async () => {
          if (guestToRemove) {
            const id = guestToRemove.id;
            setGuestToRemove(null);
            await removePlayer(id);
          }
        }}
        title="Remove Guest"
        description={
          guestToRemove
            ? getRemoveGuestConfirmationMessage(guestToRemove.name, guestToRemove.ratedGamesPlayed ?? 0)
            : ""
        }
        confirmText="Remove"
        cancelText="Cancel"
        confirmVariant="danger"
        disabled={pendingPlayerId !== null}
        confirmDataTestId="confirm-remove-guest-button"
      />
    </section>
    </div>
  );
}
