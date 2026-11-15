"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  SearchIcon,
  UserIcon,
  PickleballIcon,
  LogOutIcon,
} from "@/components/ui/icons";
import { useState, useRef, useEffect } from "react";
import { playerLogoutAction } from "@/app/actions/player-account";
import { clearRecentGroups } from "@/lib/storage/recent-groups";
import { useRouter } from "next/navigation";

export interface ResponsiveNavigationProps {
  playerAccount?: {
    id?: string;
    username: string;
    name?: string;
  } | null;
}

export function ResponsiveNavigation({ playerAccount }: ResponsiveNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  // Active route checking
  const isHomeActive = pathname === "/";
  const isGroupsActive =
    pathname.startsWith("/players/groups") ||
    pathname === "/setup" ||
    (pathname.startsWith("/g/") && !pathname.includes("/sessions/"));
  const isPlayersActive = pathname.startsWith("/players/find");
  const isProfileActive =
    pathname === "/players" ||
    (pathname.startsWith("/players/") &&
      !pathname.startsWith("/players/groups") &&
      !pathname.startsWith("/players/find"));

  // Hide mobile bottom nav during live match court sessions so it doesn't overlap the match action bar
  const isSessionCourtView = pathname.includes("/sessions/");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    clearRecentGroups();
    await playerLogoutAction();
    setAccountMenuOpen(false);
    router.replace("/");
    router.refresh();
  };

  const navItems = [
    {
      id: "home",
      label: "Home",
      href: "/",
      icon: HomeIcon,
      active: isHomeActive,
    },
    {
      id: "groups",
      label: "Groups",
      href: "/players/groups",
      icon: UsersIcon,
      active: isGroupsActive,
    },
    {
      id: "players",
      label: "Players",
      href: "/players/find",
      icon: SearchIcon,
      active: isPlayersActive,
    },
    {
      id: "profile",
      label: "Profile",
      href: "/players",
      icon: UserIcon,
      active: isProfileActive,
    },
  ];

  return (
    <>
      {/* =========================================================================
          DESKTOP TOP NAVIGATION BAR (md and up)
          Compact, editorial neo-brutalist header bar with branding, links, and avatar
         ========================================================================= */}
      <header className="hidden md:block sticky top-0 left-0 right-0 z-40 bg-[#FFFDF7]/95 backdrop-blur-md border-b-2 border-black">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Branding */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-lg"
            aria-label="Pickleball Matchmaker Home"
          >
            <span className="w-8 h-8 rounded-lg bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] group-hover:rotate-6 transition-transform">
              <PickleballIcon className="w-5 h-5 text-black" />
            </span>
            <span className="font-display text-xl font-black uppercase tracking-tight text-black group-hover:text-neutral-800">
              Pickleball Matchmaker
            </span>
          </Link>

          {/* Center: Primary Navigation Links */}
          <nav
            aria-label="Desktop main navigation"
            className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/5 border border-black/10"
          >
            <Link
              href="/"
              aria-current={isHomeActive ? "page" : undefined}
              className={`px-4 py-1.5 rounded-xl font-display text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
                isHomeActive
                  ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                  : "text-neutral-700 hover:text-black hover:bg-white/80 border-2 border-transparent"
              }`}
            >
              Home
            </Link>
            <Link
              href="/players/groups"
              aria-current={isGroupsActive ? "page" : undefined}
              className={`px-4 py-1.5 rounded-xl font-display text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
                isGroupsActive
                  ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                  : "text-neutral-700 hover:text-black hover:bg-white/80 border-2 border-transparent"
              }`}
            >
              Groups
            </Link>
            <Link
              href="/players/find"
              aria-current={isPlayersActive ? "page" : undefined}
              className={`px-4 py-1.5 rounded-xl font-display text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
                isPlayersActive
                  ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                  : "text-neutral-700 hover:text-black hover:bg-white/80 border-2 border-transparent"
              }`}
            >
              Players
            </Link>
          </nav>

          {/* Right: Profile Avatar & Account Dropdown */}
          <div className="flex items-center gap-2" ref={menuRef}>
            <Link
              href="/players"
              aria-current={isProfileActive ? "page" : undefined}
              aria-label={playerAccount ? `Profile for @${playerAccount.username}` : "Profile"}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                isProfileActive
                  ? "bg-[#ccff00] text-black border-black shadow-[2px_2px_0px_0px_#000]"
                  : "bg-white hover:bg-neutral-50 text-black border-black shadow-[2px_2px_0px_0px_#000]"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-[#fde047] border border-black flex items-center justify-center font-display font-black text-xs uppercase text-black">
                {playerAccount?.username ? playerAccount.username.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
              </span>
              <span className="font-display text-sm font-black uppercase tracking-wider max-w-[120px] truncate">
                {playerAccount ? `@${playerAccount.username}` : "Profile"}
              </span>
            </Link>

            {playerAccount && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  aria-label="Account options menu"
                  aria-expanded={accountMenuOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-black bg-white hover:bg-[#ccff00] shadow-[2px_2px_0px_0px_#000] text-base font-black active:translate-x-0.5 active:translate-y-0.5 transition-colors cursor-pointer"
                >
                  ···
                </button>

                {accountMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Account actions"
                    className="absolute right-0 top-full mt-2 w-48 rounded-2xl border-2 border-black bg-[#FFFDF7] p-2 space-y-1 shadow-[4px_4px_0px_0px_#000] z-50 dropdown-animate"
                  >
                    <Link
                      href="/players"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-black uppercase text-black hover:bg-neutral-100 transition-colors"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>
                    <Link
                      href="/setup"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-black uppercase text-black hover:bg-neutral-100 transition-colors"
                    >
                      <UsersIcon className="w-4 h-4" />
                      <span>Create A Group</span>
                    </Link>
                    <div className="border-t border-black/10 my-1" />
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isLoggingOut}
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-black uppercase text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <LogOutIcon className="w-4 h-4 stroke-2" />
                      <span>{isLoggingOut ? "Signing out…" : "Log Out"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          MOBILE TOP BRANDING BAR (Compact, md:hidden)
          Clean compact branding header for mobile screens
         ========================================================================= */}
      <header className="md:hidden sticky top-0 left-0 right-0 z-40 bg-[#FFFDF7]/95 backdrop-blur-md border-b-2 border-black px-4 h-13 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-lg"
          aria-label="Pickleball Matchmaker Home"
        >
          <span className="w-7 h-7 rounded-lg bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000]">
            <PickleballIcon className="w-4 h-4 text-black" />
          </span>
          <span className="font-display text-lg font-black uppercase tracking-tight text-black">
            Pickleball Matchmaker
          </span>
        </Link>
        {playerAccount && (
          <Link
            href="/players"
            aria-label={`Profile for @${playerAccount.username}`}
            className="w-7 h-7 rounded-full bg-[#fde047] border-2 border-black flex items-center justify-center font-display font-black text-xs uppercase text-black shadow-[1.5px_1.5px_0px_0px_#000]"
          >
            {playerAccount.username.charAt(0).toUpperCase()}
          </Link>
        )}
      </header>

      {/* =========================================================================
          MOBILE FIXED BOTTOM NAVIGATION BAR (md:hidden)
          Instagram-inspired persistent bottom bar with 4 destinations:
          Home, Groups, Players, Profile
         ========================================================================= */}
      {!isSessionCourtView && (
        <nav
          aria-label="Mobile bottom navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FFFDF7]/95 backdrop-blur-md border-t-2 border-black shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="grid grid-cols-4 items-center px-2 pt-1.5 max-w-md mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={item.active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-h-[48px] select-none ${
                    item.active
                      ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                      : "text-neutral-600 hover:text-black border-2 border-transparent"
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                  <span className="font-display text-[10px] font-black uppercase tracking-wider mt-0.5 leading-none">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

