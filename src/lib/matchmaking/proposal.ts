import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { generateRound } from "@/lib/matchmaking/generate-round";
import { pairKey } from "@/lib/matchmaking/pairs";
import type { MatchmakingPlayer, PairHistory } from "@/lib/matchmaking/types";
import type {
  AttendanceRecord,
  PlayerRecord,
  RoundProposal,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";

export function sessionPairHistory(rounds: readonly StartedRoundRecord[]): PairHistory[] {
  const history = new Map<string, PairHistory>();
  const touch = (first: string, second: string, kind: "partner" | "opponent") => {
    const key = pairKey(first, second);
    const current = history.get(key) ?? {
      player1Id: first,
      player2Id: second,
      sessionPartnerCount: 0,
      sessionOpponentCount: 0,
      roundsSincePartner: null,
      roundsSinceOpponent: null,
      lifetimePartnerCount: 0,
      lifetimeOpponentCount: 0,
    };
    history.set(key, {
      ...current,
      sessionPartnerCount: current.sessionPartnerCount + (kind === "partner" ? 1 : 0),
      sessionOpponentCount: current.sessionOpponentCount + (kind === "opponent" ? 1 : 0),
      roundsSincePartner: kind === "partner" ? 1 : current.roundsSincePartner,
      roundsSinceOpponent: kind === "opponent" ? 1 : current.roundsSinceOpponent,
    });
  };

  for (const record of rounds.toSorted((a, b) => a.round.roundNumber - b.round.roundNumber)) {
    for (const [key, value] of history) {
      history.set(key, {
        ...value,
        roundsSincePartner:
          value.roundsSincePartner === null ? null : value.roundsSincePartner + 1,
        roundsSinceOpponent:
          value.roundsSinceOpponent === null ? null : value.roundsSinceOpponent + 1,
      });
    }
    for (const match of record.matches) {
      const members = record.matchPlayers.filter((item) => item.matchId === match.id);
      const team1 = members.filter((item) => item.team === 1).map((item) => item.playerId);
      const team2 = members.filter((item) => item.team === 2).map((item) => item.playerId);
      if (team1.length === 2) touch(team1[0], team1[1], "partner");
      if (team2.length === 2) touch(team2[0], team2[1], "partner");
      for (const first of team1) for (const second of team2) touch(first, second, "opponent");
    }
  }
  return [...history.values()];
}

export function matchmakingPlayers(
  players: readonly PlayerRecord[],
  attendance: readonly AttendanceRecord[],
  rounds: readonly StartedRoundRecord[],
  currentRoundNumber: number,
  preserveParticipationHistory = false,
): MatchmakingPlayer[] {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const activeAttendance = attendance.filter(
    (item) => item.leftRound === null && item.joinedRound <= currentRoundNumber + 1,
  );
  const games = new Map<string, number>();
  const historicalEligibility = new Map<string, number>();
  const timesPlayed2v1 = new Map<string, number>();
  const timesPlayedSingles = new Map<string, number>();
  for (const record of rounds) {
    const presentInRound = new Set([
      ...record.matchPlayers.map((member) => member.playerId),
      ...record.sits.map((sit) => sit.playerId),
    ]);
    for (const id of presentInRound) {
      historicalEligibility.set(id, (historicalEligibility.get(id) ?? 0) + 1);
    }
    for (const member of record.matchPlayers) {
      games.set(member.playerId, (games.get(member.playerId) ?? 0) + 1);
    }
    for (const match of record.matches) {
      if (match.status === "cancelled") continue;
      const matchMembers = record.matchPlayers.filter((mp) => mp.matchId === match.id);
      if (
        matchMembers.length === 2 &&
        matchMembers.some((member) => member.team === 1) &&
        matchMembers.some((member) => member.team === 2)
      ) {
        for (const member of matchMembers) {
          timesPlayedSingles.set(member.playerId, (timesPlayedSingles.get(member.playerId) ?? 0) + 1);
        }
      }
      if (matchMembers.length === 3) {
        for (const member of matchMembers) {
          timesPlayed2v1.set(member.playerId, (timesPlayed2v1.get(member.playerId) ?? 0) + 1);
        }
      }
    }
  }
  const previousRound = rounds.find((record) => record.round.roundNumber === currentRoundNumber);
  const previousSits = new Set(previousRound?.sits.map((sit) => sit.playerId) ?? []);

  return activeAttendance.flatMap((item): MatchmakingPlayer[] => {
    const player = playersById.get(item.playerId);
    if (!player?.active) return [];
    return [
      {
        id: player.id,
        name: player.name,
        rating: player.rating,
        gamesPlayed: games.get(player.id) ?? 0,
        eligibleRounds: Math.max(
          0,
          currentRoundNumber - item.joinedRound + 1,
          preserveParticipationHistory ? historicalEligibility.get(player.id) ?? 0 : 0,
        ),
        satPreviousRound: previousSits.has(player.id),
        timesPlayed2v1: timesPlayed2v1.get(player.id) ?? 0,
        timesPlayedSingles: timesPlayedSingles.get(player.id) ?? 0,
      },
    ];
  });
}

export function proposeRoundFromSnapshot(
  {
    session,
    players,
    attendance,
    rounds,
  }: {
    session: SessionRecord;
    players: readonly PlayerRecord[];
    attendance: readonly AttendanceRecord[];
    rounds: readonly StartedRoundRecord[];
  },
  seed = Math.floor(Math.random() * 0xffff_ffff),
  temperature = 0,
): RoundProposal {
  const result = generateRound({
    players: matchmakingPlayers(
      players,
      attendance,
      rounds,
      session.currentRoundNumber,
      Boolean(session.stayTogetherPairs?.length),
    ),
    courts: session.courtCount,
    courtPlayerCounts: session.courtPlayerCounts,
    stayTogetherPairs: session.stayTogetherPairs,
    pairHistory: sessionPairHistory(rounds),
    config: DEFAULT_MATCHMAKING_CONFIG,
    seed,
    temperature,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

