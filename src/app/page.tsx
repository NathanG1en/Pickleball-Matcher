import Link from "next/link";
import { getActiveOrganizerSession, getActivePlayerAccountId, getActionRepository } from "@/app/actions/action-context";
import { RecentGroupsHome } from "@/components/groups/recent-groups-home";
import { LogoutButton } from "@/components/auth/logout-button";
import type { GroupRecord, PlayerAccountRecord, PublicGroupRecord } from "@/lib/domain/types";

export default async function HomePage() {
  const session = await getActiveOrganizerSession();
  const playerAccountId = await getActivePlayerAccountId();
  let activeGroup: GroupRecord | null = null;
  let playerAccount: PlayerAccountRecord | null = null;
  let accountGroups: readonly PublicGroupRecord[] = [];

  if (session?.groupId || playerAccountId) {
    try {
      const repo = getActionRepository();
      if (session?.groupId) activeGroup = await repo.getGroup(session.groupId);
      if (playerAccountId) {
        [playerAccount, accountGroups] = await Promise.all([
          repo.getPlayerAccount(playerAccountId),
          repo.listAccountGroups(playerAccountId),
        ]);
      }
    } catch {
      // Fallback in non-db environments
    }
  }
  return (
    <main className="min-h-screen p-4 sm:p-8 flex items-center justify-center relative overflow-hidden">
      {/* Background decoration elements */}
      <div
        className="absolute top-8 left-8 w-24 h-24 rounded-full bg-[#fde047] border-2 border-black shadow-[4px_4px_0px_0px_#000] hidden md:block pointer-events-none -rotate-12"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-10 w-28 h-28 rounded-2xl bg-[#7dd3fc] border-2 border-black shadow-[5px_5px_0px_0px_#000] hidden md:block pointer-events-none rotate-6"
        aria-hidden="true"
      />

      <section
        className="relative max-w-lg w-full bg-white border-[3px] border-black rounded-3xl p-7 sm:p-10 shadow-[8px_8px_0px_0px_#000] text-center space-y-7 z-10"
        aria-labelledby="home-title"
      >
        {/* Eyebrow badge */}
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
            Pickleball Matchmaker
          </span>
        </div>

        {/* Big Bold Barlow Condensed Heading */}
        <div className="space-y-3">
          <h1
            id="home-title"
            className="font-display text-5xl sm:text-6xl font-black text-black tracking-tight leading-[0.9] uppercase"
          >
            FAIR ROUNDS.
            <br />
            <span className="inline-block mt-1 bg-[#ccff00] text-black px-3 py-0.5 border-2 border-black shadow-[3px_3px_0px_0px_#000] -rotate-1">
              FRESH PARTNERS.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-800 pt-2 font-medium leading-relaxed max-w-sm mx-auto">
            An elevated hands experienced.
          </p>
        </div>

        {/* Neobrutalist Court Divider */}
        <div className="flex items-center justify-center gap-3 py-1" aria-hidden="true">
          <div className="h-1 flex-1 bg-black rounded-full" />
          <div className="w-4 h-4 rounded-full bg-[#ccff00] border-2 border-black shadow-[1px_1px_0px_0px_#000]" />
          <div className="h-1 flex-1 bg-black rounded-full" />
        </div>

        {/* 3 Neobrutalist Feature Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
          <div className="p-3 rounded-xl bg-[#e0f2fe] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
            <div className="font-display text-base font-black text-black uppercase">Equal Sits</div>
            <div className="text-[11px] font-bold text-neutral-700">Even court time</div>
          </div>
          <div className="p-3 rounded-xl bg-[#fef08a] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
            <div className="font-display text-base font-black text-black uppercase">New Pairs</div>
            <div className="text-[11px] font-bold text-neutral-700">Partner variety</div>
          </div>
          <div className="p-3 rounded-xl bg-[#dcfce7] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
            <div className="font-display text-base font-black text-black uppercase">Fair Games</div>
            <div className="text-[11px] font-bold text-neutral-700">Rating balance</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4 pt-2">
          {activeGroup && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#dcfce7] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] text-left space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider text-black bg-[#ccff00] border border-black shadow-[1px_1px_0px_0px_#000]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-ping" />
                  Organizer Session
                </span>
                <LogoutButton />
              </div>

              <div>
                <h2 className="font-display text-2xl font-black uppercase text-black leading-tight truncate">
                  {activeGroup.name}
                </h2>
                <p className="text-xs font-bold text-neutral-700 mt-0.5">
                  You are currently signed in on this device.
                </p>
              </div>

              <Link
                href={`/g/${activeGroup.id}`}
                className="block w-full py-3 px-4 rounded-xl bg-black hover:bg-neutral-900 text-[#ccff00] font-black text-center text-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.25)] active:translate-x-0.5 active:translate-y-0.5 transition-all font-display"
              >
                Resume Group Dashboard →
              </Link>
            </div>
          )}

          <RecentGroupsHome excludeGroupId={activeGroup?.id} />

          {playerAccount ? (
            <>
              <Link href="/setup" className="block w-full py-4 px-6 rounded-2xl bg-[#ccff00] hover:bg-[#b8eb00] text-black font-black text-lg border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display">Create Your Group →</Link>
              <Link href="/players" className="block w-full py-3 px-6 rounded-2xl bg-white hover:bg-neutral-100 text-black font-black text-base border-2 border-black shadow-[3px_3px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display">My Groups ({accountGroups.length})</Link>
            </>
          ) : (
            <>
              <Link href="/player-login?next=%2Fsetup" className="block w-full py-4 px-6 rounded-2xl bg-[#ccff00] hover:bg-[#b8eb00] text-black font-black text-lg border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display">Sign In to Play →</Link>
              <Link href="/player-signup?next=%2Fsetup" className="block w-full py-3 px-6 rounded-2xl bg-white hover:bg-neutral-100 text-black font-black text-base border-2 border-black shadow-[3px_3px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display">Create an Account</Link>
            </>
          )}
          <div className="border-t-2 border-dashed border-neutral-300 pt-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wider text-neutral-600">In a rush?</p>
            <Link href="/temporary" className="block w-full py-3 px-6 rounded-2xl bg-[#e0f2fe] hover:bg-sky-200 text-black font-black text-base border-2 border-black shadow-[3px_3px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display">Make a Temporary Group</Link>
            <Link href="/login" className="mt-3 block text-xs font-black uppercase underline">Legacy organizer PIN sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
