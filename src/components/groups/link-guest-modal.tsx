"use client";

import React, { useEffect, useState } from "react";
import {
  linkGuestPlayerAction,
  searchPlayersByUsernameAction,
  type SearchPlayerResult,
} from "@/app/actions/players";
import type { PlayerRecord } from "@/lib/domain/types";
import { formatDupr } from "@/lib/domain/rating-display";
import { LockIcon, CheckIcon, XIcon } from "@/components/ui/icons";

export interface LinkGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  guestPlayer: PlayerRecord | null;
  groupId: string;
  onLinked?: (linkedAccountName: string) => void;
}

export function LinkGuestModal({
  isOpen,
  onClose,
  guestPlayer,
  groupId,
  onLinked,
}: LinkGuestModalProps) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<readonly SearchPlayerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHasRun, setSearchHasRun] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkingAccountId, setLinkingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Live debounced search as user types
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.replace(/^@/, "").trim();
    if (trimmed.length < 2) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
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
  }, [query, groupId, isOpen]);

  if (!isOpen || !guestPlayer) return null;

  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.replace(/^@/, "").trim();
    if (trimmed.length < 2) return;

    setIsSearching(true);
    setError(null);
    try {
      const res = await searchPlayersByUsernameAction({ query: trimmed, groupId });
      if (res.ok) {
        setSearchResults(res.data);
      } else {
        setSearchResults([]);
        setError(res.error ?? "Failed to search players.");
      }
      setSearchHasRun(true);
    } catch {
      setSearchResults([]);
      setError("Failed to search players.");
      setSearchHasRun(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLink = async (target: SearchPlayerResult) => {
    if (target.alreadyInGroup) return;

    setIsLinking(true);
    setLinkingAccountId(target.accountId);
    setError(null);

    try {
      const result = await linkGuestPlayerAction({
        groupId,
        playerId: guestPlayer.id,
        targetAccountId: target.accountId,
      });

      if (result.ok) {
        onLinked?.(target.name || `@${target.username}`);
        onClose();
      } else {
        setError(result.error ?? "Unable to link player.");
      }
    } catch {
      setError("An unexpected error occurred while linking the player.");
    } finally {
      setIsLinking(false);
      setLinkingAccountId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-guest-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl border-[3px] border-black bg-white p-6 text-black shadow-[8px_8px_0px_0px_#000] sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white hover:bg-[#fde047] cursor-pointer"
        >
          <XIcon className="h-4 w-4" />
        </button>

        <div className="space-y-1 pr-6 text-left">
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#ccff00] border-2 border-black">
            Link Guest Player
          </span>
          <h2
            id="link-guest-title"
            className="font-display text-2xl font-black uppercase tracking-tight text-black"
          >
            Link {guestPlayer.name}
          </h2>
          <p className="text-xs font-bold text-neutral-600">
            Search for a registered public player account to link with {guestPlayer.name}. Their game history and ratings will be connected to their account.
          </p>
        </div>

        {/* Search input form */}
        <form onSubmit={handleSearchSubmit} className="space-y-2">
          <label htmlFor="link-player-search-input" className="sr-only">
            Search players by username or name
          </label>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <input
                id="link-player-search-input"
                type="text"
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuery(val);
                  if (error) setError(null);
                  if (val.replace(/^@/, "").trim().length < 2) {
                    setSearchResults([]);
                    setSearchHasRun(false);
                    setIsSearching(false);
                  }
                }}
                placeholder="Search username or name…"
                className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                autoFocus
              />
              {isSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-neutral-500 animate-pulse">
                  Searching…
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching || query.replace(/^@/, "").trim().length < 2}
              className="rounded-xl border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 cursor-pointer"
            >
              Search
            </button>
          </div>
        </form>

        {error && (
          <p role="alert" className="rounded-xl border-2 border-red-500 bg-red-50 p-2.5 text-xs font-bold text-red-600">
            {error}
          </p>
        )}

        {/* Search Results */}
        {query.replace(/^@/, "").trim().length >= 2 && searchHasRun && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Matching Accounts ({searchResults.length})
              </span>
            </div>

            {searchResults.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-neutral-300 p-4 text-center text-xs font-bold text-neutral-500">
                No registered players found matching &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <ul className="divide-y-2 divide-neutral-100 max-h-56 overflow-y-auto rounded-xl border-2 border-black p-1 space-y-1">
                {searchResults.map((result) => (
                  <li
                    key={result.accountId}
                    className="flex items-center justify-between gap-2 p-2 hover:bg-neutral-50 rounded-lg transition-colors"
                  >
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
                      {!result.isRestricted && result.rating !== undefined && (
                        <div className="text-[11px] font-bold text-neutral-600 mt-0.5">
                          Rating: {formatDupr(result.rating)}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={result.alreadyInGroup || isLinking}
                      onClick={() => void handleLink(result)}
                      data-testid={`link-target-${result.username}`}
                      className={`shrink-0 rounded-lg border-2 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[1px_1px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 disabled:shadow-none ${
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
                      ) : linkingAccountId === result.accountId ? (
                        "Linking…"
                      ) : (
                        "Link Player"
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border-2 border-black bg-neutral-100 hover:bg-neutral-200 px-4 py-2 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
