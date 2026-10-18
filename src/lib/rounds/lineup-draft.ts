import { z } from "zod";

const draftSchema = z.object({
  context: z.string(),
  courts: z.array(z.object({
    courtNumber: z.number().int(),
    team1: z.array(z.string()).max(2),
    team2: z.array(z.string()).max(2),
  })),
  sitting: z.array(z.string()),
});

export interface LineupDraft {
  courts: readonly { courtNumber: number; team1: readonly string[]; team2: readonly string[] }[];
  sitting: readonly string[];
}

export function lineupDraftKey(sessionId: string): string {
  return `lineup-draft:${sessionId}`;
}

export function clearLineupDraft(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}

export function readLineupDraft(key: string, context: string, proposal: LineupDraft): LineupDraft | null {
  try {
    const parsed = draftSchema.safeParse(JSON.parse(window.localStorage.getItem(key) ?? "null"));
    if (!parsed.success || parsed.data.context !== context) return null;
    const draft = parsed.data;
    const players = (lineup: LineupDraft) => [...lineup.courts.flatMap(c => [...c.team1, ...c.team2]), ...lineup.sitting].sort();
    const expected = players(proposal);
    const actual = players(draft);
    if (new Set(actual).size !== actual.length || JSON.stringify(actual) !== JSON.stringify(expected)) return null;
    if (JSON.stringify(draft.courts.map(c => c.courtNumber).sort()) !== JSON.stringify(proposal.courts.map(c => c.courtNumber).sort())) return null;
    return { courts: draft.courts, sitting: draft.sitting };
  } catch { return null; }
}

export function saveLineupDraft(key: string, context: string, draft: LineupDraft): void {
  try { window.localStorage.setItem(key, JSON.stringify({ context, ...draft })); } catch { /* Keep editing usable when storage is blocked or full. */ }
}
