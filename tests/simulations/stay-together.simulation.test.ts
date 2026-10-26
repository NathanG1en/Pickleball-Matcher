import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { SessionService } from "@/lib/domain/session-service";
import { validateStayTogetherLineup } from "@/lib/matchmaking/stay-together";
import type { StayTogetherPair } from "@/lib/matchmaking/types";
import { SqliteDomainRepository } from "./sqlite-repositories";

it("persists friend pairs and rotates nine individual bench turns over real saved rounds", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const repository = new SqliteDomainRepository(db);
    await repository.insertGroup({ id: "club", name: "School club", organizerPinHash: "fixture", createdAt: new Date() });
    const ids = Array.from({ length: 9 }, (_, i) => `p${i}`);
    for (const id of ids) await repository.createPlayer({ id, groupId: "club", name: id, active: true, initialRating: 1000, rating: 1000, ratedGamesPlayed: 0 });
    const pairs: StayTogetherPair[] = [["p0", "p1"], ["p2", "p3"], ["p4", "p5"], ["p6", "p7"]];
    let sequence = 0;
    const service = new SessionService(repository, { now: () => new Date(), nextId: kind => `${kind}-${++sequence}`, nextSeed: () => sequence });
    const session = await service.startSession({ groupId: "club", courtCount: 2, playerIds: ids, stayTogetherPairs: pairs });
    const sitters = new Set<string>();
    for (let round = 0; round < 9; round++) {
      expect((await repository.getSession(session.id))?.stayTogetherPairs).toEqual(pairs);
      const proposed = await service.proposeRound(session.id, round);
      expect(validateStayTogetherLineup(proposed, pairs, ids)).toBeNull();
      expect(proposed.sitting).toHaveLength(1);
      expect(sitters.has(proposed.sitting[0])).toBe(false);
      sitters.add(proposed.sitting[0]);
      const started = await service.startRound(session.id, proposed);
      const record = (await repository.listStartedRounds(session.id)).find(r => r.round.id === started.id)!;
      for (const match of record.matches) await service.recordResult({ matchId: match.id, team1Score: 11, team2Score: 5 });
      await service.completeRound(started.id);
    }
    expect(sitters.size).toBe(9);
  } finally { db.close(); }
});
