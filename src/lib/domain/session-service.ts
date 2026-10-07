import { DomainError } from "@/lib/domain/errors";
import type { DomainRepository } from "@/lib/domain/repositories";
import { replayRatings } from "@/lib/domain/rating-replay";
import type {
  AttendanceRecord,
  ChangeAttendanceInput,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
  RecordResultInput,
  RoundProposal,
  RoundRecord,
  SessionRecord,
  SessionServiceDependencies,
  StartedRoundRecord,
  StartSessionInput,
} from "@/lib/domain/types";
import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { generateRound } from "@/lib/matchmaking/generate-round";
import { pairKey } from "@/lib/matchmaking/pairs";
import type { MatchmakingPlayer, PairHistory } from "@/lib/matchmaking/types";

async function requiredSession(repository: DomainRepository, sessionId: string) {
  const session = await repository.getSession(sessionId);
  if (!session) throw new DomainError("NOT_FOUND", "Session not found.");
  return session;
}

async function requiredRound(repository: DomainRepository, roundId: string) {
  const round = await repository.getRound(roundId);
  if (!round) throw new DomainError("NOT_FOUND", "Round not found.");
  return round;
}

async function requiredMatch(repository: DomainRepository, matchId: string) {
  const match = await repository.getMatch(matchId);
  if (!match) throw new DomainError("NOT_FOUND", "Match not found.");
  return match;
}

function sessionPairHistory(rounds: readonly StartedRoundRecord[]): PairHistory[] {
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
      if (team1.length === 2 && team2.length === 2) {
        touch(team1[0], team1[1], "partner");
        touch(team2[0], team2[1], "partner");
        for (const first of team1) for (const second of team2) touch(first, second, "opponent");
      } else if (team1.length === 1 && team2.length === 1) {
        touch(team1[0], team2[0], "opponent");
      }
    }
  }
  return [...history.values()];
}

function matchmakingPlayers(
  players: readonly PlayerRecord[],
  attendance: readonly AttendanceRecord[],
  rounds: readonly StartedRoundRecord[],
  currentRoundNumber: number,
): MatchmakingPlayer[] {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const activeAttendance = attendance.filter(
    (item) => item.leftRound === null && item.joinedRound <= currentRoundNumber + 1,
  );
  const games = new Map<string, number>();
  for (const record of rounds) {
    for (const member of record.matchPlayers) {
      games.set(member.playerId, (games.get(member.playerId) ?? 0) + 1);
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
        eligibleRounds: Math.max(0, currentRoundNumber - item.joinedRound + 1),
        satPreviousRound: previousSits.has(player.id),
      },
    ];
  });
}

export class SessionService {
  constructor(
    private readonly repository: DomainRepository,
    private readonly dependencies: SessionServiceDependencies,
  ) {}

  async startSession(input: StartSessionInput): Promise<SessionRecord> {
    if (!Number.isSafeInteger(input.courtCount) || input.courtCount <= 0) {
      throw new DomainError("INVALID_STATE", "At least one court is required.");
    }
    const now = this.dependencies.now();
    const session: SessionRecord = {
      id: this.dependencies.nextId("session"),
      groupId: input.groupId,
      courtCount: input.courtCount,
      status: "active",
      currentRoundNumber: 0,
      startedAt: now,
      endedAt: null,
      version: 1,
    };
    const attendance = [...new Set(input.playerIds)].map((playerId) => ({
      sessionId: session.id,
      playerId,
      joinedRound: 1,
      leftRound: null,
    }));
    return this.repository.transaction(async (repository) => {
      await repository.insertSession(session, attendance);
      return session;
    });
  }

  async changeAttendance(input: ChangeAttendanceInput): Promise<AttendanceRecord> {
    return this.repository.transaction(async (repository) => {
      const session = await requiredSession(repository, input.sessionId);
      const records = await repository.listAttendance(input.sessionId);
      const existing = records.find((item) => item.playerId === input.playerId);
      const nextRound = session.currentRoundNumber + 1;
      const attendance: AttendanceRecord = input.present
        ? {
            sessionId: input.sessionId,
            playerId: input.playerId,
            joinedRound: existing?.leftRound === null ? existing.joinedRound : nextRound,
            leftRound: null,
          }
        : {
            sessionId: input.sessionId,
            playerId: input.playerId,
            joinedRound: existing?.joinedRound ?? nextRound,
            leftRound: nextRound,
          };
      await repository.saveAttendance(attendance);
      return attendance;
    });
  }

  async proposeRound(sessionId: string, seed = this.dependencies.nextSeed()): Promise<RoundProposal> {
    const session = await requiredSession(this.repository, sessionId);
    const [players, attendance, rounds] = await Promise.all([
      this.repository.listPlayers(session.groupId),
      this.repository.listAttendance(sessionId),
      this.repository.listStartedRounds(sessionId),
    ]);
    const result = generateRound({
      players: matchmakingPlayers(players, attendance, rounds, session.currentRoundNumber),
      courts: session.courtCount,
      pairHistory: sessionPairHistory(rounds),
      config: DEFAULT_MATCHMAKING_CONFIG,
      seed,
    });
    if (!result.ok) throw new DomainError(result.error.code, result.error.message);
    return result.value;
  }

  async startRound(sessionId: string, proposal: RoundProposal): Promise<RoundRecord> {
    return this.repository.transaction(async (repository) => {
      const session = await requiredSession(repository, sessionId);
      if (session.status !== "active") {
        throw new DomainError("INVALID_STATE", "The session has ended.");
      }
      const now = this.dependencies.now();
      const round: RoundRecord = {
        id: this.dependencies.nextId("round"),
        sessionId,
        roundNumber: session.currentRoundNumber + 1,
        status: "started",
        seed: proposal.seed,
        scoreBreakdown: proposal.scoreBreakdown,
        createdAt: now,
        startedAt: now,
        completedAt: null,
        version: 1,
      };
      const matches: MatchRecord[] = [];
      const matchPlayers: MatchPlayerRecord[] = [];
      for (const court of proposal.courts) {
        const match: MatchRecord = {
          id: this.dependencies.nextId("match"),
          roundId: round.id,
          courtNumber: court.courtNumber,
          status: "pending",
          team1Score: null,
          team2Score: null,
          completedAt: null,
          version: 1,
        };
        matches.push(match);
        matchPlayers.push(
          ...court.team1.map((playerId) => ({
            matchId: match.id,
            playerId,
            team: 1 as const,
            ratingBefore: null,
            ratingAfter: null,
          })),
          ...court.team2.map((playerId) => ({
            matchId: match.id,
            playerId,
            team: 2 as const,
            ratingBefore: null,
            ratingAfter: null,
          })),
        );
      }
      await repository.insertStartedRound({
        round,
        matches,
        matchPlayers,
        sits: proposal.sitting.map((playerId) => ({ roundId: round.id, playerId })),
      });
      await repository.updateSession({
        ...session,
        currentRoundNumber: round.roundNumber,
        version: session.version + 1,
      });
      return round;
    });
  }

  async recordResult(input: RecordResultInput): Promise<MatchRecord> {
    if (
      !Number.isSafeInteger(input.team1Score) ||
      !Number.isSafeInteger(input.team2Score) ||
      input.team1Score < 0 ||
      input.team2Score < 0 ||
      input.team1Score === input.team2Score
    ) {
      throw new DomainError("INVALID_RESULT", "Enter two different non-negative whole scores.");
    }
    return this.repository.transaction(async (repository) => {
      const match = await requiredMatch(repository, input.matchId);
      const round = await requiredRound(repository, match.roundId);
      const session = await requiredSession(repository, round.sessionId);
      const updated: MatchRecord = {
        ...match,
        status: "completed",
        team1Score: input.team1Score,
        team2Score: input.team2Score,
        completedAt: this.dependencies.now(),
        version: match.version + 1,
      };
      await repository.updateMatch(updated);
      await replayRatings(session.groupId, repository);
      return updated;
    });
  }

  async cancelMatch(matchId: string): Promise<MatchRecord> {
    return this.repository.transaction(async (repository) => {
      const match = await requiredMatch(repository, matchId);
      const round = await requiredRound(repository, match.roundId);
      const session = await requiredSession(repository, round.sessionId);
      const updated: MatchRecord = {
        ...match,
        status: "cancelled",
        team1Score: null,
        team2Score: null,
        completedAt: this.dependencies.now(),
        version: match.version + 1,
      };
      await repository.updateMatch(updated);
      await replayRatings(session.groupId, repository);
      return updated;
    });
  }

  async completeRound(roundId: string): Promise<RoundRecord> {
    return this.repository.transaction(async (repository) => {
      const round = await requiredRound(repository, roundId);
      const records = await repository.listStartedRounds(round.sessionId);
      const record = records.find((item) => item.round.id === roundId)!;
      for (const match of record.matches) {
        if (match.status === "pending") {
          const playersForMatch = record.matchPlayers.filter((item) => item.matchId === match.id);
          const isSingles = playersForMatch.length === 2;
          if (isSingles) {
            await repository.updateMatch({
              ...match,
              status: "cancelled",
              version: match.version + 1,
            });
          } else {
            throw new DomainError("UNRESOLVED_MATCHES", "Resolve every court before continuing.");
          }
        }
      }
      const updated = {
        ...round,
        status: "completed" as const,
        completedAt: this.dependencies.now(),
        version: round.version + 1,
      };
      await repository.updateRound(updated);
      return updated;
    });
  }

  async undoLatestRound(sessionId: string): Promise<RoundRecord> {
    return this.repository.transaction(async (repository) => {
      const session = await requiredSession(repository, sessionId);
      const rounds = await repository.listStartedRounds(sessionId);
      const latest = rounds.toSorted((a, b) => b.round.roundNumber - a.round.roundNumber)[0];
      if (!latest) throw new DomainError("INVALID_STATE", "There is no round to undo.");
      await repository.deleteRound(latest.round.id);
      await repository.updateSession({
        ...session,
        currentRoundNumber: Math.max(0, session.currentRoundNumber - 1),
        version: session.version + 1,
      });
      await replayRatings(session.groupId, repository);
      return latest.round;
    });
  }

  async endSession(sessionId: string): Promise<SessionRecord> {
    return this.repository.transaction(async (repository) => {
      const session = await requiredSession(repository, sessionId);
      const updated = {
        ...session,
        status: "completed" as const,
        endedAt: this.dependencies.now(),
        version: session.version + 1,
      };
      await repository.updateSession(updated);
      return updated;
    });
  }
}
