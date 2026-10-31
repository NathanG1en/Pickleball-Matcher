import { canonicalPairs, validateStayTogetherPairs, validateStayTogetherLineup } from "@/lib/matchmaking/stay-together";
import type { StayTogetherPair } from "@/lib/matchmaking/types";
import { DomainError } from "@/lib/domain/errors";
import type { DomainRepository } from "@/lib/domain/repositories";
import { replayRatings } from "@/lib/domain/rating-replay";
import { replayRatingsAndSynergies, replaySynergies } from "@/lib/domain/synergy-replay";
import type {
  AttendanceRecord,
  ChangeAttendanceInput,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
  RecordResultInput,
  BatchRecordResultInput,
  RoundProposal,
  RoundProposalSnapshot,
  RoundRecord,
  SessionRecord,
  SessionServiceDependencies,
  StartedRoundRecord,
  StartSessionInput,
  UpdateCourtConfigInput,
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
      if (team1.length === 2) touch(team1[0], team1[1], "partner");
      if (team2.length === 2) touch(team2[0], team2[1], "partner");
      for (const first of team1) for (const second of team2) touch(first, second, "opponent");
    }
  }
  return [...history.values()];
}

function matchmakingPlayers(
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
  for (const record of rounds) {
    const presentInRound = new Set([...record.matchPlayers.map(member => member.playerId), ...record.sits.map(sit => sit.playerId)]);
    for (const id of presentInRound) historicalEligibility.set(id, (historicalEligibility.get(id) ?? 0) + 1);
    for (const member of record.matchPlayers) {
      games.set(member.playerId, (games.get(member.playerId) ?? 0) + 1);
    }
    for (const match of record.matches) {
      if (match.status === "cancelled") continue;
      const matchMembers = record.matchPlayers.filter((mp) => mp.matchId === match.id);
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
        eligibleRounds: Math.max(0, currentRoundNumber - item.joinedRound + 1, preserveParticipationHistory ? historicalEligibility.get(player.id) ?? 0 : 0),
        satPreviousRound: previousSits.has(player.id),
        timesPlayed2v1: timesPlayed2v1.get(player.id) ?? 0,
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
    if (input.courtPlayerCounts && (
      input.courtPlayerCounts.length !== input.courtCount ||
      input.courtPlayerCounts.some((count) => ![2, 3, 4].includes(count)) ||
      input.courtPlayerCounts.reduce((sum, count) => sum + count, 0) > input.playerIds.length
    )) {
      throw new DomainError("INVALID_STATE", "Court sizes must be 2, 3, or 4 and fit the selected players.");
    }
    const stayTogetherPairs = canonicalPairs(input.stayTogetherPairs ?? []);
    if (stayTogetherPairs.length) {
      const roster = await this.repository.listPlayers(input.groupId);
      const selected = input.playerIds.filter(id => roster.some(player => player.id === id && player.active));
      const error = validateStayTogetherPairs(stayTogetherPairs, selected);
      if (error) throw new DomainError("INVALID_STATE", error);
    }
    const now = this.dependencies.now();
    const session: SessionRecord = {
      id: this.dependencies.nextId("session"),
      groupId: input.groupId,
      courtCount: input.courtCount,
      stayTogetherPairs,
      courtPlayerCounts: input.courtPlayerCounts,
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
      await repository.lockPartnerRequests(input.sessionId);
      const session = await requiredSession(repository, input.sessionId);
      if (input.present) {
        const groupPlayers = await repository.listPlayers(session.groupId);
        const player = groupPlayers.find((p) => p.id === input.playerId);
        if (!player || !player.active) {
          throw new DomainError("INVALID_STATE", "Player is not an active member of this group.");
        }
      }
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

  async updateStayTogetherPairs(input: { sessionId: string; sessionVersion: number; pairs: readonly StayTogetherPair[] }): Promise<SessionRecord> {
    return this.repository.transaction(async repository => {
      await repository.lockPartnerRequests(input.sessionId);
      const session = await requiredSession(repository, input.sessionId);
      if (session.status !== "active") throw new DomainError("INVALID_STATE", "The session has ended.");
      if (session.type === "open_play") throw new DomainError("INVALID_STATE", "Stay Together is available in normal sessions only.");
      if (session.version !== input.sessionVersion) throw new DomainError("INVALID_STATE", "The session changed. Refresh and try again.");
      const roster = await repository.listPlayers(session.groupId, { includeInactive: true });
      const attendance = await repository.listAttendance(session.id);
      const pairs = canonicalPairs(input.pairs);
      const error = validateStayTogetherPairs(pairs, roster.map(p => p.id));
      if (error) throw new DomainError("INVALID_STATE", error);
      const existing = new Set(canonicalPairs(session.stayTogetherPairs ?? []).map(pair => JSON.stringify(pair)));
      for (const pair of pairs) {
        if (existing.has(JSON.stringify(pair))) continue;
        if (!pair.every(id => roster.some(p => p.id === id && p.active) && attendance.some(a => a.playerId === id && a.leftRound === null))) {
          throw new DomainError("INVALID_STATE", "New Stay Together partners must be currently attending this session.");
        }
      }
      const updated = { ...session, stayTogetherPairs: pairs, version: session.version + 1 };
      await repository.updateSession(updated);
      return updated;
    });
  }

  async updateCourtConfig(input: UpdateCourtConfigInput): Promise<{ session: SessionRecord; proposal?: RoundProposal }> {
    return this.repository.transaction(async (repository) => {
      const session = await requiredSession(repository, input.sessionId);
      if (session.status !== "active") {
        throw new DomainError("INVALID_STATE", "The session has ended.");
      }
      if (!Number.isSafeInteger(input.courtCount) || input.courtCount <= 0 || input.courtCount > 6) {
        throw new DomainError("INVALID_STATE", "Court count must be between 1 and 6.");
      }

      const [players, attendance, rounds] = await Promise.all([
        repository.listPlayers(session.groupId),
        repository.listAttendance(input.sessionId),
        repository.listStartedRounds(input.sessionId),
      ]);
      const activePlayers = matchmakingPlayers(players, attendance, rounds, session.currentRoundNumber, Boolean(session.stayTogetherPairs?.length));

      if (input.courtPlayerCounts) {
        if (
          input.courtPlayerCounts.length !== input.courtCount ||
          input.courtPlayerCounts.some((count) => ![2, 3, 4].includes(count))
        ) {
          throw new DomainError("INVALID_STATE", "Court sizes must be 2, 3, or 4 and match the court count.");
        }
        const totalCourtCapacity = input.courtPlayerCounts.reduce((sum, count) => sum + count, 0);
        if (totalCourtCapacity > activePlayers.length) {
          throw new DomainError("INVALID_STATE", "Court sizes cannot exceed the number of present players.");
        }
      }

      const updatedSession: SessionRecord = {
        ...session,
        courtCount: input.courtCount,
        courtPlayerCounts: input.courtPlayerCounts ? [...input.courtPlayerCounts] : undefined,
        version: session.version + 1,
      };

      await repository.updateSession(updatedSession);

      const latestStarted = rounds.at(-1);
      const isRoundInProgress = latestStarted && latestStarted.round.status === "started";
      let proposal: RoundProposal | undefined;

      if (!isRoundInProgress && activePlayers.length >= 2) {
        try {
          const result = generateRound({
            players: activePlayers,
            courts: updatedSession.courtCount,
            courtPlayerCounts: updatedSession.courtPlayerCounts,
            stayTogetherPairs: updatedSession.stayTogetherPairs,
            pairHistory: sessionPairHistory(rounds),
            config: DEFAULT_MATCHMAKING_CONFIG,
            seed: this.dependencies.nextSeed(),
          });
          if (!result.ok && updatedSession.stayTogetherPairs?.length) throw new DomainError("INVALID_STATE", result.error.message);
          if (result.ok) {
            proposal = result.value;
          }
        } catch (error) {
          if (updatedSession.stayTogetherPairs?.length) throw error;
          // If proposal cannot be generated with current configuration, leave undefined
        }
      }

      return { session: updatedSession, proposal };
    });
  }

  async proposeRound(
    sessionId: string,
    seed = this.dependencies.nextSeed(),
    temperature = 0,
  ): Promise<RoundProposal> {
    const session = await requiredSession(this.repository, sessionId);
    return this.proposeRoundForSession(session, seed, temperature);
  }

  /** Reuse an authorized session record while loading the remaining read inputs. */
  async proposeRoundForSession(
    session: SessionRecord,
    seed = this.dependencies.nextSeed(),
    temperature = 0,
  ): Promise<RoundProposal> {
    const [players, attendance, rounds] = await Promise.all([
      this.repository.listPlayers(session.groupId),
      this.repository.listAttendance(session.id),
      this.repository.listStartedRounds(session.id),
    ]);
    return this.proposeRoundFromSnapshot({ session, players, attendance, rounds }, seed, temperature);
  }

  /** No reads or caching: callers supply data loaded for this read-only request. */
  proposeRoundFromSnapshot(
    { session, players, attendance, rounds }: RoundProposalSnapshot,
    seed = this.dependencies.nextSeed(),
    temperature = 0,
  ): RoundProposal {
    const result = generateRound({
      players: matchmakingPlayers(players, attendance, rounds, session.currentRoundNumber, Boolean(session.stayTogetherPairs?.length)),
      courts: session.courtCount,
      courtPlayerCounts: session.courtPlayerCounts,
      stayTogetherPairs: session.stayTogetherPairs,
      pairHistory: sessionPairHistory(rounds),
      config: DEFAULT_MATCHMAKING_CONFIG,
      seed,
      temperature,
    });
    if (!result.ok) throw new DomainError(result.error.code, result.error.message);
    return result.value;
  }

  async startRound(sessionId: string, proposal: RoundProposal, expectedVersion?: number): Promise<RoundRecord> {
    return this.repository.transaction(async (repository) => {
      const session = await requiredSession(repository, sessionId);
      if (session.status !== "active") {
        throw new DomainError("INVALID_STATE", "The session has ended.");
      }
      if (expectedVersion !== undefined && session.version !== expectedVersion) throw new DomainError("INVALID_STATE", "The session changed. Refresh the lineup before starting.");
      if (session.stayTogetherPairs?.length) {
        const [roster, attendance, rounds] = await Promise.all([repository.listPlayers(session.groupId), repository.listAttendance(sessionId), repository.listStartedRounds(sessionId)]);
        const present = matchmakingPlayers(roster, attendance, rounds, session.currentRoundNumber, Boolean(session.stayTogetherPairs?.length)).map(p => p.id);
        const all = [...proposal.courts.flatMap(c => [...c.team1, ...c.team2]), ...proposal.sitting];
        const doubles = Math.min(Math.floor(present.length / 4), session.courtCount);
        const sizes = session.courtPlayerCounts ?? [...Array<number>(doubles).fill(4), ...(session.courtCount > doubles && present.length - doubles * 4 >= 2 ? [2] : [])];
        if (all.length !== present.length || new Set(all).size !== all.length || all.some(id => !present.includes(id)) || proposal.courts.length !== sizes.length || proposal.courts.some((c, i) => c.courtNumber !== i + 1 || c.team1.length + c.team2.length !== sizes[i] || c.team1.length < 1 || c.team2.length < 1 || c.team1.length > 2 || c.team2.length > 2)) {
          throw new DomainError("INVALID_STATE", "The lineup must include every present player once and match the configured courts.");
        }
        const error = validateStayTogetherLineup(proposal, session.stayTogetherPairs, present);
        if (error) throw new DomainError("INVALID_STATE", error);
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
          rated: court.team1.length === 2 && court.team2.length === 2,
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
      await repository.lockSynergyState();
      const match = await requiredMatch(repository, input.matchId);
      const round = await requiredRound(repository, match.roundId);
      const session = await requiredSession(repository, round.sessionId);
      const updated: MatchRecord = {
        ...match,
        status: "completed",
        team1Score: input.team1Score,
        team2Score: input.team2Score,
        completedAt: match.completedAt ?? this.dependencies.now(),
        version: match.version + 1,
      };
      await repository.updateMatch(updated);
      if (round.status === "completed" || session.status === "completed") {
        await replayRatingsAndSynergies(session.groupId, repository);
      } else {
        await replayRatings(session.groupId, repository);
      }
      return updated;
    });
  }

  async recordMultipleResults(
    inputs: readonly BatchRecordResultInput[],
    scope?: { readonly groupId: string; readonly sessionId?: string },
  ): Promise<MatchRecord[]> {
    if (inputs.length === 0) return [];
    if (new Set(inputs.map(input => input.matchId)).size !== inputs.length) {
      throw new DomainError("INVALID_RESULT", "A match can only appear once in a score batch.");
    }
    for (const input of inputs) {
      if (
        !Number.isSafeInteger(input.team1Score) ||
        !Number.isSafeInteger(input.team2Score) ||
        input.team1Score < 0 ||
        input.team2Score < 0 ||
        input.team1Score === input.team2Score
      ) {
        throw new DomainError("INVALID_RESULT", "Enter two different non-negative whole scores for each match.");
      }
    }
    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
      const contexts = await repository.getMatchResultContexts(inputs.map(input => input.matchId));
      const byId = new Map(contexts.map(context => [context.match.id, context]));
      const first = byId.get(inputs[0].matchId);
      if (!first) throw new DomainError("NOT_FOUND", "Match not found.");
      for (const input of inputs) {
        const context = byId.get(input.matchId);
        if (!context) throw new DomainError("NOT_FOUND", "Match not found.");
        if (context.groupId !== (scope?.groupId ?? first.groupId) ||
            context.sessionId !== (scope?.sessionId ?? first.sessionId)) {
          throw new DomainError("INVALID_STATE", "Every match must belong to the selected group and session.");
        }
        if (input.matchVersion !== undefined && input.matchVersion !== context.match.version) {
          throw new DomainError("INVALID_STATE", "A match changed. Refresh the session before saving these scores.");
        }
      }
      const updatedMatches = inputs.map((input): MatchRecord => {
        const match = byId.get(input.matchId)!.match;
        return {
          ...match,
          status: "completed",
          team1Score: input.team1Score,
          team2Score: input.team2Score,
          completedAt: match.completedAt ?? this.dependencies.now(),
          version: match.version + 1,
        };
      });
      await repository.updateMatches(updatedMatches);
      if (contexts.some(context => context.roundStatus === "completed" || context.sessionStatus === "completed")) {
        await replayRatingsAndSynergies(first.groupId, repository);
      } else {
        await replayRatings(first.groupId, repository);
      }
      return updatedMatches;
    });
  }

  async recalculateSynergies(): Promise<void> {
    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
      await replaySynergies(repository);
    });
  }

  async cancelMatch(matchId: string): Promise<MatchRecord> {
    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
      const match = await requiredMatch(repository, matchId);
      const round = await requiredRound(repository, match.roundId);
      const session = await requiredSession(repository, round.sessionId);
      const updated: MatchRecord = {
        ...match,
        status: "cancelled",
        team1Score: null,
        team2Score: null,
        completedAt: match.completedAt ?? this.dependencies.now(),
        version: match.version + 1,
      };
      await repository.updateMatch(updated);
      await replayRatingsAndSynergies(session.groupId, repository);
      return updated;
    });
  }

  async deleteMatch(matchId: string): Promise<void> {
    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
      const match = await repository.getMatch(matchId);
      if (!match) return;
      const round = await requiredRound(repository, match.roundId);
      const session = await requiredSession(repository, round.sessionId);
      await repository.deleteMatch(matchId);
      await replayRatingsAndSynergies(session.groupId, repository);
    });
  }

  async completeRound(roundId: string): Promise<RoundRecord> {
    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
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

      await replaySynergies(repository);

      return updated;
    });
  }

  async undoLatestRound(sessionId: string): Promise<RoundRecord> {
    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
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
      await replayRatingsAndSynergies(session.groupId, repository);
      return latest.round;
    });
  }

  async reshuffleRound(
    sessionId: string,
    seed = this.dependencies.nextSeed(),
    temperature = 0,
  ): Promise<RoundProposal> {
    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
      const session = await requiredSession(repository, sessionId);
      const rounds = await repository.listStartedRounds(sessionId);
      const latest = rounds.toSorted((a, b) => b.round.roundNumber - a.round.roundNumber)[0];
      if (!latest) throw new DomainError("INVALID_STATE", "There is no round to reshuffle.");
      await repository.deleteRound(latest.round.id);
      const updatedSession = {
        ...session,
        currentRoundNumber: Math.max(0, session.currentRoundNumber - 1),
        version: session.version + 1,
      };
      await repository.updateSession(updatedSession);
      await replayRatingsAndSynergies(session.groupId, repository);

      const [players, attendance, remainingRounds] = await Promise.all([
        repository.listPlayers(session.groupId),
        repository.listAttendance(sessionId),
        repository.listStartedRounds(sessionId),
      ]);
      const result = generateRound({
        players: matchmakingPlayers(players, attendance, remainingRounds, updatedSession.currentRoundNumber, Boolean(session.stayTogetherPairs?.length)),
        courts: session.courtCount,
        courtPlayerCounts: session.courtPlayerCounts,
      stayTogetherPairs: session.stayTogetherPairs,
        pairHistory: sessionPairHistory(remainingRounds),
        config: DEFAULT_MATCHMAKING_CONFIG,
        seed,
        temperature,
      });
      if (!result.ok) throw new DomainError(result.error.code, result.error.message);
      return result.value;
    });
  }

  async endSession(sessionId: string): Promise<SessionRecord> {
    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
      const session = await requiredSession(repository, sessionId);
      const startedRounds = await repository.listStartedRounds(sessionId);
      let hadUnfinishedMatches = false;

      for (const sr of startedRounds) {
        if (sr.round.status === "started") {
          for (const match of sr.matches) {
            if (match.status === "pending") {
              hadUnfinishedMatches = true;
              await repository.updateMatch({
                ...match,
                status: "cancelled",
                team1Score: null,
                team2Score: null,
                completedAt: this.dependencies.now(),
                version: match.version + 1,
              });
            }
          }
          await repository.updateRound({
            ...sr.round,
            status: "completed",
            completedAt: this.dependencies.now(),
            version: sr.round.version + 1,
          });
        }
      }

      const updated = {
        ...session,
        status: "completed" as const,
        endedAt: this.dependencies.now(),
        version: session.version + 1,
      };
      await repository.updateSession(updated);
      if (hadUnfinishedMatches) {
        await replayRatingsAndSynergies(session.groupId, repository);
      } else {
        await replaySynergies(repository);
      }
      return updated;
    });
  }
}
