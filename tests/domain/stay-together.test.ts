import { expect, it } from "vitest";
import { SessionService } from "@/lib/domain/session-service";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
const make = () => {
  const repository = new InMemoryRepositories({ players: Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: String(i), groupId: "g", active: true, initialRating: 1000, rating: 1000, ratedGamesPlayed: 0 })) });
  let id = 0;
  return { repository, service: new SessionService(repository, { nextId: kind => `${kind}-${++id}`, now: () => new Date(), nextSeed: () => 1 }) };
};
it("persists setup pairs and validates the actual selected roster", async () => {
  const { repository, service } = make();
  await expect(service.startSession({ groupId: "g", courtCount: 1, playerIds: ["0", "1", "2", "3"], stayTogetherPairs: [["0", "5"]] })).rejects.toThrow(/partners|selected/i);
  const session = await service.startSession({ groupId: "g", courtCount: 1, playerIds: ["0", "1", "2", "3", "4"], stayTogetherPairs: [["1", "0"]] });
  expect((await repository.getSession(session.id))?.stayTogetherPairs).toEqual([["0", "1"]]);
  const proposal = await service.proposeRound(session.id, 2);
  expect(proposal.courts.flatMap(c => [c.team1, c.team2]).some(t => t.includes("0") && t.includes("1")) || proposal.sitting.includes("0") || proposal.sitting.includes("1")).toBe(true);
});
it("rejects custom lineups splitting active friends and missing participants", async () => {
  const { service } = make();
  const session = await service.startSession({ groupId: "g", courtCount: 1, playerIds: ["0", "1", "2", "3"], stayTogetherPairs: [["0", "1"]] });
  const proposal = await service.proposeRound(session.id);
  await expect(service.startRound(session.id, { ...proposal, courts: [{ courtNumber: 1, team1: ["0", "2"], team2: ["1", "3"] }] })).rejects.toThrow(/same team/i);
  await expect(service.startRound(session.id, { ...proposal, courts: [{ courtNumber: 1, team1: ["0", "1"], team2: ["2"] }] })).rejects.toThrow(/court|player/i);
});
it("allows organizer settings changes for future rounds with version checks", async () => {
  const { repository, service } = make();
  const session = await service.startSession({ groupId: "g", courtCount: 1, playerIds: ["0", "1", "2", "3"] });
  const first = await service.proposeRound(session.id);
  await service.startRound(session.id, first);
  const current = (await repository.getSession(session.id))!;
  const history = structuredClone(repository.state.matchPlayers);
  const changed = await service.updateStayTogetherPairs({ sessionId: session.id, sessionVersion: current.version, pairs: [["0", "1"]] });
  expect(changed.version).toBe(current.version + 1);
  expect(repository.state.matchPlayers).toEqual(history);
  await expect(service.updateStayTogetherPairs({ sessionId: session.id, sessionVersion: current.version, pairs: [] })).rejects.toThrow(/changed|refresh/i);
  await service.changeAttendance({ sessionId: session.id, playerId: "1", present: false });
  expect((await repository.getSession(session.id))?.stayTogetherPairs).toEqual([["0", "1"]]);
  expect((await service.proposeRound(session.id)).courts.flatMap(c => [...c.team1, ...c.team2])).not.toContain("1");
});
it("rejects cross-group and ended-session pairing changes", async () => {
  const { service } = make();
  const session = await service.startSession({ groupId: "g", courtCount: 1, playerIds: ["0", "1", "2", "3"] });
  await expect(service.updateStayTogetherPairs({ sessionId: session.id, sessionVersion: 1, pairs: [["0", "outside"]] })).rejects.toThrow();
  await service.endSession(session.id);
  await expect(service.updateStayTogetherPairs({ sessionId: session.id, sessionVersion: 2, pairs: [] })).rejects.toThrow(/ended/i);
});
it("preserves a returning friend's participation history instead of benching them as overplayed", async () => {
  const { service } = make();
  const session = await service.startSession({ groupId: "g", courtCount: 1, playerIds: ["0", "1", "2", "3", "4", "5"], stayTogetherPairs: [["0", "1"], ["2", "3"], ["4", "5"]] });
  for (let round = 0; round < 8; round++) await service.startRound(session.id, await service.proposeRound(session.id, round));
  const before = await Promise.all([1, 2, 3].map(seed => service.proposeRound(session.id, seed)));
  await service.changeAttendance({ sessionId: session.id, playerId: "0", present: false });
  await service.changeAttendance({ sessionId: session.id, playerId: "0", present: true });
  const after = await Promise.all([1, 2, 3].map(seed => service.proposeRound(session.id, seed)));
  expect(after).toEqual(before);
});
