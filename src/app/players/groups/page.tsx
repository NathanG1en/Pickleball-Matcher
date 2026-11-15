import Link from "next/link";
import { redirect } from "next/navigation";
import { getActionRepository, getActivePlayerAccountId } from "@/app/actions/action-context";
import { PublicGroupList } from "@/components/players/public-group-list";

export default async function PublicGroupsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const accountId = await getActivePlayerAccountId();
  if (!accountId) {
    redirect("/player-login?next=%2Fplayers%2Fgroups");
  }
  const { q = "" } = await searchParams;
  const groups = await getActionRepository().listPublicGroups(q, accountId);
  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <section className="mx-auto max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border-2 border-black bg-[#FFFDF7] p-5 lg:p-6 shadow-[4px_4px_0px_0px_#000]">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600">Player groups</p>
            <h1 className="font-display text-3xl font-black uppercase">Find a group</h1>
          </div>
          <Link
            href="/setup"
            className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto rounded-xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-4 py-2.5 font-display text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all cursor-pointer"
          >
            + Create a Group
          </Link>
        </header>

        <form action="/players/groups" className="flex gap-2">
          <label htmlFor="group-search" className="sr-only">Search public groups</label>
          <input id="group-search" name="q" defaultValue={q} placeholder="Search by group name" className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-4 py-3 font-bold shadow-[3px_3px_0px_0px_#000]" />
          <button className="rounded-xl border-2 border-black bg-[#ccff00] px-4 font-black uppercase shadow-[3px_3px_0px_0px_#000]">Search</button>
        </form>
        <PublicGroupList groups={groups} isSignedIn={true} query={q} />

        {/* Create group callout */}
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <p className="font-display text-base font-black uppercase text-black">Want to run your own sessions?</p>
            <p className="text-xs text-neutral-600 font-medium">Create a private or public group with custom courts, round generation, and scoring.</p>
          </div>
          <Link
            href="/setup"
            className="inline-flex items-center justify-center rounded-xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-4 py-2 font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all shrink-0 cursor-pointer"
          >
            Create A Group →
          </Link>
        </div>
      </section>
    </main>
  );
}
