import { z } from "zod";

/**
 * Unsaved score drafts for one round, kept in this tab's session storage so a
 * phone that reloads after locking courtside doesn't throw away scores that were
 * typed but not yet saved.
 */
export type StoredScoreDrafts = Record<string, { team1: string; team2: string }>;

const draftsSchema = z.record(z.string(), z.object({ team1: z.string().max(3), team2: z.string().max(3) }));

export function scoreDraftsKey(roundId: string): string {
  return `score-drafts:${roundId}`;
}

export function readScoreDrafts(key: string, pendingMatchIds: ReadonlySet<string>): StoredScoreDrafts | null {
  try {
    const parsed = draftsSchema.safeParse(JSON.parse(window.sessionStorage.getItem(key) ?? "null"));
    if (!parsed.success) return null;
    // Only matches still waiting for a result; a saved or cancelled match needs no draft.
    const entries = Object.entries(parsed.data).filter(([matchId]) => pendingMatchIds.has(matchId));
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  } catch {
    return null;
  }
}

export function writeScoreDrafts(key: string, drafts: Readonly<StoredScoreDrafts>): void {
  try {
    if (Object.keys(drafts).length === 0) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(drafts));
  } catch {
    // Storage blocked or full: drafts still live in memory for this page.
  }
}
