import type {
  PlayerRecord,
  TeamTournamentLine,
  TeamTournamentPair,
  TeamTournamentTeam,
  TournamentRecord,
} from "@/lib/domain/types";

function generateRandomId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface TeamScoreSummary {
  teamScores: Record<string, { wins: number; points: number; totalGames: number }>;
  completedLinesCount: number;
  totalLinesCount: number;
  leaderTeamId: string | null;
  isTied: boolean;
}

const DEFAULT_TEAM_CONFIGS = [
  { name: "Team Fire 🔥", color: "#ef4444" },
  { name: "Team Ice ❄️", color: "#3b82f6" },
  { name: "Team Thunder ⚡", color: "#eab308" },
  { name: "Team Emerald 🌿", color: "#10b981" },
];

/**
 * Distributes players and pre-formed doubles pairs across teams using a greedy
 * balancing algorithm to equalize both roster size and average player ratings.
 */
export function autoBalanceTeams(
  players: readonly PlayerRecord[],
  preFormedPairs: readonly [string, string][],
  teamCount: number = 2
): { teams: TeamTournamentTeam[]; pairs: TeamTournamentPair[] } {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const clampedTeamCount = Math.max(2, Math.min(teamCount, DEFAULT_TEAM_CONFIGS.length));

  // 1. Build pair objects and track paired player IDs
  const pairedPlayerIds = new Set<string>();
  const pairs: TeamTournamentPair[] = [];

  for (const [p1Id, p2Id] of preFormedPairs) {
    if (playerMap.has(p1Id) && playerMap.has(p2Id)) {
      pairs.push({
        id: generateRandomId("pair"),
        player1Id: p1Id,
        player2Id: p2Id,
      });
      pairedPlayerIds.add(p1Id);
      pairedPlayerIds.add(p2Id);
    }
  }

  // 2. Identify solo players
  const soloPlayerIds = players
    .filter((p) => !pairedPlayerIds.has(p.id))
    .map((p) => p.id);

  // 3. Initialize teams
  const teams: TeamTournamentTeam[] = Array.from({ length: clampedTeamCount }, (_, i) => ({
    id: `team_${i + 1}`,
    name: DEFAULT_TEAM_CONFIGS[i]?.name ?? `Team ${i + 1}`,
    color: DEFAULT_TEAM_CONFIGS[i]?.color ?? "#6b7280",
    pairIds: [],
    soloPlayerIds: [],
  }));

  // Helper to calculate total rating & player count of a team
  const getTeamMetrics = (team: TeamTournamentTeam) => {
    let totalRating = 0;
    let count = 0;

    for (const pairId of team.pairIds) {
      const pair = pairs.find((p) => p.id === pairId);
      if (pair) {
        totalRating += (playerMap.get(pair.player1Id)?.rating ?? 1000) +
                       (playerMap.get(pair.player2Id)?.rating ?? 1000);
        count += 2;
      }
    }

    for (const soloId of team.soloPlayerIds) {
      totalRating += playerMap.get(soloId)?.rating ?? 1000;
      count += 1;
    }

    return { totalRating, count, avgRating: count > 0 ? totalRating / count : 0 };
  };

  // 4. Distribute pairs first (sorted by combined rating descending)
  const sortedPairs = [...pairs].sort((a, b) => {
    const rA = (playerMap.get(a.player1Id)?.rating ?? 1000) + (playerMap.get(a.player2Id)?.rating ?? 1000);
    const rB = (playerMap.get(b.player1Id)?.rating ?? 1000) + (playerMap.get(b.player2Id)?.rating ?? 1000);
    return rB - rA;
  });

  for (const pair of sortedPairs) {
    // Assign to team with fewest players; if equal, team with lowest total rating
    const targetTeam = teams.slice().sort((a, b) => {
      const mA = getTeamMetrics(a);
      const mB = getTeamMetrics(b);
      if (mA.count !== mB.count) return mA.count - mB.count;
      return mA.totalRating - mB.totalRating;
    })[0];

    (targetTeam.pairIds as string[]).push(pair.id);
  }

  // 5. Distribute solo players (sorted by rating descending)
  const sortedSolos = [...soloPlayerIds].sort((a, b) => {
    const rA = playerMap.get(a)?.rating ?? 1000;
    const rB = playerMap.get(b)?.rating ?? 1000;
    return rB - rA;
  });

  for (const soloId of sortedSolos) {
    const targetTeam = teams.slice().sort((a, b) => {
      const mA = getTeamMetrics(a);
      const mB = getTeamMetrics(b);
      if (mA.count !== mB.count) return mA.count - mB.count;
      return mA.totalRating - mB.totalRating;
    })[0];

    (targetTeam.soloPlayerIds as string[]).push(soloId);
  }

  return { teams, pairs };
}

/**
 * Generates the default line matches between Team 1 and Team 2.
 * Pairs corresponding doubles pairs, followed by solo matchups.
 */
export function generateDefaultLines(
  teams: readonly TeamTournamentTeam[],
  pairs: readonly TeamTournamentPair[]
): TeamTournamentLine[] {
  if (teams.length < 2) return [];

  const team1 = teams[0]!;
  const team2 = teams[1]!;
  const lines: TeamTournamentLine[] = [];
  const pairMap = new Map(pairs.map((p) => [p.id, p]));

  let lineNum = 1;

  // 1. Match up doubles pairs
  const maxPairs = Math.max(team1.pairIds.length, team2.pairIds.length);
  for (let i = 0; i < maxPairs; i++) {
    const pair1 = team1.pairIds[i] ? pairMap.get(team1.pairIds[i]!) : undefined;
    const pair2 = team2.pairIds[i] ? pairMap.get(team2.pairIds[i]!) : undefined;

    const t1Players = pair1 ? [pair1.player1Id, pair1.player2Id] : [];
    const t2Players = pair2 ? [pair2.player1Id, pair2.player2Id] : [];

    lines.push({
      id: generateRandomId("line"),
      lineNumber: lineNum,
      name: `Line ${lineNum} - Doubles`,
      type: "doubles",
      team1PlayerIds: t1Players,
      team2PlayerIds: t2Players,
      team1Score: null,
      team2Score: null,
      status: "pending",
    });
    lineNum++;
  }

  // 2. Match up solos
  const t1Solos = [...team1.soloPlayerIds];
  const t2Solos = [...team2.soloPlayerIds];

  // If both teams have at least 2 solos, form an extra doubles line
  while (t1Solos.length >= 2 && t2Solos.length >= 2) {
    lines.push({
      id: generateRandomId("line"),
      lineNumber: lineNum,
      name: `Line ${lineNum} - Doubles`,
      type: "doubles",
      team1PlayerIds: [t1Solos.shift()!, t1Solos.shift()!],
      team2PlayerIds: [t2Solos.shift()!, t2Solos.shift()!],
      team1Score: null,
      team2Score: null,
      status: "pending",
    });
    lineNum++;
  }

  // If there are remaining singles
  while (t1Solos.length > 0 || t2Solos.length > 0) {
    const p1 = t1Solos.shift();
    const p2 = t2Solos.shift();

    lines.push({
      id: generateRandomId("line"),
      lineNumber: lineNum,
      name: `Line ${lineNum} - Singles`,
      type: "singles",
      team1PlayerIds: p1 ? [p1] : [],
      team2PlayerIds: p2 ? [p2] : [],
      team1Score: null,
      team2Score: null,
      status: "pending",
    });
    lineNum++;
  }

  // Ensure at least 1 line exists if both teams are empty
  if (lines.length === 0) {
    lines.push({
      id: generateRandomId("line"),
      lineNumber: 1,
      name: "Line 1 - Doubles",
      type: "doubles",
      team1PlayerIds: [],
      team2PlayerIds: [],
      team1Score: null,
      team2Score: null,
      status: "pending",
    });
  }

  return lines;
}

/**
 * Computes live match score summary and winner standings for a team tournament.
 */
export function computeTeamScore(tournament: TournamentRecord): TeamScoreSummary {
  const teamData = tournament.teamData;
  if (!teamData || !teamData.teams || teamData.teams.length < 2) {
    return {
      teamScores: {},
      completedLinesCount: 0,
      totalLinesCount: 0,
      leaderTeamId: null,
      isTied: false,
    };
  }

  const team1 = teamData.teams[0]!;
  const team2 = teamData.teams[1]!;

  const summary: TeamScoreSummary = {
    teamScores: {
      [team1.id]: { wins: 0, points: 0, totalGames: 0 },
      [team2.id]: { wins: 0, points: 0, totalGames: 0 },
    },
    completedLinesCount: 0,
    totalLinesCount: teamData.lines.length,
    leaderTeamId: null,
    isTied: false,
  };

  for (const line of teamData.lines) {
    if (line.team1Score !== null && line.team2Score !== null) {
      summary.completedLinesCount++;
      summary.teamScores[team1.id]!.points += line.team1Score;
      summary.teamScores[team2.id]!.points += line.team2Score;
      summary.teamScores[team1.id]!.totalGames++;
      summary.teamScores[team2.id]!.totalGames++;

      if (line.team1Score > line.team2Score) {
        summary.teamScores[team1.id]!.wins++;
      } else if (line.team2Score > line.team1Score) {
        summary.teamScores[team2.id]!.wins++;
      }
    }
  }

  const t1Wins = summary.teamScores[team1.id]!.wins;
  const t2Wins = summary.teamScores[team2.id]!.wins;

  if (summary.completedLinesCount > 0) {
    if (t1Wins > t2Wins) {
      summary.leaderTeamId = team1.id;
    } else if (t2Wins > t1Wins) {
      summary.leaderTeamId = team2.id;
    } else {
      summary.isTied = true;
    }
  }

  return summary;
}
