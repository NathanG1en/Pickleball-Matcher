import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PlayerProfilePage from "@/app/players/page";
import PublicProfilePage from "@/app/players/[username]/page";
import { ClientDate, ClientTime } from "@/components/ui/client-date-time";
import { ScoreHistoryChart } from "@/components/players/score-history-chart";
import { PastSessionsList } from "@/components/groups/past-sessions-list";
import { SessionManagerClient } from "@/app/g/[groupId]/sessions/[sessionId]/session-manager-client";
import { OpenPlayManagerClient } from "@/app/g/[groupId]/sessions/[sessionId]/open-play-manager-client";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

vi.mock("@/lib/utils/hydration", () => ({ useHydrated: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/app/actions/action-context", async original => ({ ...await original<typeof import("@/app/actions/action-context")>(), getActivePlayerAccountId: async () => "account" }));
const instant = "2026-10-29T03:55:00.000Z";
afterEach(() => setActionRepository(null));

it("does not expose a server-local calendar date or clock time before hydration", () => {
  const html = renderToStaticMarkup(<><ClientDate date={instant} /><ClientTime date={instant} /></>);
  expect(html.match(/<time[^>]*><\/time>/g)).toHaveLength(2);
  expect(html).toContain(`dateTime="${instant}"`);
});

for (const profile of ["own", "public"] as const) {
  it(`defers ${profile} profile session dates to the browser while preserving custom names and timestamps`, async () => {
    setActionRepository(new InMemoryRepositories({
      groups: [{ id: "g", name: "Club", isPublic: true, organizerPinHash: "fixture", createdAt: new Date(instant) }],
      playerAccounts: [{ id: "account", username: "date_player", name: "Date Player", passwordHash: "fixture", skillLevel: "intermediate", initialRating: 1000, isPublic: true, createdAt: new Date(instant) }],
      players: [{ id: "p", groupId: "g", accountId: "account", name: "Date Player", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true }],
      sessions: [{ id: "s", groupId: "g", name: "Evening Club", courtCount: 1, status: "completed", currentRoundNumber: 1, version: 1, startedAt: new Date(instant), endedAt: new Date(instant) }],
      attendance: [{ sessionId: "s", playerId: "p", joinedRound: 1, leftRound: null }],
    }));
    const page = profile === "own" ? await PlayerProfilePage() : await PublicProfilePage({ params: Promise.resolve({ username: "date_player" }) });
    const html = renderToStaticMarkup(page);
    const article = html.match(/<article[^>]*data-testid="player-session-s"[\s\S]*?<\/article>/)?.[0];
    expect(article).toBeDefined();
    expect(article).toContain("Evening Club");
    expect(article).toContain(`dateTime="${instant}"`);
    expect(article).toMatch(/<time[^>]*><\/time>/);
  });
}

it("defers rating-chart dates and accessible labels until the browser can format them", () => {
  const html = renderToStaticMarkup(<ScoreHistoryChart history={[{ sessionId: "s", groupId: "g", groupName: "Club", startedAt: new Date(instant), rating: 1000, wins: 0, losses: 0 }]} />);
  expect(html).not.toContain("Oct ");
});

it("defers group-history dates and accessible labels until hydration", () => {
  const html = renderToStaticMarkup(<PastSessionsList groupId="g" sessions={[{ id: "s", courtCount: 1, currentRoundNumber: 0, status: "completed", startedAt: instant, endedAt: instant, rounds: [], totalGames: 0 }]} />);
  expect(html).not.toContain("Oct ");
});

for (const type of ["regular", "open_play"] as const) {
  it(`defers the default ${type} session title until hydration`, () => {
    const session = { id: "s", groupId: "g", type, courtCount: 1, currentRoundNumber: 0, status: "active" as const, version: 1, startedAt: new Date(instant), endedAt: null };
    const html = renderToStaticMarkup(type === "regular"
      ? <SessionManagerClient groupId="g" session={session} players={[]} startedRounds={[]} initialProposal={null} canManage={false} />
      : <OpenPlayManagerClient groupId="g" session={session} players={[]} startedRounds={[]} />);
    expect(html).not.toContain("Oct ");
  });
}
