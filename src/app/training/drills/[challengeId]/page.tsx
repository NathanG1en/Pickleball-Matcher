import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getActionRepository,
  getActivePlayerAccountId,
  getActiveGuestPlayerId,
} from "@/app/actions/action-context";
import { DrillTrendChart } from "@/components/training/drill-trend-chart";
import { DeleteAttemptButton, DrillHistoryLogger } from "@/components/training/drill-history-client";
import {
  buildDailyBestSeries,
  formatDaysAgo,
  formatLastResultValue,
  formatMetricValue,
  formatShortDate,
  summarizeDrillTrend,
  rankPersonalBests,
  toLastResultSummary,
} from "@/lib/domain/training-history";
import { PersonalBests } from "@/components/training/personal-bests";
import { PickleballMedal } from "@/components/training/pickleball-medal";

const RANGE_DAYS = 90;

const categoryLabels: Record<string, string> = {
  dinking: "Dinking",
  third_shot: "Third Shot Drop",
  serving: "Serving",
  volleys: "Volleys",
  resets: "Resets",
  conditioning: "Conditioning",
  strategy: "Strategy",
};

export default async function DrillHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<{ group?: string; range?: string }>;
}) {
  const [{ challengeId }, { group: groupId, range }] = await Promise.all([params, searchParams]);
  const repo = getActionRepository();

  const challenge = await repo.getChallengeTemplate(challengeId);
  if (!challenge) notFound();

  const accountId = await getActivePlayerAccountId();
  const guestPlayerId = !accountId && groupId ? await getActiveGuestPlayerId(groupId) : null;
  const showAllTime = range === "all";
  const now = new Date();

  const groupQuery = groupId ? `group=${encodeURIComponent(groupId)}` : "";
  const backHref = groupId ? `/training?${groupQuery}` : "/training";
  const rangeHref = (all: boolean) => {
    const query = [groupQuery, all ? "range=all" : ""].filter(Boolean).join("&");
    return `/training/drills/${challenge.id}${query ? `?${query}` : ""}`;
  };

  const header = (
    <div className="space-y-2">
      <Link href={backHref} className="inline-flex items-center min-h-[40px] text-xs font-black uppercase tracking-wider text-neutral-700 hover:text-black">
        ← Training
      </Link>
      <div>
        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">
          {categoryLabels[challenge.skillCategory] ?? challenge.skillCategory} · History
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-black leading-tight">
          {challenge.title}
        </h1>
      </div>
    </div>
  );

  if (!accountId && !guestPlayerId) {
    return (
      <main className="min-h-screen p-4 sm:p-6 w-full max-w-2xl mx-auto space-y-6 text-black pb-28 sm:pb-24 md:pb-12">
        {header}
        <section className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 shadow-[4px_4px_0px_0px_#000] space-y-3">
          <p className="text-sm font-medium text-neutral-700">Sign in to see your results for this drill.</p>
          <Link
            href={`/player-login?returnTo=${encodeURIComponent(rangeHref(showAllTime))}`}
            className="inline-flex items-center justify-center w-full min-h-[44px] px-4 rounded-xl bg-[#ccff00] text-black border-2 border-black font-display text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]"
          >
            Sign In →
          </Link>
        </section>
      </main>
    );
  }

  const [allResults, rosterPlayers] = await Promise.all([
    repo.listTrainingResultsForChallenge(
      challenge.id,
      accountId ? { accountId, limit: 500 } : { playerId: guestPlayerId!, limit: 500 },
    ),
    groupId ? repo.listPlayers(groupId, { includeInactive: false }) : Promise.resolve([]),
  ]);

  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - (RANGE_DAYS - 1));
  const results = showAllTime ? allResults : allResults.filter((r) => r.recordedAt >= rangeStart);

  const summary = summarizeDrillTrend(results, challenge, now);
  const series = buildDailyBestSeries(results, challenge.higherIsBetter);
  const allTimeSummary = showAllTime ? summary : summarizeDrillTrend(allResults, challenge, now);
  const latestOverall = allTimeSummary.latest;
  const lastResult = latestOverall ? toLastResultSummary(latestOverall, now) : null;

  // All-time podium; ties go to whoever reached the result first.
  const bestValue = allTimeSummary.best;
  const podium = rankPersonalBests(allResults, challenge.higherIsBetter, 3);
  const podiumRank = new Map(podium.map((r, i) => [r.id, (i + 1) as 1 | 2 | 3]));

  const isOwnResult = (r: (typeof allResults)[number]) =>
    (accountId !== null && r.accountId === accountId) ||
    (guestPlayerId !== null && r.loggedByPlayerId === guestPlayerId);

  return (
    <main className="min-h-screen p-4 sm:p-6 w-full max-w-2xl mx-auto space-y-6 text-black pb-28 sm:pb-24 md:pb-12">
      {header}

      {/* Headline metric */}
      <section
        data-testid="drill-history-summary"
        className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[4px_4px_0px_0px_#000] space-y-4"
      >
        {latestOverall ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">Latest</span>
                <span className="font-display text-3xl font-black text-black">
                  {formatLastResultValue(challenge, lastResult!)}
                </span>
              </div>
              {bestValue !== null && (
                <div className="text-right">
                  <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">Personal best</span>
                  <span className="font-display text-lg font-black text-black">{formatMetricValue(challenge, bestValue)}</span>
                </div>
              )}
            </div>

            <p className="text-sm font-bold text-black" data-testid="drill-trend-headline">
              {results.length > 0
                ? summary.headline
                : `No attempts in the last ${RANGE_DAYS} days.`}
            </p>
            <p className="text-xs font-medium text-neutral-600">
              Last logged {formatDaysAgo(allTimeSummary.daysSinceLast ?? 0)}
              {results.length > 0 && (
                <>
                  {" · "}
                  {summary.attemptCount} {summary.attemptCount === 1 ? "attempt" : "attempts"} on {summary.dayCount}{" "}
                  {summary.dayCount === 1 ? "day" : "days"}
                  {showAllTime ? "" : ` in the last ${RANGE_DAYS} days`}
                </>
              )}
            </p>

            {/* Range toggle */}
            <div className="flex gap-2" role="group" aria-label="Date range">
              {[false, true].map((all) => {
                const active = all === showAllTime;
                return (
                  <Link
                    key={String(all)}
                    href={rangeHref(all)}
                    aria-current={active ? "page" : undefined}
                    className={`min-h-[36px] px-3 inline-flex items-center rounded-xl border-2 border-black font-display text-[11px] font-black uppercase tracking-wider ${
                      active ? "bg-black text-[#ccff00]" : "bg-white text-black hover:bg-neutral-100"
                    }`}
                  >
                    {all ? "All time" : `Last ${RANGE_DAYS} days`}
                  </Link>
                );
              })}
            </div>

            {series.length >= 2 ? (
              <DrillTrendChart challenge={challenge} points={series} now={now} />
            ) : results.length > 0 ? (
              <p className="text-xs font-medium text-neutral-600">
                Log this drill on another day to start seeing a trend.
              </p>
            ) : null}
          </>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-bold text-black">No attempts logged yet.</p>
            <p className="text-xs font-medium text-neutral-600">Your first result becomes your starting point.</p>
          </div>
        )}

        <DrillHistoryLogger
          challenge={challenge}
          groupId={groupId ?? null}
          rosterPlayers={rosterPlayers.map((p) => ({ id: p.id, name: p.name, username: p.username }))}
          lastResult={lastResult}
        />
      </section>

      <PersonalBests
        challenge={challenge}
        ranked={podium}
        ownResultIds={podium.filter((r) => isOwnResult(r)).map((r) => r.id)}
        groupId={groupId ?? null}
      />

      {/* Attempt log */}
      {results.length > 0 && (
        <section className="space-y-2.5" aria-labelledby="attempts-heading">
          <h2 id="attempts-heading" className="font-display text-lg font-black uppercase text-black">
            Attempts
          </h2>
          <ul className="bg-[#FFFDF7] border-2 border-black rounded-2xl divide-y divide-black/10 overflow-hidden">
            {results.map((r) => {
              const value = formatLastResultValue(challenge, {
                scorePrimary: r.scorePrimary,
                scoreSecondary: r.scoreSecondary ?? null,
                metricValue: r.metricValue,
              });
              const dateLabel = formatShortDate(r.recordedAt, now);
              return (
                <li key={r.id} data-testid={`attempt-row-${r.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-black text-black">{value}</span>
                      {podiumRank.has(r.id) && <PickleballMedal rank={podiumRank.get(r.id)!} size={22} />}
                    </div>
                    <span className="text-xs font-medium text-neutral-600 block">
                      {r.recordedAt.toLocaleDateString("en-US", { weekday: "short" })}, {dateLabel}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </span>
                  </div>
                  {isOwnResult(r) && (
                    <DeleteAttemptButton
                      resultId={r.id}
                      challengeId={challenge.id}
                      groupId={groupId ?? null}
                      attemptLabel={`${value} on ${dateLabel}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
