import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { DomainRepository } from "@/lib/domain/repositories";
import { seedBatchScores } from "./batch-scores";

/** Real in-memory behavior with read accounting and snapshot-like return values. */
export class SessionRequestRepository extends InMemoryRepositories {
  reads = { session: 0, players: 0, attendance: 0, rounds: 0 };
  beforeTransaction?: () => void;
  resetReads() { this.reads = { session: 0, players: 0, attendance: 0, rounds: 0 }; }
  override async getSession(id: string) { this.reads.session++; return structuredClone(await super.getSession(id)); }
  override async listPlayers(groupId?: string, options?: { includeInactive?: boolean }) { this.reads.players++; return structuredClone(await super.listPlayers(groupId, options)); }
  override async listAttendance(sessionId: string) { this.reads.attendance++; return structuredClone(await super.listAttendance(sessionId)); }
  override async listStartedRounds(sessionId: string) { this.reads.rounds++; return structuredClone(await super.listStartedRounds(sessionId)); }
  override async transaction<T>(operation: (repository: DomainRepository) => Promise<T>): Promise<T> {
    this.beforeTransaction?.();
    return super.transaction(operation);
  }
}

export async function seedSessionRequest(repository: SessionRequestRepository) {
  await seedBatchScores(repository);
  repository.state.groups[0] = { ...repository.state.groups[0], ownerAccountId: "batch-account-0" };
  repository.state.sessions[0].currentRoundNumber = 0;
  repository.state.rounds = [];
  repository.state.matches = [];
  repository.state.matchPlayers = [];
  repository.state.players.push({ id: "inactive-player", groupId: "batch-group", name: "Inactive Player", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: false });
  repository.state.attendance.push({ sessionId: "batch-session", playerId: "inactive-player", joinedRound: 1, leftRound: null });
  repository.resetReads();
}

export const sessionStartInput = {
  groupId: "batch-group", sessionId: "batch-session", sessionVersion: 1,
  seed: 42, idempotencyKey: "request-reuse-start",
};
export const manualRequestCourts = Array.from({ length: 4 }, (_, i) => ({ courtNumber: i + 1,
  team1: [`batch-player-${i * 4}`, `batch-player-${i * 4 + 1}`],
  team2: [`batch-player-${i * 4 + 2}`, `batch-player-${i * 4 + 3}`] }));
