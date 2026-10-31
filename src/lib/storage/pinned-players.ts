"use client";

import { useMemo, useSyncExternalStore } from "react";

const getStorageKey = (groupId: string) => `pickleball_pinned_players_${groupId}`;

export function getPinnedPlayersSnapshot(groupId: string): string {
  if (typeof window === "undefined") return "[]";
  try {
    return localStorage.getItem(getStorageKey(groupId)) || "[]";
  } catch {
    return "[]";
  }
}

export function getPinnedPlayers(groupId: string): string[] {
  try {
    const raw = getPinnedPlayersSnapshot(groupId);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function togglePinnedPlayer(groupId: string, playerId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const existing = new Set<string>(getPinnedPlayers(groupId));
    let nextPinned: boolean;
    if (existing.has(playerId)) {
      existing.delete(playerId);
      nextPinned = false;
    } else {
      existing.add(playerId);
      nextPinned = true;
    }
    localStorage.setItem(getStorageKey(groupId), JSON.stringify(Array.from(existing)));
    window.dispatchEvent(new Event(`pickleball_pinned_players_changed_${groupId}`));
    return nextPinned;
  } catch {
    return false;
  }
}

export function setPinnedPlayers(groupId: string, playerIds: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(groupId), JSON.stringify(playerIds));
    window.dispatchEvent(new Event(`pickleball_pinned_players_changed_${groupId}`));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

export function subscribePinnedPlayers(groupId: string, callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  const eventName = `pickleball_pinned_players_changed_${groupId}`;
  window.addEventListener("storage", handler);
  window.addEventListener(eventName, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(eventName, handler);
  };
}

export function usePinnedPlayerIds(groupId: string): Set<string> {
  const isTest = process.env.NODE_ENV === "test";
  const snapshot = useSyncExternalStore(
    (callback) => subscribePinnedPlayers(groupId, callback),
    () => getPinnedPlayersSnapshot(groupId),
    () => (isTest ? getPinnedPlayersSnapshot(groupId) : "[]")
  );

  return useMemo(() => {
    try {
      return new Set<string>(JSON.parse(snapshot));
    } catch {
      return new Set<string>();
    }
  }, [snapshot]);
}

export function sortPlayersWithPinned<T extends { id: string; name: string }>(
  players: readonly T[],
  pinnedIds: ReadonlySet<string>,
  selectedIds?: ReadonlySet<string>
): T[] {
  return [...players].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);
    const aSelected = selectedIds ? selectedIds.has(a.id) : false;
    const bSelected = selectedIds ? selectedIds.has(b.id) : false;

    // Rank 0: Pinned & Selected (top of pinned)
    // Rank 1: Pinned & Not Selected
    // Rank 2: Not Pinned & Selected (above nonpinned if not pinned)
    // Rank 3: Not Pinned & Not Selected
    const aRank = aPinned ? (aSelected ? 0 : 1) : (aSelected ? 2 : 3);
    const bRank = bPinned ? (bSelected ? 0 : 1) : (bSelected ? 2 : 3);

    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

