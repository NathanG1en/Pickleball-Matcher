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
        <header className="flex items-center justify-between gap-3 sm:gap-4 rounded-3xl border-2 border-black bg-[#FFFDF7] p-4 sm:p-6 shadow-[3px_3px_0px_0px_#000] sm:shadow-[4px_4px_0px_0px_#000]">
          <div className="min-w-0">
            <p className="text-xs sm:text-xs font-bold text-neutral-600">Player groups</p>
            <h1 className="font-display text-2xl sm:text-3xl font-black uppercase leading-tight">Find a group</h1>
          </div>
          <Link
            href="/setup"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-3.5 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-sm font-bold shadow-[2.5px_2.5px_0px_0px_#000] sm:shadow-[3px_3px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer whitespace-nowrap"
          >
            + Create Group
          </Link>
        </header>

        <form action="/players/groups" className="flex gap-2">
          <label htmlFor="group-search" className="sr-only">Search public groups</label>
          <input id="group-search" name="q" defaultValue={q} placeholder="Search by group name" className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-4 py-3 font-bold text-base shadow-[3px_3px_0px_0px_#000]" />
          <button className="rounded-xl border-2 border-black bg-[#ccff00] px-4 font-bold shadow-[3px_3px_0px_0px_#000]">Search</button>
        </form>
        <PublicGroupList groups={groups} isSignedIn={true} query={q} />
      </section>
    </main>
  );
}
