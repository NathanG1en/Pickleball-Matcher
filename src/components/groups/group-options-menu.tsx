"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGroupAction } from "@/app/actions/group-settings";
import { leavePublicGroupAction } from "@/app/actions/player-account";
import { removeRecentGroup } from "@/lib/storage/recent-groups";
import { ShareGroupModal } from "@/components/groups/share-group-modal";
import { ConfirmGroupNameModal } from "@/components/groups/confirm-group-name-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2Icon, LogOutIcon } from "@/components/ui/icons";

export function GroupOptionsMenu({
  groupId,
  groupName,
  isAccountOrganizer = false,
  isOrganizer = true,
  initialMenuOpen = false,
}: {
  groupId: string;
  groupName: string;
  isAccountOrganizer?: boolean;
  isOrganizer?: boolean;
  initialMenuOpen?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(initialMenuOpen);
  const [openUpward, setOpenUpward] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggleMenu = () => {
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

  const handleDelete = async (confirmationName: string) => {
    if (confirmationName.trim().toLowerCase() !== groupName.trim().toLowerCase()) {
      setDeleteError("Group name does not match.");
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    const result = await deleteGroupAction({
      groupId,
      confirmationName,
    });
    if (result.ok) {
      router.replace(isAccountOrganizer ? "/players" : "/");
      router.refresh();
    } else {
      setDeleteError(result.error ?? "Unable to delete group.");
      setDeletePending(false);
    }
  };

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
        onClick={handleToggleMenu}
        aria-label="Group options"
        aria-expanded={menuOpen}
        className="flex h-7 w-7 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-lg sm:rounded-xl border-2 border-black bg-white text-sm sm:text-xl font-black leading-none shadow-[1px_1px_0px_0px_#000] sm:shadow-[2px_2px_0px_0px_#000] hover:bg-[#ccff00] active:translate-x-0.5 active:translate-y-0.5 transition-colors"
      >
        ···
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Group actions"
          className={`absolute right-0 ${
            openUpward ? "bottom-full mb-1.5 dropdown-animate-up" : "top-full mt-1.5 dropdown-animate"
          } z-40 w-[250px] max-w-[calc(100vw-32px)] rounded-[20px] border-[2.5px] border-black bg-[#FFFDF6] p-2 space-y-0.5`}
        >
          {isOrganizer ? (
            <button
              type="button"
              role="menuitem"
              data-testid="delete-group-menu-item"
              onClick={() => {
                setMenuOpen(false);
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-[#E32929] hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"
            >
              <Trash2Icon className="w-[18px] h-[18px] shrink-0 text-[#E32929] stroke-2" />
              <span>Delete Group</span>
            </button>
          ) : (
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
          )}
        </div>
      )}

      <ShareGroupModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        groupId={groupId}
        groupName={groupName}
      />

      <ConfirmGroupNameModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Group"
        description="You are about to delete the group. Are you sure? Enter in the name of the group to continue."
        groupName={groupName}
        confirmButtonText="Delete Group"
        pendingButtonText="Deleting…"
        confirmVariant="danger"
        error={deleteError}
        isPending={deletePending}
        onClearError={() => setDeleteError(null)}
      />

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

