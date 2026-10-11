"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addGroupOrganizerAction,
  addGroupPlayerByUsernameAction,
  removeGroupOrganizerAction,
  removeGroupPlayerAction,
} from "@/app/actions/group-organizers";
import {
  searchPlayersByUsernameAction,
  addPlayerByAccountIdAction,
  createPlayerAction,
  type SearchPlayerResult,
} from "@/app/actions/players";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import type { GroupOrganizerRecord, PlayerRecord } from "@/lib/domain/types";

export function GroupOrganizersPanel({
  groupId,
  players,
  organizers,
  isHost,
  isOrganizer = false,
}: {
  groupId: string;
  players: readonly PlayerRecord[];
  organizers: readonly GroupOrganizerRecord[];
  isHost: boolean;
  isOrganizer?: boolean;
}) {
  const router = useRouter();
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);

  // Mode switch: "search" | "guest"
  const [addMode, setAddMode] = useState<"search" | "guest">("search");

  // Search mode state
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState<readonly SearchPlayerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHasRun, setSearchHasRun] = useState(false);
  const [addingAccountId, setAddingAccountId] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  // Guest mode state
  const [guestName, setGuestName] = useState("");
  const [guestRating, setGuestRating] = useState<number>(1000);
  const [guestSaving, setGuestSaving] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(null);
    try {
      const res = await addPlayerByAccountIdAction({ groupId, accountId });
      if (res.ok) {
        setMessage("Player added to the roster.");
        setUsername("");
        setSearchResults([]);
        router.refresh();
      } else {
        setMessage(res.error ?? "Failed to add player.");
      }
    } catch {
      setMessage("Failed to add player.");
    } finally {
      setAddingAccountId(null);
    }
  };

  const handleAddGuest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = guestName.trim();
    if (!trimmed || guestSaving) return;
    setGuestSaving(true);
    setMessage(null);
    try {
      const res = await createPlayerAction({
        groupId,
        name: trimmed,
        initialRating: guestRating,
        idempotencyKey: createIdempotencyKey("guest_add"),
      });
      if (res.ok) {
        setMessage(`Guest player "${trimmed}" added to the roster.`);
        setGuestName("");
        setGuestRating(1000);
        router.refresh();
      } else {
        setMessage(res.error ?? "Failed to add guest player.");
      }
    } catch {
      setMessage("Failed to add guest player.");
    } finally {
      setGuestSaving(false);
    }
  };

  const addPlayerByUsername = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = username.replace(/^@/, "").trim();
    if (!clean) return;

    setLookupPending(true);
    setMessage(null);

    const matching = searchResults.find(
      (r) => r.username.toLowerCase() === clean.toLowerCase()
    );
    if (matching) {
      if (matching.alreadyInGroup) {
        setMessage("Player is already on the roster.");
        setLookupPending(false);
        return;
      }
      await handleAddSearchedPlayer(matching.accountId);
      setLookupPending(false);
      return;
    }

    const result = await addGroupPlayerByUsernameAction({ groupId, username: clean });
    setMessage(result.ok ? "Player added to the roster." : result.error ?? "Unable to find that player.");
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
    setMessage(null);
    const result = await addGroupOrganizerAction({ groupId, playerId });
    setMessage(result.ok ? "Player is now a group organizer." : result.error ?? "Unable to add organizer.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  const removeOrganizer = async (playerId: string) => {
    closeAllMenus();
    setPendingPlayerId(playerId);
    setMessage(null);
    const result = await removeGroupOrganizerAction({ groupId, playerId });
    setMessage(result.ok ? "Player is no longer a group organizer." : result.error ?? "Unable to remove organizer.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  const removePlayer = async (playerId: string) => {
    closeAllMenus();
    setPendingPlayerId(playerId);
    setMessage(null);
    const result = await removeGroupPlayerAction({ groupId, playerId });
    setMessage(result.ok ? "Player removed from the group." : result.error ?? "Unable to remove player.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  return (
    <section className="space-y-3 rounded-2xl border-2 border-black bg-[#fef08a] p-4 shadow-[3px_3px_0px_0px_#000]">
      <div>
        <h2 className="font-display text-xl font-black uppercase">Roster ({players.length})</h2>
        <p className="text-xs font-semibold text-neutral-700">Players and group organizers.</p>
      </div>
      {(isHost || isOrganizer) && (
        <div className="space-y-2">
          {/* Mode Switch Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-black/10 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => {
                setAddMode("search");
                setMessage(null);
              }}
              className={`px-3 py-1 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                addMode === "search"
                  ? "bg-black text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.4)]"
                  : "text-neutral-800 hover:bg-black/10"
              }`}
            >
              🔍 Find Player
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode("guest");
                setMessage(null);
              }}
              className={`px-3 py-1 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                addMode === "guest"
                  ? "bg-black text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.4)]"
                  : "text-neutral-800 hover:bg-black/10"
              }`}
            >
              👤 + Add Guest
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
                      if (message) setMessage(null);
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
                  disabled={lookupPending}
                  className="rounded-lg border-2 border-black bg-black px-3 py-2 text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 cursor-pointer"
                >
                  {lookupPending ? "Adding…" : "Find & Add"}
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
                                <span className="text-[10px] font-bold text-neutral-500">🔒 Private</span>
                              )}
                            </div>
                            {!result.isRestricted && (
                              <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-600 mt-0.5">
                                {result.rating !== undefined && (
                                  <span>Rating {Math.round(result.rating)}</span>
                                )}
                                {result.bestPartner && (
                                  <span className="text-amber-700">
                                    · 🤝 Best: @{result.bestPartner.username} ({result.bestPartner.synergyScore}%)
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
                            {result.alreadyInGroup
                              ? "In Roster ✓"
                              : addingAccountId === result.accountId
                              ? "Adding…"
                              : "+ Add"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Add Guest Mode Form */
            <form onSubmit={handleAddGuest} className="space-y-2 rounded-xl border-2 border-black bg-white/70 p-3 shadow-[2px_2px_0px_0px_#000]">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="guest-player-name"
                  required
                  maxLength={60}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest / temporary name (e.g. Jordan)"
                  className="flex-1 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none"
                />
                <select
                  value={guestRating}
                  onChange={(e) => setGuestRating(Number(e.target.value))}
                  className="rounded-lg border-2 border-black bg-white px-2 py-1.5 text-xs font-bold shadow-[1px_1px_0px_0px_#000] focus:outline-none"
                >
                  <option value={900}>Beginner (~900)</option>
                  <option value={1000}>Intermediate (~1000)</option>
                  <option value={1100}>Advanced (~1100)</option>
                </select>
                <button
                  type="submit"
                  disabled={guestSaving || !guestName.trim()}
                  className="rounded-lg border-2 border-black bg-[#ccff00] px-3 py-1.5 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8e600] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 cursor-pointer"
                >
                  {guestSaving ? "Adding…" : "+ Add Guest"}
                </button>
              </div>
              <p className="text-[11px] font-bold text-neutral-600">
                Temporary players don&apos;t need an account. They can play and earn game ratings right away.
              </p>
            </form>
          )}
        </div>
      )}
      {players.length === 0 ? (
        <p className="rounded-lg border border-black bg-white px-3 py-3 text-sm font-bold text-neutral-700">No players on the roster yet.</p>
      ) : (
        <ul className="divide-y-2 divide-neutral-200 rounded-xl border-2 border-black bg-white px-3">
          {players.map((player) => {
            const organizer = player.accountId ? organizers.find(({ accountId }) => accountId === player.accountId) : undefined;
            const playerUsername = player.username || organizer?.username;
            return (
              <li key={player.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-black">
                      {player.name}
                      {playerUsername ? ` (@${playerUsername})` : ""}
                    </span>
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
                    Rating: {Math.round(player.rating)} · {player.ratedGamesPlayed} games
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(isHost || isOrganizer) && (
                    <details className="relative" data-player-menu>
                      <summary aria-label={`Options for ${player.name}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border-2 border-black bg-white text-xl font-black leading-none shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 [&::-webkit-details-marker]:hidden">···</summary>
                      <div className="absolute right-0 top-10 z-20 min-w-48 rounded-xl border-2 border-black bg-white p-1.5 shadow-[3px_3px_0px_0px_#000]">
                        {organizer?.isHost ? (
                          <button
                            type="button"
                            disabled
                            className="w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Group host
                          </button>
                        ) : (
                          <>
                            {isHost && (
                              <>
                                {organizer ? (
                                  <button
                                    type="button"
                                    disabled={pendingPlayerId === player.id}
                                    onClick={() => void removeOrganizer(player.id)}
                                    className="w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {pendingPlayerId === player.id ? "Removing…" : "Remove group organizer"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!player.accountId || pendingPlayerId === player.id}
                                    onClick={() => void makeOrganizer(player.id)}
                                    title={!player.accountId ? "This player needs a linked account to become an organizer." : undefined}
                                    className="w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase hover:bg-[#ccff00] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {pendingPlayerId === player.id ? "Adding…" : "Make a group organizer"}
                                  </button>
                                )}
                                <div className="my-1 border-t border-neutral-200" />
                              </>
                            )}
                            {(!organizer || isHost) ? (
                              <button
                                type="button"
                                disabled={pendingPlayerId === player.id}
                                onClick={() => void removePlayer(player.id)}
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {pendingPlayerId === player.id ? "Removing…" : "Remove player"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Group organizer
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {message && <p role="status" className="text-xs font-bold">{message}</p>}
    </section>
  );
}
