import { expect, it, vi } from "vitest";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { SessionService } from "@/lib/domain/session-service";
import { replayRatings } from "@/lib/domain/rating-replay";
import { replayRatingsAndSynergies, replaySynergies } from "@/lib/domain/synergy-replay";
import { batchNow, seedBatchScores } from "../fixtures/batch-scores";

const serviceFor = (repository: InMemoryRepositories) => new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });

async function fixture() {
  const repository = new InMemoryRepositories();
  const seeded = await seedBatchScores(repository, 2);
  await serviceFor(repository).recordMultipleResults(seeded.inputs);
  await serviceFor(repository).completeRound("batch-round");
  return { repository, ...seeded };
}

it.each(["single", "batch", "cancel", "delete", "undo", "reshuffle", "end-unfinished"] as const)("loads each global replay input once for %s", async operation => {
  const { repository, inputs } = await fixture();
  const service = serviceFor(repository);
  if (operation === "end-unfinished") repository.state.matches[1] = { ...repository.state.matches[1], status: "pending" };
  if (operation === "end-unfinished") repository.state.rounds[0] = { ...repository.state.rounds[0], status: "started" };
  const players = vi.spyOn(repository, "listPlayers");
  const history = vi.spyOn(repository, "listReplayMatches");
  const ratingWrites = vi.spyOn(repository, "replaceRatingState");
  const chemistryWrites = vi.spyOn(repository, "replaceSynergyState");
  if (operation === "single") await service.recordResult({ ...inputs[0], team1Score: 0, team2Score: 11 });
  if (operation === "batch") await service.recordMultipleResults(inputs.map(input => ({ ...input, matchVersion: 2, team1Score: 0, team2Score: 11 })));
  if (operation === "cancel") await service.cancelMatch("batch-match-0");
  if (operation === "delete") await service.deleteMatch("batch-match-0");
  if (operation === "undo") await service.undoLatestRound("batch-session");
  if (operation === "reshuffle") await service.reshuffleRound("batch-session", 42);
  if (operation === "end-unfinished") await service.endSession("batch-session");
  expect(players.mock.calls.filter(([groupId]) => groupId === undefined)).toEqual([[undefined, { includeInactive: true }]]);
  expect(history).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledWith();
  expect(ratingWrites).toHaveBeenCalledTimes(1);
  expect(chemistryWrites).toHaveBeenCalledTimes(1);
});

it.each(["rating-only", "chemistry-only"] as const)("preserves the %s persistence path", async operation => {
  const { repository, inputs } = await fixture();
  repository.state.rounds[0] = { ...repository.state.rounds[0], status: "started" };
  const ratingWrites = vi.spyOn(repository, "replaceRatingState");
  const chemistryWrites = vi.spyOn(repository, "replaceSynergyState");
  if (operation === "rating-only") await serviceFor(repository).recordResult(inputs[0]);
  else await serviceFor(repository).completeRound("batch-round");
  expect(ratingWrites).toHaveBeenCalledTimes(operation === "rating-only" ? 1 : 0);
  expect(chemistryWrites).toHaveBeenCalledTimes(operation === "chemistry-only" ? 1 : 0);
});

it("matches the legacy global replay with shared accounts, guests, inactive players, cancellations and ineligible chemistry", async () => {
  const { repository } = await fixture();
  const originals = repository.state.players.slice(0, 4);
  repository.state.players[5] = { ...repository.state.players[5], accountId: null };
  repository.state.players[6] = { ...repository.state.players[6], active: false };
  repository.state.players.push(...repository.state.players.filter(player => [0, 2, 4, 6].some(index => player.id === `batch-player-${index}`))
    .map(player => ({ ...player, id: `${player.id}-other`, groupId: "other-group" })));
  repository.state.matches = [];
  repository.state.matchPlayers = [];
  repository.state.replayMatches = [
    { id: "early", groupId: "batch-group", status: "completed", completedAt: batchNow, team1: [originals[0].id, originals[1].id], team2: [originals[2].id, originals[3].id], team1Score: 11, team2Score: 0, synergyEligible: false },
    { id: "cancelled", groupId: "batch-group", status: "cancelled", completedAt: batchNow, team1: [originals[0].id, originals[1].id], team2: [originals[2].id, originals[3].id], team1Score: 11, team2Score: 0, synergyEligible: true },
    { id: "later", groupId: "other-group", status: "completed", completedAt: new Date(batchNow.getTime() + 1000), team1: ["batch-player-0-other", "batch-player-4-other"], team2: ["batch-player-2-other", "batch-player-6-other"], team1Score: 0, team2Score: 11, synergyEligible: true },
    { id: "guests", groupId: "batch-group", status: "completed", completedAt: new Date(batchNow.getTime() + 2000), team1: ["batch-player-0", "batch-player-5"], team2: ["batch-player-2", "batch-player-7"], team1Score: 11, team2Score: 7, synergyEligible: true },
  ];
  const legacy = new InMemoryRepositories(structuredClone(repository.state));
  const shared = new InMemoryRepositories(structuredClone(repository.state));
  await legacy.transaction(async transaction => { await transaction.lockSynergyState(); await replayRatings("batch-group", transaction); await replaySynergies(transaction); });
  await shared.transaction(async transaction => { await transaction.lockSynergyState(); await replayRatingsAndSynergies("batch-group", transaction); });
  expect(shared.state).toEqual(legacy.state);
  expect(shared.state.ratingSnapshots.has("cancelled")).toBe(false);
  expect(shared.state.ratingSnapshots.has("early")).toBe(true);
  expect(await shared.getPairSynergy("batch-account-0", "batch-account-4")).toMatchObject({ matchesPlayed: 1, wins: 0 });
  expect(shared.state.players.find(player => player.id === "batch-player-0-other")?.rating).toEqual(shared.state.players[0].rating);
});

it("rolls back the source edit, ratings and chemistry if chemistry persistence fails", async () => {
  const { repository, inputs } = await fixture();
  const before = structuredClone(repository.state);
  vi.spyOn(repository, "replaceSynergyState").mockRejectedValueOnce(new Error("Chemistry write failed"));
  await expect(serviceFor(repository).recordResult({ ...inputs[0], team1Score: 0, team2Score: 11 })).rejects.toThrow("Chemistry write failed");
  expect(repository.state).toEqual(before);
});

it("reloads authoritative history on the next transaction rather than reusing an old calculation", async () => {
  const { repository } = await fixture();
  const history = vi.spyOn(repository, "listReplayMatches");
  const run = () => repository.transaction(transaction => replayRatingsAndSynergies("batch-group", transaction));
  await run();
  repository.state.matches[0] = { ...repository.state.matches[0], team1Score: 0, team2Score: 11 };
  await run();
  expect(history).toHaveBeenCalledTimes(2);
  expect(await repository.getPairSynergy("batch-account-0", "batch-account-1")).toMatchObject({ matchesPlayed: 1, wins: 0 });
  expect(await repository.getPlayerAccount("batch-account-0")).toMatchObject({ rating: 980, ratedGamesPlayed: 1 });
});
