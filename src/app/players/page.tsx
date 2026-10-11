import Link from "next/link";
import { redirect } from "next/navigation";
import { getActionRepository } from "@/app/actions/action-context";
import { getActivePlayerAccountId } from "@/app/actions/action-context";
import { LeaveGroupButton, PlayerLogoutButton, PlayerProfileHeader } from "@/components/players/player-profile-controls";
import { ScoreHistoryChart } from "@/components/players/score-history-chart";
import { BackButton } from "@/components/groups/back-button";
import { SynergyExplainerButton } from "@/components/players/synergy-explainer";

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
  const byGroup = new Map<string, typeof history[number][]>();
  for (const item of history) byGroup.set(item.groupId, [...(byGroup.get(item.groupId) ?? []), item]);

  return <main className="min-h-screen p-4 sm:p-6">
    <section className="mx-auto max-w-2xl space-y-5">
      <header className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
        <div className="mb-4 flex items-center justify-between">
          <BackButton href="/" />
          <PlayerLogoutButton />
        </div>
        <PlayerProfileHeader
          initialName={account.name}
          initialUsername={account.username}
          initialGender={account.gender}
          skillLevel={account.skillLevel}
          initialRating={account.initialRating}
          initialIsPublic={account.isPublic ?? true}
        />
      </header>

      {bestPartner ? (
        <section className="rounded-3xl border-[3px] border-black bg-gradient-to-br from-[#ccff00] to-[#fde047] p-5 shadow-[5px_5px_0px_0px_#000]">
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
              <span className="inline-block rounded-xl border-2 border-black bg-white px-3 py-1 font-display text-xl font-black shadow-[2px_2px_0px_0px_#000]">
                {bestPartner.synergyScore > 1
                  ? Math.round(bestPartner.synergyScore)
                  : Math.round(bestPartner.synergyScore * 100)}% Synergy
              </span>
              <p className="mt-1 text-[11px] font-bold text-neutral-800">
                {bestPartner.matchesPlayed} matches together
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Chemistry Spotlight</p>
                <SynergyExplainerButton />
              </div>
              <h2 className="font-display text-xl font-black uppercase text-neutral-800">Doubles Synergy</h2>
              <p className="mt-1 text-xs font-bold text-neutral-600 max-w-sm">
                Play doubles matches with other registered accounts in your groups to discover your best partner and unlock mutual chemistry scores.
              </p>
            </div>
            <span className="rounded-2xl border-2 border-black bg-neutral-100 px-3 py-2 text-2xl shadow-[2px_2px_0px_0px_#000]">
              🤝
            </span>
          </div>
        </section>
      )}

      <section className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Sessions" value={new Set(history.map((item) => item.sessionId)).size} />
        <Stat label="Wins" value={wins} />
        <Stat label="Losses" value={losses} />
      </section>

      <section className="rounded-3xl border-[3px] border-black bg-[#ccff00] p-5 shadow-[5px_5px_0px_0px_#000]">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-black uppercase">My Groups</h2><div className="flex gap-2"><Link href="/setup" className="rounded-xl border-2 border-black bg-[#fde047] px-3 py-2 text-xs font-black uppercase">Create</Link><Link href="/players/groups" className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase">Find groups</Link></div></div>
        {groups.length === 0 ? <p className="text-sm font-bold">You haven&apos;t joined any groups yet.</p> : <ul className="space-y-2">{groups.map((group) => <li key={group.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold"><div><Link href={`/g/${group.id}`} className="block underline">{group.name}</Link><span className="text-xs text-neutral-600">{group.playerCount} players</span></div><div className="flex items-center gap-2">{(group.isHost || group.isOrganizer) && <span className="rounded-full border border-black bg-[#fde047] px-2 py-1 text-[9px] font-black uppercase">{group.isHost ? "Host" : "Organizer"}</span>}{group.isMember && !group.isHost && <LeaveGroupButton groupId={group.id} />}</div></li>)}</ul>}
      </section>

      <section className="space-y-4 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
        <h2 className="font-display text-2xl font-black uppercase">Rating over time</h2>
        {byGroup.size === 0 ? <ScoreHistoryChart history={[]} /> : [...byGroup.entries()].map(([groupId, entries]) => <div key={groupId} className="rounded-2xl border-2 border-black p-4"><h3 className="mb-2 font-black">{entries[0].groupName}</h3><ScoreHistoryChart history={entries} /></div>)}
      </section>

      <section className="space-y-3 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
        <h2 className="font-display text-2xl font-black uppercase">Past Sessions</h2>
        {history.length === 0 ? <p className="text-sm font-bold text-neutral-600">Sessions you attend will show up here.</p> : history.map((item) => <article key={`${item.groupId}-${item.sessionId}`} className="flex items-center justify-between gap-3 border-t-2 border-neutral-100 py-3"><div><h3 className="font-black">{item.groupName}</h3><p className="text-xs font-bold text-neutral-600">{item.startedAt.toLocaleDateString()} · Rating {Math.round(item.rating)}</p></div><p className="whitespace-nowrap text-sm font-black">{item.wins}W – {item.losses}L</p></article>)}
      </section>
    </section>
  </main>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000]"><p className="font-display text-2xl font-black">{value}</p><p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{label}</p></div>;
}
