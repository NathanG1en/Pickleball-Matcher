import type { PlayerSynergyRecord } from "@/lib/domain/types";

export type TeamSynergyStatus = "calculated" | "new_duo" | "guest_ineligible" | "solo";
export interface TeamSynergyInfo {
  readonly score?: number;
  readonly matchesPlayed?: number;
  readonly status?: TeamSynergyStatus;
  readonly reason?: string;
  readonly hasGuest?: boolean;
}
export interface CourtSynergiesMap {
  [courtNumber: number]: { team1?: TeamSynergyInfo | null; team2?: TeamSynergyInfo | null };
}
export type PairSynergiesMap = Readonly<Record<string, { readonly score: number; readonly matchesPlayed: number }>>;

function pairKey(accountIdA: string, accountIdB: string): string {
  return JSON.stringify([accountIdA, accountIdB].sort());
}

export function buildPairSynergies(records: readonly PlayerSynergyRecord[]): PairSynergiesMap {
  return Object.fromEntries(records.filter((record) => record.matchesPlayed > 0).map((record) => [
    pairKey(record.accountId1, record.accountId2),
    { score: record.synergyScore, matchesPlayed: record.matchesPlayed },
  ]));
}

export function buildCourtSynergies(
  courts: readonly { courtNumber: number; team1: readonly string[]; team2: readonly string[] }[],
  playerAccounts: Readonly<Record<string, string | null>>,
  pairSynergies: PairSynergiesMap,
): CourtSynergiesMap {
  const teamSynergy = (team: readonly string[]): TeamSynergyInfo => {
    if (team.length !== 2) return { status: "solo" };
    const account1 = playerAccounts[team[0]];
    const account2 = playerAccounts[team[1]];
    if (!account1 || !account2) return { status: "guest_ineligible", hasGuest: true };
    const synergy = pairSynergies[pairKey(account1, account2)];
    return synergy ? { ...synergy, status: "calculated" } : { status: "new_duo" };
  };
  return Object.fromEntries(courts.map((court) => [court.courtNumber, {
    team1: teamSynergy(court.team1),
    team2: teamSynergy(court.team2),
  }]));
}
