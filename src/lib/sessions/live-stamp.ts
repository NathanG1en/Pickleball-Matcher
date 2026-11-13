import type { SessionRecord, StartedRoundRecord } from "@/lib/domain/types";

/**
 * A compact fingerprint of everything a session viewer sees change mid-session:
 * session status and round number, which rounds have started or finished, and
 * each match's status and score. Two snapshots with the same stamp render the
 * same live view, so viewers only need to refresh when the stamp changes.
 */
export function buildSessionLiveStamp(
  session: Pick<SessionRecord, "status" | "currentRoundNumber" | "version">,
  startedRounds: readonly Pick<StartedRoundRecord, "round" | "matches">[],
): string {
  const rounds = startedRounds.map(({ round, matches }) => {
    const matchParts = [...matches]
      .sort((a, b) => a.courtNumber - b.courtNumber || a.id.localeCompare(b.id))
      .map((match) => `${match.id}:${match.status}:${match.team1Score ?? "-"}:${match.team2Score ?? "-"}`)
      .join(",");
    return `${round.id}:${round.status}[${matchParts}]`;
  });
  return `${session.status}|${session.currentRoundNumber}|${session.version}|${rounds.join(";")}`;
}
