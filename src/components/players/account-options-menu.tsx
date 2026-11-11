"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { playerLogoutAction } from "@/app/actions/player-account";
import { clearRecentGroups } from "@/lib/storage/recent-groups";
import { LogOutIcon } from "@/components/ui/icons";

export interface AccountOptionsMenuProps {
  className?: string;
  initialMenuOpen?: boolean;
}

export function AccountOptionsMenu({
  className,
  initialMenuOpen = false,
}: AccountOptionsMenuProps = {}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(initialMenuOpen);
  const [openUpward, setOpenUpward] = useState(false);
  const [pending, setPending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickButton = () => {
    setMenuOpen((prev) => {
      const next = !prev;
      if (next && menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 80;
        setOpenUpward(spaceBelow < menuHeight + 16 && rect.top > menuHeight);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setPending(true);
    clearRecentGroups();
    await playerLogoutAction();
    router.replace("/");
    router.refresh();
  };

  return (
    <div className={`relative ${className ?? ""}`} ref={menuRef}>
      <button
        type="button"
        onClick={handleClickButton}
        aria-label="Account options"
        aria-expanded={menuOpen}
        data-testid="account-options-menu-button"
        className="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-black bg-white text-base sm:text-xl font-black leading-none shadow-[2px_2px_0px_0px_#000] hover:bg-[#ccff00] active:translate-x-0.5 active:translate-y-0.5 transition-colors"
      >
        ···
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Account actions"
          className={`absolute right-0 ${
            openUpward ? "bottom-full mb-1.5 dropdown-animate-up" : "top-full mt-1.5 dropdown-animate"
          } z-40 w-[200px] max-w-[calc(100vw-32px)] rounded-[20px] border-[2.5px] border-black bg-[#FFFDF6] p-2 space-y-0.5 shadow-[4px_4px_0px_0px_#000]`}
        >
          <button
            type="button"
            role="menuitem"
            data-testid="logout-menu-item"
            onClick={handleLogout}
            disabled={pending}
            className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-[#E32929] hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none disabled:opacity-60"
          >
            <LogOutIcon className="w-[18px] h-[18px] shrink-0 text-[#E32929] stroke-2" />
            <span>{pending ? "Signing out…" : "Log Out"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
