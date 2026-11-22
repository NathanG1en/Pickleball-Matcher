"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  SearchIcon,
  UserIcon,
  TargetIcon,
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

  // Hide navigation entirely on player sign-in page so the card is centered in the full viewport without scrolling
  if (pathname === "/player-login") {
    return null;
  }

  // Active route checking
  const isHomeActive = pathname === "/";
  const isGroupsActive =
    pathname.startsWith("/players/groups") ||
    pathname === "/setup" ||
    (pathname.startsWith("/g/") && !pathname.includes("/sessions/"));
  const isTrainingActive = pathname.startsWith("/training");
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
      id: "training",
      label: "Training",
      href: "/training",
      icon: TargetIcon,
      active: isTrainingActive,
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
          TOP NAVIGATION BAR (Desktop & Mobile)
          - Desktop: branding on left, center nav links, right profile/login
          - Mobile: compact branding header with no profile option (profile is in bottom bar)
         ========================================================================= */}
      <nav
        aria-label="Site navigation"
        className="sticky top-0 left-0 right-0 z-40 bg-[#FFFDF7]/95 backdrop-blur-md border-b-2 border-black"
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-13 md:h-16 flex items-center justify-between gap-4">
          {/* Left: Branding */}
          <Link
            href="/"
            className="flex items-center gap-2 md:gap-2.5 group transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-lg"
            aria-label="Pickleball Matchmaker Home"
          >
            <span className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#ccff00] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] md:shadow-[2px_2px_0px_0px_#000] group-hover:rotate-6 transition-transform">
              <PickleballIcon className="w-4 h-4 md:w-5 md:h-5 text-black" />
            </span>
            <span className="font-display text-lg md:text-xl font-black uppercase tracking-tight text-black group-hover:text-neutral-800">
              Pickleball Matchmaker
            </span>
          </Link>

          {/* Center: Primary Navigation Links (only on desktop md and when signed in) */}
          {playerAccount && (
            <div
              role="navigation"
              aria-label="Desktop main navigation"
              className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-black/5 border border-black/10"
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
                href="/training"
                aria-current={isTrainingActive ? "page" : undefined}
                className={`px-4 py-1.5 rounded-xl font-display text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isTrainingActive
                    ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                    : "text-neutral-700 hover:text-black hover:bg-white/80 border-2 border-transparent"
                }`}
              >
                Training
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
            </div>
          )}

          {/* Right: Profile Avatar & Account Dropdown, or Sign In Button (hidden on mobile; no profile option in mobile header) */}
          <div className="hidden md:flex items-center gap-2" ref={menuRef}>
            {playerAccount ? (
              <>
                <Link
                  href="/players"
                  aria-current={isProfileActive ? "page" : undefined}
                  aria-label={`Profile for @${playerAccount.username}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                    isProfileActive
                      ? "bg-[#ccff00] text-black border-black shadow-[2px_2px_0px_0px_#000]"
                      : "bg-white hover:bg-neutral-50 text-black border-black shadow-[2px_2px_0px_0px_#000]"
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-[#fde047] border border-black flex items-center justify-center font-display font-black text-xs uppercase text-black">
                    {playerAccount.username ? playerAccount.username.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                  </span>
                  <span className="font-display text-sm font-black uppercase tracking-wider max-w-[120px] truncate">
                    @{playerAccount.username}
                  </span>
                </Link>

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
              </>
            ) : (
              <Link
                href="/player-login"
                className="inline-flex items-center justify-center px-4 py-1.5 rounded-xl font-display text-sm font-black uppercase tracking-wider bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* =========================================================================
          MOBILE FIXED BOTTOM NAVIGATION BAR (md:hidden)
          Instagram-inspired persistent bottom bar with 5 destinations:
          Home, Groups, Training, Players, Profile
          Only rendered for signed-in players outside active session court view.
         ========================================================================= */}
      {!isSessionCourtView && Boolean(playerAccount) && (
        <nav
          aria-label="Mobile bottom navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FFFDF7]/95 backdrop-blur-md border-t-2 border-black shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="grid grid-cols-5 items-center px-1 pt-1.5 max-w-md mx-auto">
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

