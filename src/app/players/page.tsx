import Link from "next/link";
import { redirect } from "next/navigation";
import { getActionRepository } from "@/app/actions/action-context";
import { getActivePlayerAccountId } from "@/app/actions/action-context";
import { LeaveGroupButton, PlayerLogoutButton, PlayerNameEditor } from "@/components/players/player-profile-controls";
import { ScoreHistoryChart } from "@/components/players/score-history-chart";

export default async function PlayerProfilePage() {
  const accountId = await getActivePlayerAccountId();
  if (!accountId) redirect("/player-login");
  const repository = getActionRepository();
  const [account, history, groups] = await Promise.all([
    repository.getPlayerAccount(accountId),
    repository.listPlayerSessionHistory(accountId),
    repository.listPublicGroups("", accountId),
  ]);
  if (!account) redirect("/player-login");
  const wins = history.reduce((total, session) => total + session.wins, 0);
  const losses = history.reduce((total, session) => total + session.losses, 0);
  const joinedGroups = groups.filter((group) => group.isMember);
  const byGroup = new Map<string, typeof history[number][]>();
  for (const item of history) byGroup.set(item.groupId, [...(byGroup.get(item.groupId) ?? []), item]);

  return <main className="min-h-screen p-4 sm:p-6">
    <section className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center justify-between gap-3 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
        <div><p className="text-xs font-black uppercase tracking-wider text-neutral-600">Player profile</p><h1 className="font-display text-3xl font-black uppercase">{account.name}</h1><p className="text-sm font-bold text-neutral-600">@{account.username}</p></div>
        <PlayerLogoutButton />
      </header>

      <section className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
        <PlayerNameEditor initialName={account.name} />
        <p className="mt-3 text-xs font-bold uppercase text-neutral-600">{account.skillLevel} · starting rating {account.initialRating}</p>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Sessions" value={new Set(history.map((item) => item.sessionId)).size} />
        <Stat label="Wins" value={wins} />
        <Stat label="Losses" value={losses} />
      </section>

      <section className="rounded-3xl border-[3px] border-black bg-[#ccff00] p-5 shadow-[5px_5px_0px_0px_#000]">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-black uppercase">My Groups</h2><Link href="/players/groups" className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase">Find groups</Link></div>
        {joinedGroups.length === 0 ? <p className="text-sm font-bold">You haven&apos;t joined any public groups yet.</p> : <ul className="space-y-2">{joinedGroups.map((group) => <li key={group.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold"><div><span className="block">{group.name}</span><span className="text-xs text-neutral-600">{group.playerCount} players</span></div><LeaveGroupButton groupId={group.id} /></li>)}</ul>}
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
