import type { AttendanceRecord, StartedRoundRecord } from "@/lib/domain/types";

export interface PlayCountRow {
  readonly playerId: string;
  readonly played: number;
  readonly sat: number;
}

/**
 * Games played and rounds sat out so far this session, for everyone checked in
 * now plus anyone who already played or sat. Cancelled games don't count as played.
 * Sorted so the people most owed a game come first.
 */
export function buildPlayCounts(
  rounds: readonly StartedRoundRecord[],
  attendance: readonly AttendanceRecord[],
): PlayCountRow[] {
  const counts = new Map<string, { played: number; sat: number }>();
  const bump = (id: string, key: "played" | "sat") => {
    const row = counts.get(id) ?? { played: 0, sat: 0 };
    row[key] += 1;
    counts.set(id, row);
  };
  for (const record of attendance) if (record.leftRound === null && !counts.has(record.playerId)) counts.set(record.playerId, { played: 0, sat: 0 });
  for (const round of rounds) {
    const live = new Set(round.matches.filter((m) => m.status !== "cancelled").map((m) => m.id));
    for (const mp of round.matchPlayers) if (live.has(mp.matchId)) bump(mp.playerId, "played");
    for (const sit of round.sits) bump(sit.playerId, "sat");
  }
  return [...counts]
    .map(([playerId, row]) => ({ playerId, ...row }))
    .sort((a, b) => a.played - b.played || b.sat - a.sat || a.playerId.localeCompare(b.playerId));
}
