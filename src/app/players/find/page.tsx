import Link from "next/link";
import { getActionRepository, getActivePlayerAccountId } from "@/app/actions/action-context";
import { FindPlayerList } from "@/components/players/find-player-list";
import { BackButton } from "@/components/ui";

export const metadata = {
  title: "Find Players | Pickleball Matcher",
};

export default async function FindPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q = "" }, accountId] = await Promise.all([
    searchParams,
    getActivePlayerAccountId(),
  ]);

  const players = await getActionRepository().listPlayerAccounts(q);

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <section className="mx-auto max-w-xl space-y-5">
        <header className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
          <div className="mb-4 flex items-center justify-between">
            <BackButton href="/" />
            <Link
              href={accountId ? "/players" : "/"}
              className="rounded-xl border-2 border-black px-3 py-1.5 text-xs font-black uppercase hover:bg-[#fde047] transition-colors"
            >
              {accountId ? "My Profile" : "Home"}
            </Link>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-neutral-600">
              Pickleball Community
            </p>
            <h1 className="font-display text-3xl font-black uppercase">Find Players</h1>
          </div>
        </header>

        <form action="/players/find" className="flex gap-2">
          <label htmlFor="player-search" className="sr-only">
            Search players
          </label>
          <input
            id="player-search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or @username"
            className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-4 py-3 font-bold shadow-[3px_3px_0px_0px_#000]"
          />
          <button
            type="submit"
            className="rounded-xl border-2 border-black bg-[#ccff00] px-4 font-black uppercase shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            Search
          </button>
        </form>

        <FindPlayerList players={players} currentAccountId={accountId} />
      </section>
    </main>
  );
}

