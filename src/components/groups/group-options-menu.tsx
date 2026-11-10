"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { leavePublicGroupAction } from "@/app/actions/player-account";
import { removeRecentGroup } from "@/lib/storage/recent-groups";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LogOutIcon } from "@/components/ui/icons";
import { GroupSettingsModal } from "@/components/groups/group-settings/group-settings-modal";
import type {
  GroupOrganizerPermissions,
  GroupOrganizerRecord,
  PlayerRecord,
} from "@/lib/domain/types";

export interface GroupOptionsMenuProps {
  groupId: string;
  groupName: string;
  isPublic?: boolean;
  isHost?: boolean;
  isAccountOrganizer?: boolean;
  isOrganizer?: boolean;
  organizerPermissions?: GroupOrganizerPermissions | null;
  players?: readonly PlayerRecord[];
  organizers?: readonly GroupOrganizerRecord[];
  initialMenuOpen?: boolean;
}

export function GroupOptionsMenu({
  groupId,
  groupName,
  isPublic = false,
  isHost = false,
  isAccountOrganizer = false,
  isOrganizer = true,
  organizerPermissions,
  players = [],
  organizers = [],
  initialMenuOpen = false,
}: GroupOptionsMenuProps) {
  const router = useRouter();

  // If user is organizer or host, clicking the three dots opens the Group Settings modal
  const hasSettingsAccess = isOrganizer || isHost;

  const [showSettingsModal, setShowSettingsModal] = useState(
    hasSettingsAccess && initialMenuOpen,
  );

  // For regular members (non-organizer non-host), clicking three dots opens the Leave dropdown
  const [menuOpen, setMenuOpen] = useState(!hasSettingsAccess && initialMenuOpen);
  const [openUpward, setOpenUpward] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickButton = () => {
    if (hasSettingsAccess) {
      setShowSettingsModal(true);
      return;
    }

    setMenuOpen((prev) => {
      const next = !prev;
      if (next && menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 120;
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

  const handleLeave = async () => {
    setLeavePending(true);
    setLeaveError(null);
    const result = await leavePublicGroupAction({ groupId });
    if (result.ok) {
      removeRecentGroup(groupId);
      router.replace("/players");
      router.refresh();
    } else {
      setLeaveError(result.error ?? "Unable to leave group.");
      setLeavePending(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={handleClickButton}
        aria-label="Group options"
        aria-expanded={hasSettingsAccess ? showSettingsModal : menuOpen}
        className="flex h-7 w-7 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-lg sm:rounded-xl border-2 border-black bg-white text-sm sm:text-xl font-black leading-none shadow-[1px_1px_0px_0px_#000] sm:shadow-[2px_2px_0px_0px_#000] hover:bg-[#ccff00] active:translate-x-0.5 active:translate-y-0.5 transition-colors"
      >
        ···
      </button>

      {/* Member dropdown (Leave only) */}
      {!hasSettingsAccess && menuOpen && (
        <div
          role="menu"
          aria-label="Group actions"
          className={`absolute right-0 ${
            openUpward ? "bottom-full mb-1.5 dropdown-animate-up" : "top-full mt-1.5 dropdown-animate"
          } z-40 w-[250px] max-w-[calc(100vw-32px)] rounded-[20px] border-[2.5px] border-black bg-[#FFFDF6] p-2 space-y-0.5`}
        >
          <button
            type="button"
            role="menuitem"
            data-testid="leave-group-menu-item"
            onClick={() => {
              setMenuOpen(false);
              setLeaveError(null);
              setShowLeaveModal(true);
            }}
            className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-[#E32929] hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"
          >
            <LogOutIcon className="w-[18px] h-[18px] shrink-0 text-[#E32929] stroke-2" />
            <span>Leave</span>
          </button>
        </div>
      )}

      {/* Settings Modal for Host / Organizers */}
      {hasSettingsAccess && (
        <GroupSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          groupId={groupId}
          initialGroupName={groupName}
          initialIsPublic={isPublic}
          isHost={isHost}
          isOrganizer={isOrganizer}
          isAccountOrganizer={isAccountOrganizer}
          organizerPermissions={organizerPermissions}
          players={players}
          organizers={organizers}
        />
      )}

      {/* Leave group confirmation dialog for members */}
      <ConfirmDialog
        isOpen={showLeaveModal}
        onClose={() => {
          if (!leavePending) {
            setLeaveError(null);
            setShowLeaveModal(false);
          }
        }}
        onConfirm={handleLeave}
        title="Leave Group"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to leave {groupName ? `"${groupName}"` : "this group"}?
            </p>
            {leaveError && (
              <div
                role="alert"
                className="p-2.5 rounded-lg bg-red-100 border border-red-500 text-red-800 text-xs font-bold"
              >
                {leaveError}
              </div>
            )}
          </div>
        }
        confirmText={leavePending ? "Leaving…" : "Leave"}
        cancelText="Cancel"
        confirmVariant="danger"
        disabled={leavePending}
        confirmDataTestId="confirm-leave-group-button"
      />
    </div>
  );
}
