"use client";

import { useMemo, useSyncExternalStore } from "react";

const getStorageKey = (sessionId: string) => `pickleball_dismissed_duplicates_${sessionId}`;

export function getDismissedDuplicatesSnapshot(sessionId: string): string {
  if (typeof window === "undefined") return "[]";
  try {
    return localStorage.getItem(getStorageKey(sessionId)) || "[]";
  } catch {
    return "[]";
  }
}

export function getDismissedDuplicates(sessionId: string): string[] {
  try {
    const raw = getDismissedDuplicatesSnapshot(sessionId);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function dismissDuplicateWarning(
  sessionId: string,
  matchId: string,
  otherMatchId?: string
): void {
  if (typeof window === "undefined") return;
  try {
    const existing = new Set<string>(getDismissedDuplicates(sessionId));
    existing.add(matchId);
    if (otherMatchId) {
      existing.add(otherMatchId);
    }
    localStorage.setItem(getStorageKey(sessionId), JSON.stringify(Array.from(existing)));
    window.dispatchEvent(new Event(`pickleball_dismissed_duplicates_changed_${sessionId}`));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

export function subscribeDismissedDuplicates(
  sessionId: string,
  callback: () => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  const eventName = `pickleball_dismissed_duplicates_changed_${sessionId}`;
  window.addEventListener("storage", handler);
  window.addEventListener(eventName, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(eventName, handler);
  };
}

export function useDismissedDuplicates(sessionId: string): Set<string> {
  const isTest = process.env.NODE_ENV === "test";
  const snapshot = useSyncExternalStore(
    (callback) => subscribeDismissedDuplicates(sessionId, callback),
    () => getDismissedDuplicatesSnapshot(sessionId),
    () => (isTest ? getDismissedDuplicatesSnapshot(sessionId) : "[]")
  );

  return useMemo(() => {
    try {
      return new Set<string>(JSON.parse(snapshot));
    } catch {
      return new Set<string>();
    }
  }, [snapshot]);
}

