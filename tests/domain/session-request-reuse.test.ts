import { expect, it, vi } from "vitest";
import { SessionService } from "@/lib/domain/session-service";
import { seedSessionRequest, SessionRequestRepository } from "../fixtures/session-request";

it("calculates the same paired proposal from a supplied snapshot without reads or mutations", async () => {
  const repository = new SessionRequestRepository();
  await seedSessionRequest(repository);
  const session = { ...repository.state.sessions[0], stayTogetherPairs: [["batch-player-0", "batch-player-1"]] as const };
  repository.state.sessions[0] = session;
  const snapshot = structuredClone({ session, players: repository.state.players, attendance: repository.state.attendance, rounds: [] });
  const before = structuredClone(snapshot);
  const nextSeed = vi.fn(() => 42);
  const service = new SessionService(repository, { now: () => new Date(), nextId: kind => kind, nextSeed });
  const expected = await service.proposeRound(session.id, 42, 0.25);
  repository.resetReads();
  const actual = service.proposeRoundFromSnapshot(snapshot, 42, 0.25);
  expect(actual).toEqual(expected);
  expect(actual.courts.some(court => [court.team1, court.team2].some(team => team.includes("batch-player-0") && team.includes("batch-player-1")))).toBe(true);
  expect(actual.courts.flatMap(court => [...court.team1, ...court.team2])).not.toContain("inactive-player");
  expect(repository.reads).toEqual({ session: 0, players: 0, attendance: 0, rounds: 0 });
  expect(snapshot).toEqual(before);
  expect(nextSeed).not.toHaveBeenCalled();
  expect(service.proposeRoundFromSnapshot(snapshot, undefined, 0.25)).toEqual(expected);
  expect(nextSeed).toHaveBeenCalledTimes(1);
});
