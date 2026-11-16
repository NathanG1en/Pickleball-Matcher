import Link from "next/link";
import { HomePickleball } from "@/components/home/home-pickleball";
import {
  getActiveOrganizerSession,
  getActivePlayerAccountId,
  getActionRepository,
} from "@/app/actions/action-context";
import {
  LiveSessionsHome,
  YourGroupsHome,
  type HomeGroupSummary,
} from "@/components/home/your-groups-home";
import type { DomainRepository } from "@/lib/domain/repositories";
import type { GroupRecord, PlayerAccountRecord } from "@/lib/domain/types";
import { UsersIcon, SearchIcon, ZapIcon } from "@/components/ui/icons";


async function getGuestGroups(): Promise<Record<string, string>> {
  try {
    const { getGuestGroupPlayerIds } = await import("@/lib/auth/guest-session");
    return await getGuestGroupPlayerIds();
  } catch {
    return {};
  }
}

/** Groups this device belongs to, from the player account and any guest joins, with their live session. */
async function loadHomeGroups(
  repo: DomainRepository,
  playerAccountId: string | null,
  excludeGroupId: string | undefined,
): Promise<HomeGroupSummary[]> {
  const byId = new Map<string, string>();
  if (playerAccountId) {
    for (const group of await repo.listAccountGroups(playerAccountId))
      byId.set(group.id, group.name);
  }
  const guestGroups = await getGuestGroups();
  await Promise.all(
    Object.entries(guestGroups).map(async ([groupId, playerId]) => {
      if (byId.has(groupId)) return;
      const [group, players] = await Promise.all([
        repo.getGroup(groupId),
        repo.listPlayers(groupId),
      ]);
      if (group && players.some((player) => player.id === playerId && player.active))
        byId.set(group.id, group.name);
    }),
  );
  if (excludeGroupId) byId.delete(excludeGroupId);

  const groups = await Promise.all(
    [...byId].map(async ([id, name]): Promise<HomeGroupSummary> => {
      const active = (await repo.listSessions(id)).find((session) => session.status === "active");
      return {
        id,
        name,
        liveSession: active
          ? {
              id: active.id,
              roundNumber: active.currentRoundNumber,
              type: active.type === "open_play" ? "open_play" : "regular",
            }
          : null,
      };
    }),
  );
  // Live groups first, then alphabetical.
  return groups.sort(
    (a, b) =>
      Number(Boolean(b.liveSession)) - Number(Boolean(a.liveSession)) ||
      a.name.localeCompare(b.name),
  );
}

export default async function HomePage() {
  const session = await getActiveOrganizerSession();
  const playerAccountId = await getActivePlayerAccountId();
  let activeGroup: GroupRecord | null = null;
  let playerAccount: PlayerAccountRecord | null = null;
  let homeGroups: HomeGroupSummary[] = [];

  try {
    const repo = getActionRepository();
    if (session?.groupId) activeGroup = await repo.getGroup(session.groupId);
    if (playerAccountId) {
      playerAccount = await repo.getPlayerAccount(playerAccountId);
      if (playerAccount) {
        homeGroups = await loadHomeGroups(repo, playerAccountId, activeGroup?.id);
      }
    }
  } catch {
    // Fallback in non-db environments
  }

  // When not signed in: show ONLY the welcome hero and sign in / create account options
  if (!playerAccount) {
    return (
      <main className="min-h-full px-4 py-6 sm:py-12 max-w-2xl mx-auto">
        {/* Welcome / Hero Section with combined Sign In & Registration actions */}
        <section
          className="text-center space-y-4 sm:space-y-6 rounded-3xl border-2 border-black bg-[#FFFDF7] p-5 sm:p-8 shadow-[3px_3px_0px_0px_#000] sm:shadow-[4px_4px_0px_0px_#000]"
          aria-labelledby="home-title"
        >
          {/* Distinctive Barlow Condensed Display Heading */}
          <div className="space-y-1.5 sm:space-y-2">
            <h1
              id="home-title"
              className="font-display text-[2rem] sm:text-5xl lg:text-6xl font-black text-black tracking-tight leading-[0.92] uppercase max-w-2xl mx-auto"
            >
              FAIR ROUNDS.
              <br />
              <span className="inline-block mt-1.5 sm:mt-2 bg-[#ccff00] text-black px-3.5 sm:px-4 py-0.5 sm:py-1 border-2 border-black shadow-[2.5px_2.5px_0px_0px_#000] rounded-xl -rotate-1">
                FRESH PARTNERS.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed max-w-sm mx-auto pt-1">
              An elevated pickleball experience.
            </p>
          </div>

          {/* Interactive Pickleball Divider */}
          <div className="flex items-center justify-center gap-3 py-1 max-w-xs mx-auto">
            <div className="h-0.5 flex-1 bg-black/20 rounded-full" aria-hidden="true" />
            <HomePickleball />
            <div className="h-0.5 flex-1 bg-black/20 rounded-full" aria-hidden="true" />
          </div>

          {/* Combined Sign In & Create Account Actions */}
          <div className="pt-2 max-w-md mx-auto space-y-3">
            <Link
              href="/player-login"
              className="block w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-[#ccff00] hover:bg-[#b8eb00] text-black font-black text-base sm:text-lg border-2 border-black shadow-[3px_3px_0px_0px_#000] sm:shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display cursor-pointer"
            >
              Sign In to Play →
            </Link>
            <Link
              href="/player-signup"
              className="block w-full py-3 sm:py-3.5 px-6 rounded-2xl bg-white hover:bg-neutral-100 text-black font-black text-sm sm:text-base border-2 border-black shadow-[3px_3px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display cursor-pointer"
            >
              Create an Account
            </Link>
            <div className="border-t-2 border-dashed border-neutral-300 pt-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-neutral-600">
                In a rush?
              </p>
              <Link
                href="/temporary"
                className="block w-full py-2.5 sm:py-3 px-6 rounded-2xl bg-[#e0f2fe] hover:bg-sky-200 text-black font-black text-sm sm:text-base border-2 border-black shadow-[3px_3px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display cursor-pointer"
              >
                Start a Quick Session
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full px-4 py-6 sm:py-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* 1. Live Sessions Banner (if any live games in progress) */}
      <LiveSessionsHome groups={homeGroups} />

      {/* 2. Active Organizer Session (if signed in as group organizer) */}
      {activeGroup && (
        <section
          aria-label="Active organizer session"
          className="p-4 sm:p-5 rounded-2xl bg-[#dcfce7] border-2 border-black shadow-[3px_3px_0px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider text-black bg-[#ccff00] border border-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-ping" />
                Organizer Session
              </span>
            </div>

            <h2 className="font-display text-2xl font-black uppercase text-black leading-tight truncate">
              {activeGroup.name}
            </h2>
            <p className="text-xs font-bold text-neutral-700">
              You are currently signed in on this device.
            </p>
          </div>

          <Link
            href={`/g/${activeGroup.id}`}
            className="inline-flex items-center justify-center py-3 px-5 rounded-xl bg-black hover:bg-neutral-900 text-[#ccff00] font-black text-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.25)] active:translate-x-0.5 active:translate-y-0.5 transition-all font-display shrink-0"
          >
            Resume Group Dashboard →
          </Link>
        </section>
      )}

      {/* 3. Hero Section: Refined brand introduction with compact profile footer */}
      <section
        className="text-center space-y-4 sm:space-y-5 rounded-3xl border-2 border-black bg-[#FFFDF7] p-5 sm:p-7 shadow-[3px_3px_0px_0px_#000] sm:shadow-[4px_4px_0px_0px_#000]"
        aria-labelledby="home-title"
      >
        {/* Distinctive Barlow Condensed Display Heading */}
        <div className="space-y-1.5 sm:space-y-2">
          <h1
            id="home-title"
            className="font-display text-[2rem] sm:text-5xl lg:text-6xl font-black text-black tracking-tight leading-[0.92] uppercase max-w-2xl mx-auto"
          >
            FAIR ROUNDS.
            <br />
            <span className="inline-block mt-1.5 sm:mt-2 bg-[#ccff00] text-black px-3.5 sm:px-4 py-0.5 sm:py-1 border-2 border-black shadow-[2.5px_2.5px_0px_0px_#000] rounded-xl -rotate-1">
              FRESH PARTNERS.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed max-w-sm mx-auto pt-1">
            An elevated pickleball experience.
          </p>
        </div>

        {/* Interactive Pickleball Divider */}
        <div className="flex items-center justify-center gap-3 py-1 max-w-xs mx-auto">
          <div className="h-0.5 flex-1 bg-black/20 rounded-full" aria-hidden="true" />
          <HomePickleball />
          <div className="h-0.5 flex-1 bg-black/20 rounded-full" aria-hidden="true" />
        </div>

        {/* Subtle, horizontally aligned profile footer row */}
        <div
          aria-label="Account status"
          className="pt-1.5 sm:pt-2 flex items-center justify-between gap-3 sm:gap-4 w-full max-w-3xl mx-auto px-1 sm:px-2"
        >
          <div className="flex items-center gap-2.5 text-left min-w-0">
            <span className="w-8 h-8 rounded-full bg-[#ccff00] border-2 border-black flex items-center justify-center font-display font-black text-sm text-black shadow-[1.5px_1.5px_0px_0px_#000] shrink-0">
              {playerAccount.username.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-neutral-500 leading-none">
                Playing as
              </p>
              <p className="font-display text-sm sm:text-base font-black uppercase text-black leading-tight mt-0.5 truncate">
                @{playerAccount.username}
              </p>
            </div>
          </div>
          <Link
            href="/players"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black font-black text-xs sm:text-sm uppercase tracking-wider border-2 border-black shadow-[2.5px_2.5px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all font-display shrink-0 cursor-pointer"
          >
            View Profile →
          </Link>
        </div>
      </section>

      {/* 4. Your Groups Section */}
      <YourGroupsHome groups={homeGroups} />

      {/* 6. Main Action Cards: Cohesive, Refined 3-Card Layout */}
      <section aria-label="Main actions" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Find Groups */}
          <Link
            href="/players/groups"
            className="group flex flex-col justify-between p-5 sm:p-6 rounded-2xl border-2 border-black bg-[#FFFDF7] hover:bg-white shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all font-bold cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-[#fde047] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000]">
                  <UsersIcon className="w-5 h-5 stroke-[2.5]" />
                </span>
                <span className="text-neutral-400 group-hover:text-black group-hover:translate-x-0.5 transition-all font-black text-lg">
                  →
                </span>
              </div>
              <h3 className="font-display text-2xl font-black uppercase text-black mt-4">
                Find Groups
              </h3>
              <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                Discover recurring pickleball groups, check skill levels, and join rosters.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-black group-hover:underline">
              Browse groups →
            </span>
          </Link>

          {/* Action 2: Find Players */}
          <Link
            href="/players/find"
            className="group flex flex-col justify-between p-5 sm:p-6 rounded-2xl border-2 border-black bg-[#FFFDF7] hover:bg-white shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all font-bold cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-[#ccff00] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000]">
                  <SearchIcon className="w-5 h-5 stroke-[2.5]" />
                </span>
                <span className="text-neutral-400 group-hover:text-black group-hover:translate-x-0.5 transition-all font-black text-lg">
                  →
                </span>
              </div>
              <h3 className="font-display text-2xl font-black uppercase text-black mt-4">
                Find Players
              </h3>
              <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                Look up players across groups, inspect chemistry rankings, and match history.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-black group-hover:underline">
              Search roster →
            </span>
          </Link>

          {/* Action 3: Create A Group */}
          <Link
            href="/setup"
            className="group flex flex-col justify-between p-5 sm:p-6 rounded-2xl border-2 border-black bg-[#e0f2fe] hover:bg-sky-100 shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all font-bold cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-[#7dd3fc] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000]">
                  <ZapIcon className="w-5 h-5" />
                </span>
                <span className="text-neutral-400 group-hover:text-black group-hover:translate-x-0.5 transition-all font-black text-lg">
                  →
                </span>
              </div>
              <h3 className="font-display text-2xl font-black uppercase text-black mt-4">
                Create A Group
              </h3>
              <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                Configure courts, invite members, and auto-generate balanced round-robins.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-black group-hover:underline">
              Start group setup →
            </span>
          </Link>
        </div>
      </section>

    </main>
  );
}
