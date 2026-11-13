import { afterEach, describe, expect, it } from "vitest";
import { buildSessionLiveStamp } from "@/lib/sessions/live-stamp";
import { getSessionLiveStampAction } from "@/app/actions/sessions";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { MatchRecord, RoundRecord, SessionRecord } from "@/lib/domain/types";

const session: SessionRecord = {
  id: "ses-1", groupId: "grp-1", courtCount: 1, status: "active", currentRoundNumber: 1,
  startedAt: new Date("2026-11-13T10:00:00Z"), endedAt: null, version: 3,
};
const round: RoundRecord = {
  id: "rnd-1", sessionId: "ses-1", roundNumber: 1, status: "started", seed: 1,
  scoreBreakdown: {} as RoundRecord["scoreBreakdown"], createdAt: new Date(), startedAt: new Date(), completedAt: null, version: 1,
};
const match: MatchRecord = {
  id: "mat-1", roundId: "rnd-1", courtNumber: 1, status: "pending", team1Score: null, team2Score: null, completedAt: null, version: 1,
};

describe("buildSessionLiveStamp", () => {
  const base = buildSessionLiveStamp(session, [{ round, matches: [match] }]);

  it("is stable for the same visible state", () => {
    expect(buildSessionLiveStamp({ ...session }, [{ round: { ...round }, matches: [{ ...match }] }])).toBe(base);
  });

  it("changes when a round starts, a score is saved, or the session ends", () => {
    expect(buildSessionLiveStamp(session, [])).not.toBe(base);
    expect(buildSessionLiveStamp(session, [{ round, matches: [{ ...match, status: "completed", team1Score: 11, team2Score: 7 }] }])).not.toBe(base);
    expect(buildSessionLiveStamp({ ...session, status: "completed" }, [{ round, matches: [match] }])).not.toBe(base);
    expect(buildSessionLiveStamp({ ...session, currentRoundNumber: 2 }, [{ round, matches: [match] }])).not.toBe(base);
  });
});

describe("getSessionLiveStampAction", () => {
  afterEach(() => setActionRepository(null));

  it("returns the same stamp the page computes from its own data", async () => {
    const repo = new InMemoryRepositories({ sessions: [session] });
    setActionRepository(repo);

    const result = await getSessionLiveStampAction({ groupId: "grp-1", sessionId: "ses-1" });

    expect(result).toEqual({ ok: true, data: { stamp: buildSessionLiveStamp(session, await repo.listStartedRounds("ses-1")) } });
  });

  it("refuses a session from another group", async () => {
    setActionRepository(new InMemoryRepositories({ sessions: [session] }));
    const result = await getSessionLiveStampAction({ groupId: "grp-other", sessionId: "ses-1" });
    expect(result.ok).toBe(false);
  });
});
