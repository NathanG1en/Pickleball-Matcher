import type { DomainRepository } from "@/lib/domain/repositories";
import type {
  AttendanceRecord,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  RoundSitRecord,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";

interface InMemoryState {
  players: PlayerRecord[];
  sessions: SessionRecord[];
  attendance: AttendanceRecord[];
  rounds: RoundRecord[];
  matches: MatchRecord[];
  matchPlayers: MatchPlayerRecord[];
  roundSits: RoundSitRecord[];
  replayMatches: ReplayMatch[];
  ratingSnapshots: Map<string, readonly RatingSnapshot[]>;
}

type InMemorySeed = Partial<Omit<InMemoryState, "ratingSnapshots">> & {
  ratingSnapshots?: ReadonlyMap<string, readonly RatingSnapshot[]>;
};

export class InMemoryRepositories implements DomainRepository {
  state: InMemoryState;
  writeCount = 0;
  committedTransactions = 0;

  constructor(seed: InMemorySeed = {}) {
    this.state = {
      players: structuredClone(seed.players ?? []),
      sessions: structuredClone(seed.sessions ?? []),
      attendance: structuredClone(seed.attendance ?? []),
      rounds: structuredClone(seed.rounds ?? []),
      matches: structuredClone(seed.matches ?? []),
      matchPlayers: structuredClone(seed.matchPlayers ?? []),
      roundSits: structuredClone(seed.roundSits ?? []),
      replayMatches: structuredClone(seed.replayMatches ?? []),
      ratingSnapshots: new Map(seed.ratingSnapshots ?? []),
    };
  }

  async transaction<T>(operation: (repository: DomainRepository) => Promise<T>): Promise<T> {
    const before = structuredClone(this.state);
    const writesBefore = this.writeCount;
    try {
      const result = await operation(this);
      this.committedTransactions += 1;
      return result;
    } catch (error) {
      this.state = before;
      this.writeCount = writesBefore;
      throw error;
    }
  }

  async getSession(sessionId: string) {
    return this.state.sessions.find((session) => session.id === sessionId) ?? null;
  }

  async listPlayers(groupId: string) {
    return this.state.players.filter((player) => player.groupId === groupId);
  }

  async listAttendance(sessionId: string) {
    return this.state.attendance.filter((item) => item.sessionId === sessionId);
  }

  async listStartedRounds(sessionId: string): Promise<readonly StartedRoundRecord[]> {
    return this.state.rounds
      .filter((round) => round.sessionId === sessionId)
      .map((round) => {
        const matches = this.state.matches.filter((match) => match.roundId === round.id);
        const matchIds = new Set(matches.map((match) => match.id));
        return {
          round,
          matches,
          matchPlayers: this.state.matchPlayers.filter((item) => matchIds.has(item.matchId)),
          sits: this.state.roundSits.filter((sit) => sit.roundId === round.id),
        };
      });
  }

  async getRound(roundId: string) {
    return this.state.rounds.find((round) => round.id === roundId) ?? null;
  }

  async getMatch(matchId: string) {
    return this.state.matches.find((match) => match.id === matchId) ?? null;
  }

  async insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]) {
    this.state.sessions.push(structuredClone(session));
    this.state.attendance.push(...structuredClone(attendance));
    this.writeCount += 1;
  }

  async updateSession(session: SessionRecord) {
    this.state.sessions = this.state.sessions.map((item) =>
      item.id === session.id ? structuredClone(session) : item,
    );
    this.writeCount += 1;
  }

  async saveAttendance(attendance: AttendanceRecord) {
    const index = this.state.attendance.findIndex(
      (item) =>
        item.sessionId === attendance.sessionId && item.playerId === attendance.playerId,
    );
    if (index === -1) this.state.attendance.push(structuredClone(attendance));
    else this.state.attendance[index] = structuredClone(attendance);
    this.writeCount += 1;
  }

  async insertStartedRound(record: StartedRoundRecord) {
    this.state.rounds.push(structuredClone(record.round));
    this.state.matches.push(...structuredClone(record.matches));
    this.state.matchPlayers.push(...structuredClone(record.matchPlayers));
    this.state.roundSits.push(...structuredClone(record.sits));
    this.writeCount += 1;
  }

  async updateMatch(match: MatchRecord) {
    this.state.matches = this.state.matches.map((item) =>
      item.id === match.id ? structuredClone(match) : item,
    );
    this.writeCount += 1;
  }

  async updateRound(round: RoundRecord) {
    this.state.rounds = this.state.rounds.map((item) =>
      item.id === round.id ? structuredClone(round) : item,
    );
    this.writeCount += 1;
  }

  async deleteRound(roundId: string) {
    const matchIds = new Set(
      this.state.matches.filter((match) => match.roundId === roundId).map((match) => match.id),
    );
    this.state.rounds = this.state.rounds.filter((round) => round.id !== roundId);
    this.state.matches = this.state.matches.filter((match) => match.roundId !== roundId);
    this.state.matchPlayers = this.state.matchPlayers.filter(
      (item) => !matchIds.has(item.matchId),
    );
    this.state.roundSits = this.state.roundSits.filter((sit) => sit.roundId !== roundId);
    for (const matchId of matchIds) this.state.ratingSnapshots.delete(matchId);
    this.writeCount += 1;
  }

  async listReplayMatches(groupId: string): Promise<readonly ReplayMatch[]> {
    const sessions = new Map(
      this.state.sessions
        .filter((session) => session.groupId === groupId)
        .map((session) => [session.id, session]),
    );
    const rounds = new Map(
      this.state.rounds
        .filter((round) => sessions.has(round.sessionId))
        .map((round) => [round.id, round]),
    );
    const actual = this.state.matches.flatMap((match): ReplayMatch[] => {
      if (!rounds.has(match.roundId) || match.status === "pending" || !match.completedAt) return [];
      const members = this.state.matchPlayers.filter((item) => item.matchId === match.id);
      const team1 = members.filter((item) => item.team === 1).map((item) => item.playerId);
      const team2 = members.filter((item) => item.team === 2).map((item) => item.playerId);
      if (team1.length !== 2 || team2.length !== 2) return [];
      return [
        {
          id: match.id,
          groupId,
          status: match.status,
          completedAt: match.completedAt,
          team1: [team1[0], team1[1]],
          team2: [team2[0], team2[1]],
          team1Score: match.team1Score ?? 0,
          team2Score: match.team2Score ?? 0,
        },
      ];
    });
    return [...this.state.replayMatches.filter((match) => match.groupId === groupId), ...actual];
  }

  async replaceRatingState(
    groupId: string,
    players: readonly Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed">[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ) {
    const ratings = new Map(players.map((player) => [player.id, player]));
    this.state.players = this.state.players.map((player) => {
      if (player.groupId !== groupId) return player;
      const rating = ratings.get(player.id)!;
      return { ...player, rating: rating.rating, ratedGamesPlayed: rating.ratedGamesPlayed };
    });
    this.state.ratingSnapshots = new Map(snapshots);
    this.state.matchPlayers = this.state.matchPlayers.map((item) => {
      const snapshot = snapshots.get(item.matchId)?.find((entry) => entry.playerId === item.playerId);
      return snapshot
        ? { ...item, ratingBefore: snapshot.ratingBefore, ratingAfter: snapshot.ratingAfter }
        : { ...item, ratingBefore: null, ratingAfter: null };
    });
    this.writeCount += 1;
  }
}
