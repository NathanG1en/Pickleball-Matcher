"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { ConfirmDialog, RatingSlider, Toast, CustomDropdown } from "@/components/ui";
import { formatDupr } from "@/lib/domain/rating-display";
import {
  SearchIcon,
  UserPlusIcon,
  LockIcon,
  HandshakeIcon,
  CheckIcon,
  PinIcon,
  PinOffIcon,
  UserRoundIcon,
  ShieldMinusIcon,
  ShieldPlusIcon,
  CrownIcon,
  Trash2Icon,
  PencilIcon,
  ArrowLeftRightIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XIcon,
} from "@/components/ui/icons";
import {
  usePinnedPlayerIds,
  togglePinnedPlayer,
  sortPlayersWithPinned,
} from "@/lib/storage/pinned-players";

export function getRemoveGuestConfirmationMessage(name: string, gamesPlayed: number): string {
  return `Are you sure you want to remove "${name}"? They have played ${gamesPlayed} ${gamesPlayed === 1 ? "game" : "games"}.`;
}

export const DISMISS_GUEST_DESC_STORAGE_KEY = "pickleball_dismiss_guest_desc";

export function getGuestDescDismissedSnapshot(): boolean {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(DISMISS_GUEST_DESC_STORAGE_KEY) === "true";
    }
    if (typeof globalThis !== "undefined" && globalThis.sessionStorage) {
      return globalThis.sessionStorage.getItem(DISMISS_GUEST_DESC_STORAGE_KEY) === "true";
    }
  } catch {
    return false;
  }
  return false;
}

export function subscribeGuestDescDismissed(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("pickleball_guest_desc_dismissed", callback);
  return () => {
    window.removeEventListener("pickleball_guest_desc_dismissed", callback);
  };
}

export function GroupOrganizersPanel({
  groupId,
  groupName = "",
  players,
  organizers,
  isHost,
  isOrganizer = false,
  initialAddMode = "search",
  initialSearchResults = [],
  initialSearchUsername = "",
}: {
  groupId: string;
  groupName?: string;
  players: readonly PlayerRecord[];
  organizers: readonly GroupOrganizerRecord[];
  isHost: boolean;
  isOrganizer?: boolean;
  initialAddMode?: "search" | "guest";
  initialSearchResults?: readonly SearchPlayerResult[];
  initialSearchUsername?: string;
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
  const isGuestDescDismissed = useSyncExternalStore(
    subscribeGuestDescDismissed,
    getGuestDescDismissedSnapshot,
    getGuestDescDismissedSnapshot
  );

  const handleDismissGuestDesc = () => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(DISMISS_GUEST_DESC_STORAGE_KEY, "true");
        window.dispatchEvent(new Event("pickleball_guest_desc_dismissed"));
      }
    } catch {
      // sessionStorage unavailable
    }
  };

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
  const [addMode, setAddMode] = useState<"search" | "guest">(initialAddMode);
  const [isAddOpen, setIsAddOpen] = useState(true);

  // Search mode state
  const [username, setUsername] = useState(initialSearchUsername);
  const [searchResults, setSearchResults] = useState<readonly SearchPlayerResult[]>(initialSearchResults);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHasRun, setSearchHasRun] = useState(initialSearchResults.length > 0);
  const [addingAccountId, setAddingAccountId] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  // Guest mode state
  const [guestName, setGuestName] = useState("");
  const [guestGender, setGuestGender] = useState<"male" | "female">("male");
  const [guestRating, setGuestRating] = useState<number>(3.5);
  const [guestSaving, setGuestSaving] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [rosterMessage, setRosterMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
    setToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  const setRosterStatus = (msg: string | null) => {
    setRosterMessage(msg);
    if (msg) setAddError(null);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

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

  const handlePlayerMenuToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const details = event.currentTarget;
    if (details.open) {
      document.querySelectorAll<HTMLDetailsElement>("details[data-player-menu][open]").forEach((el) => {
        if (el !== details) {
          el.removeAttribute("open");
        }
      });
      const menuEl = details.querySelector<HTMLElement>("[data-player-menu-dropdown]");
      if (menuEl) {
        const rect = details.getBoundingClientRect();
        const menuHeight = menuEl.offsetHeight || 260;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < menuHeight + 16 && rect.top > menuHeight) {
          menuEl.classList.remove("top-full", "mt-1.5", "dropdown-animate");
          menuEl.classList.add("bottom-full", "mb-1.5", "dropdown-animate-up");
        } else {
          menuEl.classList.remove("bottom-full", "mb-1.5", "dropdown-animate-up");
          menuEl.classList.add("top-full", "mt-1.5", "dropdown-animate");
        }
      }
    }
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
    setAddError(null);
    try {
      const res = await addPlayerByAccountIdAction({ groupId, accountId });
      if (res.ok) {
        showToast(res.data?.name ? `Added ${res.data.name} to the roster.` : "Player added to the roster.");
        setUsername("");
        setSearchResults([]);
        router.refresh();
      } else {
        setAddError(res.error ?? "Failed to add player.");
      }
    } catch {
      setAddError("Failed to add player.");
    } finally {
      setAddingAccountId(null);
    }
  };

  const handleAddGuest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = guestName.trim();
    if (!trimmed || guestSaving) return;
    setGuestSaving(true);
    setAddError(null);
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
        showToast(`Guest player "${trimmed}" added to the roster.`);
        setGuestName("");
        setGuestGender("male");
        router.refresh();
      } else {
        setAddError(res.error ?? "Failed to add guest player.");
      }
    } catch {
      setAddError("Failed to add guest player.");
    } finally {
      setGuestSaving(false);
    }
  };

  const addPlayerByUsername = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = username.replace(/^@/, "").trim();
    if (!clean) return;

    setLookupPending(true);
    setAddError(null);

    const matching = searchResults.find(
      (r) => r.username.toLowerCase() === clean.toLowerCase()
    );
    if (matching) {
      if (matching.alreadyInGroup) {
        setAddError("Player is already on the roster.");
        setLookupPending(false);
        return;
      }
      await handleAddSearchedPlayer(matching.accountId);
      setLookupPending(false);
      return;
    }

    const result = await addGroupPlayerByUsernameAction({ groupId, username: clean });
    if (result.ok) {
      showToast("Player added to the roster.");
      setUsername("");
      setSearchResults([]);
      router.refresh();
    } else {
      setAddError(result.error ?? "Unable to find that player.");
    }
    setLookupPending(false);
  };

  const makeOrganizer = async (playerId: string) => {
    closeAllMenus();
    setPendingPlayerId(playerId);
    setRosterStatus(null);
    const result = await addGroupOrganizerAction({ groupId, playerId });
    setRosterStatus(result.ok ? "Player is now a group organizer." : result.error ?? "Unable to add organizer.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  const removeOrganizer = async (playerId: string) => {
    closeAllMenus();
    setPendingPlayerId(playerId);
    setRosterStatus(null);
    const result = await removeGroupOrganizerAction({ groupId, playerId });
    setRosterStatus(result.ok ? "Player is no longer a group organizer." : result.error ?? "Unable to remove organizer.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  const removePlayer = async (playerId: string) => {
    closeAllMenus();
    setPendingPlayerId(playerId);
    setRosterStatus(null);
    const result = await removeGroupPlayerAction({ groupId, playerId });
    setRosterStatus(result.ok ? "Player removed from the group." : result.error ?? "Unable to remove player.");
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
        setRosterStatus(`Host privileges transferred to ${transferTarget.name}.`);
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
      {toast && (
        <Toast
          role="status"
          onDismiss={() => {
            if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
            setToast(null);
          }}
        >
          <span>{toast}</span>
        </Toast>
      )}

      {/* Add Player / Guest Section */}
      {(isHost || isOrganizer) && (
        <section
          aria-label="Add player or guest"
          className="space-y-3 rounded-2xl border-2 border-black bg-[#FFFDF7] p-4"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex h-7 w-7 items-center justify-center rounded-lg border-2 border-black bg-[#ccff00] shrink-0">
                  <UserPlusIcon className="h-4 w-4 text-black" />
                </div>
                <h2
                  onClick={() => setIsAddOpen((prev) => !prev)}
                  className="font-display text-lg font-black uppercase text-black cursor-pointer select-none hover:text-neutral-700 transition-colors"
                >
                  Add Player or Guest
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen((prev) => !prev)}
                aria-expanded={isAddOpen}
                aria-label={isAddOpen ? "Collapse add player or guest form" : "Expand add player or guest form"}
                className="p-1 text-black hover:text-neutral-600 hover:scale-110 active:scale-95 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
              >
                <ChevronDownIcon
                  className={`h-5 w-5 text-black transform transition-transform duration-300 ease-in-out ${
                    isAddOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs font-semibold text-neutral-600 mt-0.5 sm:ml-9">
              Find players by username or add guest players.
            </p>
          </div>

          {isAddOpen && (
            <div className="space-y-3 pt-1 border-t-2 border-neutral-100">
              {/* Mode Switch Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-100 border border-neutral-200 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode("search");
                    setAddError(null);
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
                    setAddError(null);
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
              <form onSubmit={addPlayerByUsername} className="relative">
                <label htmlFor="roster-player-username" className="sr-only">Look up player by username</label>
                <div className="relative">
                  <input
                    id="roster-player-username"
                    required
                    minLength={2}
                    maxLength={24}
                    value={username}
                    onChange={(event) => {
                      const val = event.target.value;
                      setUsername(val);
                      if (addError) setAddError(null);
                      if (val.replace(/^@/, "").trim().length < 2) {
                        setSearchResults([]);
                        setSearchHasRun(false);
                        setIsSearching(false);
                      }
                    }}
                    placeholder="Find player by username"
                    autoComplete="off"
                    disabled={lookupPending}
                    className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                  />
                  {isSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-neutral-500 animate-pulse">
                      Searching…
                    </span>
                  )}
                </div>
              </form>

              {/* Live Search Results Dropdown */}
              {username.replace(/^@/, "").trim().length >= 2 && searchHasRun && (
                <div className="mt-2 rounded-xl border-2 border-black bg-[#FFFDF7] p-2 space-y-2">
                  <div className="px-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                      Public Accounts ({searchResults.length})
                    </span>
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
                              <span className="text-xs font-semibold text-neutral-500 shrink-0">
                                (@{result.username})
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
            <form onSubmit={handleAddGuest} className="space-y-3 rounded-xl border-2 border-black bg-[#FFFDF7]/70 p-3">
              {!isGuestDescDismissed && (
                <div
                  data-testid="guest-description-banner"
                  className="flex items-center justify-between gap-2 p-2 bg-neutral-100/90 rounded-lg border border-neutral-300 text-neutral-700"
                >
                  <p className="text-[11px] font-bold text-neutral-600 leading-tight">
                    Guests don&apos;t need an account to play, but their sessions won&apos;t be saved.
                  </p>
                  <button
                    type="button"
                    onClick={handleDismissGuestDesc}
                    aria-label="Dismiss guest description"
                    title="Dismiss"
                    data-testid="dismiss-guest-desc-button"
                    className="p-1 text-neutral-400 hover:text-black rounded hover:bg-neutral-200 transition-colors cursor-pointer shrink-0"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="space-y-2">
                <input
                  id="guest-player-name"
                  aria-label="Guest Name"
                  required
                  maxLength={60}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest Name"
                  className="w-full rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <CustomDropdown
                    id="guest-player-gender"
                    ariaLabel="Guest Gender"
                    value={guestGender}
                    onChange={(val) => setGuestGender(val as "male" | "female")}
                    options={[
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                    ]}
                    sizeVariant="sm"
                    className="shrink-0"
                    buttonClassName="rounded-lg shadow-[1px_1px_0px_0px_#000] py-1.5"
                  />
                  <button
                    type="submit"
                    disabled={guestSaving || !guestName.trim()}
                    className="flex-1 rounded-lg border-2 border-black bg-[#ccff00] px-4 py-1.5 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8e600] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 cursor-pointer text-center"
                  >
                    {guestSaving ? "Adding…" : "Add"}
                  </button>
                </div>
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

          {addError && (
            <p role="alert" className="text-xs font-bold text-red-600">
              {addError}
            </p>
          )}
        </div>
      )}
    </section>
  )}

      {/* Roster Directory Section */}
      <section
        aria-label="Group roster"
        className="space-y-3 rounded-2xl border-2 border-black bg-[#fef08a] p-4"
      >
        <div>
          <h2 className="font-display text-xl font-black uppercase">Roster ({players.length})</h2>
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
            <div className="flex items-center gap-1.5">
              <label htmlFor="roster-filter" className="sr-only sm:not-sr-only text-[10px] font-black uppercase text-neutral-800 shrink-0">
                Filter:
              </label>
              <CustomDropdown
                id="roster-filter"
                ariaLabel="Filter roster"
                dataTestId="roster-filter-select"
                value={filterType}
                onChange={(val) => setFilterType(val as RosterFilterType)}
                options={[
                  { value: "all", label: `All (${players.length})` },
                  { value: "pinned", label: `Pinned (${pinnedCount})` },
                  { value: "organizers", label: `Organizers (${organizerCount})` },
                  { value: "members", label: `Members (${memberCount})` },
                  { value: "guests", label: `Guests (${guestCount})` },
                ]}
                sizeVariant="xs"
              />
            </div>

            {hasGenderData && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="roster-gender-filter" className="sr-only sm:not-sr-only text-[10px] font-black uppercase text-neutral-800 shrink-0">
                  Gender:
                </label>
                <CustomDropdown
                  id="roster-gender-filter"
                  ariaLabel="Filter by gender"
                  dataTestId="roster-gender-filter-select"
                  value={filterGender}
                  onChange={(val) => setFilterGender(val as RosterFilterGender)}
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
              <label htmlFor="roster-sort" className="sr-only sm:not-sr-only text-[10px] font-black uppercase text-neutral-800 shrink-0">
                Sort:
              </label>
              <CustomDropdown
                id="roster-sort"
                ariaLabel="Sort roster"
                dataTestId="roster-sort-select"
                value={sortOption}
                onChange={(val) => setSortOption(val as RosterSortOption)}
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

      {players.length === 0 ? (
        <p className="rounded-lg border border-black bg-[#FFFDF7] px-3 py-3 text-sm font-bold text-neutral-700">No players on the roster yet.</p>
      ) : filteredAndSortedPlayers.length === 0 ? (
        <div className="rounded-xl border-2 border-black bg-[#FFFDF7] p-4 text-center space-y-2">
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
        <ul className="divide-y-2 divide-neutral-200 rounded-xl border-2 border-black bg-[#FFFDF7] px-3.5 shadow-[4px_4px_0px_0px_#171717]" data-testid="roster-players-list">
          {filteredAndSortedPlayers.map((player) => {
            const organizer = player.accountId ? organizers.find(({ accountId }) => accountId === player.accountId) : undefined;
            const playerUsername = player.username || organizer?.username;
            const isPinned = pinnedPlayerIds.has(player.id);
            return (
              <li key={player.id} className="flex items-center justify-between gap-3 py-3" data-testid={`roster-player-row-${player.name}`}>
                <div className="min-w-0 flex-1">
                  {/* Line 1: Name and Username */}
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="truncate text-base font-black text-black">
                      {player.name}
                    </span>
                    {playerUsername && (
                      <Link
                        href={`/players/${encodeURIComponent(playerUsername)}`}
                        className="truncate text-xs font-bold text-neutral-500 hover:text-black hover:underline cursor-pointer shrink"
                      >
                        @{playerUsername}
                      </Link>
                    )}
                  </div>

                  {/* Line 2: Stats and Role Badge */}
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 flex-wrap mt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                    {organizer && (
                      <span
                        className={`rounded-md border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 ${
                          organizer.isHost ? "bg-[#fde047]" : "bg-[#bae6fd]"
                        }`}
                      >
                        {organizer.isHost ? "Host" : "Organizer"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-[70px] shrink-0 flex items-center justify-end gap-1.5">
                  {(isHost || isOrganizer) ? (
                    <>
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
                      <details
                        className="relative open:z-40"
                        data-player-menu
                        onToggle={handlePlayerMenuToggle}
                      >
                        <summary
                          aria-label={`Options for ${player.name}`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-black bg-[#FFFDF7] text-black text-sm font-black leading-none shadow-[1.5px_1.5px_0px_0px_#171717] hover:bg-[#ccff00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer list-none select-none shrink-0"
                        >
                          ···
                        </summary>
                        <div
                          data-player-menu-dropdown
                          role="menu"
                          aria-label={`Options for ${player.name}`}
                          className="absolute right-0 top-full mt-1.5 z-40 w-[260px] max-w-[calc(100vw-32px)] rounded-[20px] border-[2.5px] border-black bg-[#FFFDF6] p-2 dropdown-animate space-y-0.5"
                        >
                          {/* Section 1: Player Actions */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              closeAllMenus();
                              togglePinnedPlayer(groupId, player.id);
                            }}
                            className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"
                          >
                            {isPinned ? (
                              <PinOffIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                            ) : (
                              <PinIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" filled={false} />
                            )}
                            <span>{isPinned ? "Unpin player" : "Pin player"}</span>
                          </button>

                          {playerUsername && (
                            <Link
                              href={`/players/${encodeURIComponent(playerUsername)}`}
                              role="menuitem"
                              onClick={closeAllMenus}
                              className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"
                            >
                              <UserRoundIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                              <span>View profile</span>
                            </Link>
                          )}

                          {!player.accountId && (
                            <>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  closeAllMenus();
                                  setEditingGuest(player);
                                }}
                                className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"
                              >
                                <PencilIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                                <span>Edit guest</span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  closeAllMenus();
                                  setMergingGuest(player);
                                }}
                                className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"
                              >
                                <ArrowLeftRightIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                                <span>Merge with another guest player</span>
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  closeAllMenus();
                                  setLinkingPlayer(player);
                                }}
                                className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"
                              >
                                <LinkIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                                <span>Link to public player</span>
                              </button>
                            </>
                          )}

                          {/* Section 2: Group Management */}
                          {!organizer?.isHost && isHost && (organizer || player.accountId) && (
                            <>
                              <div className="my-1 border-t border-neutral-300" role="separator" />
                              {organizer ? (
                                <>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={pendingPlayerId === player.id}
                                    onClick={() => void removeOrganizer(player.id)}
                                    className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <ShieldMinusIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                                    <span>{pendingPlayerId === player.id ? "Removing…" : "Remove organizer"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={pendingPlayerId === player.id}
                                    onClick={() => {
                                      closeAllMenus();
                                      setTransferError(null);
                                      setTransferTarget(player);
                                    }}
                                    className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <CrownIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                                    <span>Transfer host</span>
                                  </button>
                                </>
                              ) : player.accountId ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={pendingPlayerId === player.id}
                                  onClick={() => void makeOrganizer(player.id)}
                                  className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <ShieldPlusIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                                  <span>{pendingPlayerId === player.id ? "Adding…" : "Make a group organizer"}</span>
                                </button>
                              ) : null}
                            </>
                          )}

                          {/* Section 3: Destructive Actions */}
                          {!organizer?.isHost && (!organizer || isHost) && (
                            <>
                              <div className="my-1 border-t border-neutral-300" role="separator" />
                              <button
                                type="button"
                                role="menuitem"
                                disabled={pendingPlayerId === player.id}
                                onClick={() => {
                                  if (!player.accountId) {
                                    closeAllMenus();
                                    setGuestToRemove(player);
                                  } else {
                                    void removePlayer(player.id);
                                  }
                                }}
                                className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-[#E32929] hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2Icon className="w-[18px] h-[18px] shrink-0 text-[#E32929] stroke-2" />
                                <span>{pendingPlayerId === player.id ? "Removing…" : "Remove player"}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </details>
                  </>
                ) : (
                    playerUsername && (
                      <Link
                        href={`/players/${encodeURIComponent(playerUsername)}`}
                        aria-label="View profile"
                        title="View profile"
                        className="p-1.5 text-black hover:translate-x-0.5 transition-transform cursor-pointer shrink-0"
                      >
                        <span className="sr-only">View profile</span>
                        <ChevronRightIcon className="w-5 h-5 stroke-[2.5]" />
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
            setRosterStatus(`Successfully linked ${linkingPlayer.name} to ${linkedAccountName}.`);
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
            setRosterStatus(`Guest "${updatedName}" updated${updatedGender ? ` (${updatedGender})` : ""}.`);
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
            setRosterStatus(`Merged guest players into "${mergedPlayer.name}".`);
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
