"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  searchPlayersByUsernameAction,
  addPlayerByAccountIdAction,
  type SearchPlayerResult,
} from "@/app/actions/players";

interface PlayerSearchDrawerProps {
  readonly groupId: string;
  readonly onPlayerAdded?: (player: { id: string; name: string }) => void;
}

export function PlayerSearchDrawer({ groupId, onPlayerAdded }: PlayerSearchDrawerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly SearchPlayerResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearching] = useTransition();
  const [addingAccountId, setAddingAccountId] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError("Please enter at least 2 characters.");
      return;
    }
    setError(null);
    startSearching(async () => {
      const res = await searchPlayersByUsernameAction({ query: trimmed, groupId });
      setHasSearched(true);
      if (res.ok) {
        setResults(res.data);
      } else {
        setError(res.error);
        setResults([]);
      }
    });
  };

  const handleAddPlayer = async (accountId: string) => {
    setAddingAccountId(accountId);
    setError(null);
    try {
      const res = await addPlayerByAccountIdAction({ groupId, accountId });
      if (res.ok) {
        setResults((prev) =>
          prev.map((r) => (r.accountId === accountId ? { ...r, alreadyInGroup: true } : r)),
        );
        onPlayerAdded?.(res.data);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to add player to group.");
    } finally {
      setAddingAccountId(null);
    }
  };

  return (
    <section className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-black uppercase">Find & Add Players</h2>
          <p className="text-xs text-neutral-600 font-bold">Search by @username to view chemistry and add to roster</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Search by @username or name..."
          className="flex-1 rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="rounded-xl border-2 border-black bg-[#ccff00] px-4 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8e600] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
          {error}
        </p>
      )}

      {hasSearched && results.length === 0 && !isSearching && !error && (
        <p className="mt-4 text-center text-xs font-bold text-neutral-500">
          No players found matching &ldquo;{query}&rdquo;.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-3">
          {results.map((player) => (
            <li
              key={player.accountId}
              className="rounded-2xl border-2 border-black bg-neutral-50 p-3 shadow-[3px_3px_0px_0px_#000]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{player.name}</span>
                    <span className="rounded-md border border-neutral-400 bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-700">
                      @{player.username}
                    </span>
                    {player.isRestricted && (
                      <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                        🔒 Private Profile
                      </span>
                    )}
                  </div>

                  {!player.isRestricted && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600 font-bold">
                      {player.rating !== undefined && (
                        <span>Rating: {Math.round(player.rating)}</span>
                      )}
                      {player.skillLevel && (
                        <span className="capitalize">· {player.skillLevel}</span>
                      )}
                      {player.bestPartner && (
                        <span className="text-amber-700">
                          · 🤝 Best: @{player.bestPartner.username} ({player.bestPartner.synergyScore}% synergy)
                        </span>
                      )}
                      {player.viewerSynergyScore !== null && player.viewerSynergyScore !== undefined && (
                        <span className="text-emerald-700">
                          · ⚡ Chemistry with you: {player.viewerSynergyScore}%
                        </span>
                      )}
                    </div>
                  )}

                  {player.isRestricted && (
                    <p className="mt-1 text-[11px] font-bold text-neutral-500">
                      This player&apos;s ratings and chemistry stats are private.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={player.alreadyInGroup || addingAccountId === player.accountId}
                  onClick={() => handleAddPlayer(player.accountId)}
                  className={`whitespace-nowrap rounded-xl border-2 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60 disabled:shadow-none ${
                    player.alreadyInGroup
                      ? "bg-neutral-200 text-neutral-600"
                      : "bg-[#ccff00] hover:bg-[#b8e600]"
                  }`}
                >
                  {player.alreadyInGroup
                    ? "In Group ✓"
                    : addingAccountId === player.accountId
                      ? "Adding..."
                      : "Add to Group"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
