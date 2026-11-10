import Link from "next/link";
import { redirect } from "next/navigation";
import { getActionRepository, getActivePlayerAccountId } from "@/app/actions/action-context";
import { PlayerLogoutButton, PlayerProfileHeader } from "@/components/players/player-profile-controls";
import { ScoreHistoryChart } from "@/components/players/score-history-chart";
import { BackButton, StatCard } from "@/components/ui";
import { SynergyExplainerButton } from "@/components/players/synergy-explainer";
import { ClientDate } from "@/components/ui/client-date-time";
import { ChevronRightIcon } from "@/components/ui/icons";

export default async function PlayerProfilePage() {
  const accountId = await getActivePlayerAccountId();
  if (!accountId) redirect("/player-login");
  const repository = getActionRepository();
  const [account, history, groups, bestPartner] = await Promise.all([
    repository.getPlayerAccount(accountId),
    repository.listPlayerSessionHistory(accountId),
    repository.listAccountGroups(accountId),
    repository.getBestPartner(accountId),
  ]);
  if (!account) redirect("/player-login");
  const wins = history.reduce((total, session) => total + session.wins, 0);
  const losses = history.reduce((total, session) => total + session.losses, 0);

  return <main className="min-h-screen p-4 sm:p-6 lg:p-8">
    <section className="mx-auto max-w-2xl lg:max-w-6xl xl:max-w-7xl space-y-5">
      <header className="rounded-3xl border-[3px] border-black bg-white p-5 lg:p-7">
        <div className="mb-4 flex items-center justify-between">
          <BackButton href="/" />
          <PlayerLogoutButton />
        </div>
        <PlayerProfileHeader
          initialName={account.name}
          initialUsername={account.username}
          initialGender={account.gender}
          skillLevel={account.skillLevel}
          currentRating={account.rating ?? account.initialRating}
          initialIsPublic={account.isPublic ?? true}
        />
      </header>

      {/* Top Row: Chemistry Spotlight & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Chemistry Spotlight (Best Partner) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-center">
          {bestPartner ? (
            <section className="h-full rounded-3xl border-[3px] border-black bg-gradient-to-br from-[#ccff00] to-[#fde047] p-5 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-800">Chemistry Spotlight</p>
                    <SynergyExplainerButton />
                  </div>
                  <h2 className="font-display text-2xl font-black uppercase">Best Partner</h2>
                  <p className="text-sm font-bold text-neutral-800">@{bestPartner.username}</p>
                </div>
                <div className="text-right">
                  {(() => {
                    const raw = bestPartner.synergyScore;
                    const score = Math.round(raw > -1 && raw < 1 && raw !== 0 ? raw * 100 : raw);
                    const sign = score > 0 ? `+${score}%` : `${score}%`;
                    return (
                      <span className={`inline-block rounded-xl border-2 border-black px-3 py-1 font-display text-xl font-black ${
                        score > 0
                          ? "bg-emerald-100 text-emerald-950"
                          : score < 0
                          ? "bg-rose-100 text-rose-950"
                          : "bg-white text-black"
                      }`}>
                        {sign} Synergy
                      </span>
                    );
                  })()}
                  <p className="mt-1 text-[11px] font-bold text-neutral-800">
                    {bestPartner.matchesPlayed} {bestPartner.matchesPlayed === 1 ? "match" : "matches"} together
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className="h-full rounded-3xl border-[3px] border-black bg-white p-5 flex flex-col justify-center">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Chemistry Spotlight</p>
                  <SynergyExplainerButton />
                </div>
                <h2 className="font-display text-xl font-black uppercase text-neutral-800">No Partner Yet</h2>
                <p className="mt-1 text-xs font-bold text-neutral-600">
                  Play matches with other people to unlock.
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Sessions / Wins / Losses */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-center">
          <section className="grid grid-cols-3 gap-3 text-center h-full items-stretch">
            <StatCard label="Sessions" value={new Set(history.map((item) => item.sessionId)).size} className="flex flex-col justify-center" />
            <StatCard label="Wins" value={wins} className="flex flex-col justify-center" />
            <StatCard label="Losses" value={losses} className="flex flex-col justify-center" />
          </section>
        </div>
      </div>

      {/* Bottom Row: My Groups & Everything Else */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* My Groups: 1st on mobile, right column (4-5 cols) on desktop */}
        <div className="space-y-5 lg:col-span-5 xl:col-span-4 order-1 lg:order-2">
          <section className="rounded-3xl border-[3px] border-black bg-[#ccff00] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-black uppercase">My Groups</h2>
              <div className="flex gap-2">
                <Link href="/setup" className="rounded-xl border-2 border-black bg-[#fde047] px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all">Create</Link>
                <Link href="/players/groups" className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all">Find groups</Link>
              </div>
            </div>
            {groups.length === 0 ? (
              <p className="text-sm font-bold">You haven&apos;t joined any groups yet.</p>
            ) : (
              <ul className="space-y-2">
                {groups.map((group) => (
                  <li key={group.id}>
                    <Link
                      href={`/g/${group.id}`}
                      aria-label={`Go to ${group.name}`}
                      title={`Go to ${group.name}`}
                      className="group flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-black text-black group-hover:underline">{group.name}</span>
                        <span className="text-xs font-semibold text-neutral-600">{group.playerCount} {group.playerCount === 1 ? "player" : "players"}</span>
                      </div>
                      <div className="p-1.5 text-black group-hover:translate-x-0.5 transition-transform shrink-0">
                        <ChevronRightIcon className="w-5 h-5 stroke-[2.5]" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Everything Else (Score History Chart & Past Sessions): 2nd on mobile, left column (7-8 cols) on desktop */}
        <div className="space-y-5 lg:col-span-7 xl:col-span-8 order-2 lg:order-1">
          <section className="rounded-3xl border-[3px] border-black bg-white p-5">
            <ScoreHistoryChart history={history} />
          </section>

          <section className="space-y-3 rounded-3xl border-[3px] border-black bg-white p-5">
            <h2 className="font-display text-2xl font-black uppercase">Past Sessions</h2>
            {history.length === 0 ? (
              <p className="text-sm font-bold text-neutral-600">Sessions you attend will show up here.</p>
            ) : (
              history.map((item) => {
                return (
                  <article
                    key={`${item.groupId}-${item.sessionId}`}
                    data-testid={`player-session-${item.sessionId}`}
                    className="flex items-center justify-between gap-3 border-t-2 border-neutral-100 py-3"
                  >
                    <div>
                      <h3 className="font-black text-black">
                        {item.sessionName ? `${item.sessionName} · ` : null}
                        <ClientDate date={item.startedAt} options={{ month: "short", day: "numeric", year: "numeric" }} />
                      </h3>
                      <p className="text-xs font-bold text-neutral-600">
                        {item.groupName}
                        {item.type === "open_play" ? " (Open Play)" : ""}
                        {" · "}
                        {item.wins}W – {item.losses}L
                      </p>
                    </div>
                    <Link
                      href={`/g/${item.groupId}/sessions/${item.sessionId}?from=profile`}
                      aria-label="Go to session"
                      title="Go to session"
                      className="p-1.5 text-black hover:translate-x-0.5 transition-transform cursor-pointer shrink-0"
                    >
                      <span className="sr-only">Go to session</span>
                      <ChevronRightIcon className="w-5 h-5 stroke-[2.5]" />
                    </Link>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </div>
    </section>
  </main>;
}
