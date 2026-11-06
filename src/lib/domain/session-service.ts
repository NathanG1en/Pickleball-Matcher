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
import {
  matchmakingPlayers,
  sessionPairHistory,
} from "@/lib/matchmaking/proposal";

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
      const context = await repository.getRoundCompletionContext(roundId);
      if (!context) throw new DomainError("NOT_FOUND", "Round not found.");
      const { round } = context;
      for (const { match, playerCount } of context.pendingMatches) {
        if (playerCount === 2) {
          await repository.updateMatch({
            ...match,
            status: "cancelled",
            version: match.version + 1,
          });
        } else {
          throw new DomainError("UNRESOLVED_MATCHES", "Resolve every court before continuing.");
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

  async saveAndStartNextRound(input: {
    sessionId: string;
    roundId: string;
    results: readonly BatchRecordResultInput[];
    nextProposal?: RoundProposal;
    seed?: number;
    expectedSessionVersion?: number;
  }): Promise<{ completedRound: RoundRecord; startedRound: StartedRoundRecord }> {
    if (new Set(input.results.map((r) => r.matchId)).size !== input.results.length) {
      throw new DomainError("INVALID_RESULT", "A match can only appear once in a score batch.");
    }
    for (const r of input.results) {
      if (
        !Number.isSafeInteger(r.team1Score) ||
        !Number.isSafeInteger(r.team2Score) ||
        r.team1Score < 0 ||
        r.team2Score < 0 ||
        r.team1Score === r.team2Score
      ) {
        throw new DomainError("INVALID_RESULT", "Enter two different non-negative whole scores for each match.");
      }
    }

    return this.repository.transaction(async (repository) => {
      await repository.lockSynergyState();
      const session = await requiredSession(repository, input.sessionId);
      if (session.status !== "active") {
        throw new DomainError("INVALID_STATE", "The session has ended.");
      }
      if (input.expectedSessionVersion !== undefined && session.version !== input.expectedSessionVersion) {
        throw new DomainError("INVALID_STATE", "The session changed. Refresh before continuing.");
      }

      // 1. Save scores if provided
      if (input.results.length > 0) {
        const contexts = await repository.getMatchResultContexts(input.results.map((r) => r.matchId));
        const byId = new Map(contexts.map((c) => [c.match.id, c]));
        for (const r of input.results) {
          const context = byId.get(r.matchId);
          if (!context) throw new DomainError("NOT_FOUND", "Match not found.");
          if (r.matchVersion !== undefined && r.matchVersion !== context.match.version) {
            throw new DomainError("INVALID_STATE", "A match changed. Refresh before saving.");
          }
        }
        const updatedMatches = input.results.map((r): MatchRecord => {
          const match = byId.get(r.matchId)!.match;
          return {
            ...match,
            status: "completed",
            team1Score: r.team1Score,
            team2Score: r.team2Score,
            completedAt: match.completedAt ?? this.dependencies.now(),
            version: match.version + 1,
          };
        });
        await repository.updateMatches(updatedMatches);
      }

      // 2. Complete current round
      const roundContext = await repository.getRoundCompletionContext(input.roundId);
      if (!roundContext) throw new DomainError("NOT_FOUND", "Round not found.");
      for (const { match, playerCount } of roundContext.pendingMatches) {
        if (playerCount === 2) {
          await repository.updateMatch({
            ...match,
            status: "cancelled",
            version: match.version + 1,
          });
        } else {
          throw new DomainError("UNRESOLVED_MATCHES", "Resolve every court before continuing.");
        }
      }
      const completedRound: RoundRecord = {
        ...roundContext.round,
        status: "completed",
        completedAt: this.dependencies.now(),
        version: roundContext.round.version + 1,
      };
      await repository.updateRound(completedRound);

      // 3. Replay ratings and synergies
      await replayRatingsAndSynergies(session.groupId, repository);

      // 4. Determine next round proposal
      let proposal = input.nextProposal;
      if (!proposal) {
        const [players, attendance, rounds] = await Promise.all([
          repository.listPlayers(session.groupId),
          repository.listAttendance(session.id),
          repository.listStartedRounds(session.id),
        ]);
        const result = generateRound({
          players: matchmakingPlayers(players, attendance, rounds, session.currentRoundNumber, Boolean(session.stayTogetherPairs?.length)),
          courts: session.courtCount,
          courtPlayerCounts: session.courtPlayerCounts,
          stayTogetherPairs: session.stayTogetherPairs,
          pairHistory: sessionPairHistory(rounds),
          config: DEFAULT_MATCHMAKING_CONFIG,
          seed: input.seed ?? this.dependencies.nextSeed(),
        });
        if (!result.ok) throw new DomainError(result.error.code, result.error.message);
        proposal = result.value;
      }

      // 5. Start next round
      const now = this.dependencies.now();
      const nextRound: RoundRecord = {
        id: this.dependencies.nextId("round"),
        sessionId: session.id,
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
          roundId: nextRound.id,
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
      const startedRoundRecord: StartedRoundRecord = {
        round: nextRound,
        matches,
        matchPlayers,
        sits: proposal.sitting.map((playerId) => ({ roundId: nextRound.id, playerId })),
      };
      await repository.insertStartedRound(startedRoundRecord);
      await repository.updateSession({
        ...session,
        currentRoundNumber: nextRound.roundNumber,
        version: session.version + 1,
      });

      return { completedRound, startedRound: startedRoundRecord };
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
