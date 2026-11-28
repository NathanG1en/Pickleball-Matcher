import { z } from "zod";

/**
 * Seed for the default lineup of one round of one session. Deterministic, so a
 * reload, a second tab, or a co-organizer's phone all propose the same lineup
 * until the inputs (attendance, scores, settings) actually change.
 */
export function defaultLineupSeed(sessionId: string, roundNumber: number): number {
  // FNV-1a over "sessionId:round", folded to an unsigned 32-bit integer.
  let hash = 0x811c9dc5;
  for (const char of `${sessionId}:${roundNumber}`) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A started round's lineup, kept when the organizer sends that round back to setup with Edit Lineup. */
export interface KeptLineup {
  readonly courts: readonly { readonly courtNumber: number; readonly team1: readonly string[]; readonly team2: readonly string[] }[];
  readonly sitting: readonly string[];
}

/** A Reshuffle, variety change or Edit Lineup the organizer made for the next round on this device. */
export interface LineupChoice {
  readonly roundNumber: number;
  readonly sessionVersion: number;
  readonly seed: number;
  readonly temperature: number;
  /** Set by Edit Lineup: show this exact lineup instead of generating one from the seed. */
  readonly lineup?: KeptLineup;
}

const choiceSchema = z.object({
  roundNumber: z.number().int(),
  sessionVersion: z.number().int(),
  seed: z.number().int().min(0).max(0xffff_ffff),
  temperature: z.number().min(0).max(2),
  lineup: z
    .object({
      courts: z.array(
        z.object({
          courtNumber: z.number().int(),
          team1: z.array(z.string()).max(2),
          team2: z.array(z.string()).max(2),
        }),
      ),
      sitting: z.array(z.string()),
    })
    .optional(),
});

const CHANGE_EVENT = "lineup-choice-change";
const choiceKey = (sessionId: string) => `lineup-choice:${sessionId}`;

export function saveLineupChoice(sessionId: string, choice: LineupChoice): void {
  try {
    window.localStorage.setItem(choiceKey(sessionId), JSON.stringify(choice));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage blocked: the reshuffle still applies until the page reloads.
  }
}

export function clearLineupChoice(sessionId: string): void {
  try {
    window.localStorage.removeItem(choiceKey(sessionId));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage blocked: nothing persisted to clear.
  }
}

/** Raw stored value, for useSyncExternalStore (strings compare by value). */
export function readLineupChoiceSnapshot(sessionId: string): string {
  try {
    return window.localStorage.getItem(choiceKey(sessionId)) ?? "";
  } catch {
    return "";
  }
}

export function subscribeLineupChoice(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The stored choice, only if it was made for this exact round and session state. */
export function parseLineupChoice(raw: string, roundNumber: number, sessionVersion: number): LineupChoice | null {
  if (!raw) return null;
  try {
    const parsed = choiceSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const choice = parsed.data;
    return choice.roundNumber === roundNumber && choice.sessionVersion === sessionVersion ? choice : null;
  } catch {
    return null;
  }
}
