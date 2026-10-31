import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ActiveSessionPage from "@/app/g/[groupId]/sessions/[sessionId]/page";
import { setActionRepository } from "@/app/actions/action-context";
import { seedSessionRequest, SessionRequestRepository } from "../fixtures/session-request";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/app/actions/action-context", async importOriginal => ({ ...await importOriginal<typeof import("@/app/actions/action-context")>(),
  getActivePlayerAccountId: async () => "batch-account-0", getActiveOrganizerSession: async () => null }));
let repository: SessionRequestRepository;
beforeEach(async () => { repository = new SessionRequestRepository(); await seedSessionRequest(repository); setActionRepository(repository); });
afterEach(() => setActionRepository(null));
const renderPage = async () => renderToStaticMarkup(await ActiveSessionPage({ params: Promise.resolve({ groupId: "batch-group", sessionId: "batch-session" }) }));

it("builds the organizer proposal from data already loaded once by the page", async () => {
  const html = await renderPage();
  expect(html).toContain("Reshuffle");
  expect(html).toContain("Court 4");
  expect(html).toContain("batch-player-15");
  expect(html).not.toContain("Inactive Player");
  expect(repository.reads).toEqual({ session: 1, players: 1, attendance: 1, rounds: 1 });
});

it("loads a fresh snapshot on the next request after a player replacement", async () => {
  await renderPage();
  repository.state.players = repository.state.players.map(player => player.id === "batch-player-15" ? { ...player, active: false } : player);
  repository.state.players.push({ id: "fresh-arrival", groupId: "batch-group", name: "Fresh Arrival", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true });
  repository.state.attendance.push({ sessionId: "batch-session", playerId: "fresh-arrival", joinedRound: 1, leftRound: null });
  repository.resetReads();
  const html = await renderPage();
  expect(html).toContain("Fresh Arrival");
  expect(html).not.toContain("batch-player-15");
  expect(repository.reads).toEqual({ session: 1, players: 1, attendance: 1, rounds: 1 });
});
