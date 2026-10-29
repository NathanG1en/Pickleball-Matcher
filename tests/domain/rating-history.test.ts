import { expect, it } from "vitest";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { seedRatingHistory, expectedHistoryRatings } from "../fixtures/rating-history";

it("carries the historical rating into empty and unrated sessions across groups without using future results", async () => {
  const repository = new InMemoryRepositories();
  await seedRatingHistory(repository);
  const history = await repository.listPlayerSessionHistory("history-account");
  expect(Object.fromEntries(history.map(session => [session.sessionId, session.rating]))).toEqual(expectedHistoryRatings);
  expect(history.find(session => session.sessionId === "empty")).toMatchObject({ wins: 0, losses: 0 });
  expect(history.find(session => session.sessionId === "unrated")).toMatchObject({ wins: 1, losses: 0 });
});

it("uses match ID to resolve snapshots with the same completion time consistently", async () => {
  const repository = new InMemoryRepositories();
  await seedRatingHistory(repository);
  const match = repository.state.matches.find(item => item.id === "played-match")!;
  const member = repository.state.matchPlayers.find(item => item.matchId === match.id && item.playerId === "history-a-player")!;
  repository.state.matches.push({ ...match, id: "played-earlier-match" });
  repository.state.matchPlayers.push({ ...member, matchId: "played-earlier-match", ratingAfter: 1040 });

  const history = await repository.listPlayerSessionHistory("history-account");
  expect(history.find(session => session.sessionId === "played")?.rating).toBe(1068.3274659182405);
  expect(history.find(session => session.sessionId === "empty")?.rating).toBe(1068.3274659182405);
});
