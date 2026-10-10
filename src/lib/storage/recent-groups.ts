export interface RecentGroup {
  id: string;
  name: string;
  visitedAt: number;
}

const STORAGE_KEY = "pickleball_recent_groups";
const MAX_RECENT_GROUPS = 5;

export function saveRecentGroup(group: { id: string; name: string }): void {
  if (typeof window === "undefined") return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: RecentGroup[] = raw ? JSON.parse(raw) : [];

    // Filter out if already in list (match by id or name)
    const filtered = existing.filter(
      (g) => g.id !== group.id && g.name.toLowerCase() !== group.name.toLowerCase()
    );

    filtered.unshift({
      id: group.id,
      name: group.name.trim(),
      visitedAt: Date.now(),
    });

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(filtered.slice(0, MAX_RECENT_GROUPS))
    );

    // Notify listeners in same tab
    window.dispatchEvent(new Event("pickleball_recent_groups_changed"));
  } catch {
    // Gracefully handle storage quota or private-browsing restrictions
  }
}

export function removeRecentGroup(groupId: string): void {
  if (typeof window === "undefined") return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const existing: RecentGroup[] = JSON.parse(raw);
    const filtered = existing.filter((g) => g.id !== groupId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("pickleball_recent_groups_changed"));
  } catch {
    // Ignore errors
  }
}

export function clearRecentGroups(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("pickleball_recent_groups_changed"));
  } catch {
    // Ignore errors
  }
}

export function subscribeRecentGroups(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener("pickleball_recent_groups_changed", handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("pickleball_recent_groups_changed", handler);
  };
}

export function getRecentGroupsSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(STORAGE_KEY) || "[]";
}

export function getRecentGroups(): RecentGroup[] {
  try {
    return JSON.parse(getRecentGroupsSnapshot());
  } catch {
    return [];
  }
}
