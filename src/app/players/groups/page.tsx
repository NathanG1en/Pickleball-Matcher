import Link from "next/link";
import { getActionRepository } from "@/app/actions/action-context";
import { getActivePlayerAccountId } from "@/app/actions/action-context";
import { PublicGroupList } from "@/components/players/public-group-list";

export default async function PublicGroupsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q = "" }, accountId] = await Promise.all([searchParams, getActivePlayerAccountId()]);
  const groups = await getActionRepository().listPublicGroups(q, accountId ?? undefined);
  return (
    <main className="min-h-screen p-4 sm:p-6">
      <section className="mx-auto max-w-xl space-y-5">
        <header className="flex items-center justify-between gap-3 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
          <div><p className="text-xs font-black uppercase tracking-wider text-neutral-600">Player groups</p><h1 className="font-display text-3xl font-black uppercase">Find a group</h1></div>
          <Link href={accountId ? "/players" : "/"} className="rounded-xl border-2 border-black px-3 py-2 text-xs font-black uppercase hover:bg-[#fde047]">{accountId ? "My Profile" : "Home"}</Link>
        </header>
        <form action="/players/groups" className="flex gap-2">
          <label htmlFor="group-search" className="sr-only">Search public groups</label>
          <input id="group-search" name="q" defaultValue={q} placeholder="Search by group name" className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-4 py-3 font-bold shadow-[3px_3px_0px_0px_#000]" />
          <button className="rounded-xl border-2 border-black bg-[#ccff00] px-4 font-black uppercase shadow-[3px_3px_0px_0px_#000]">Search</button>
        </form>
        {!accountId && <p className="text-sm font-bold text-neutral-700">Create a player account or sign in to join a group.</p>}
        <PublicGroupList groups={groups} isSignedIn={Boolean(accountId)} />
      </section>
    </main>
  );
}
