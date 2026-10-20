"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGroupAction } from "@/app/actions/group-settings";
import { leavePublicGroupAction } from "@/app/actions/player-account";
import { removeRecentGroup } from "@/lib/storage/recent-groups";
import { ShareGroupModal } from "@/components/groups/share-group-modal";
import { ConfirmGroupNameModal } from "@/components/groups/confirm-group-name-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function GroupOptionsMenu({
  groupId,
  groupName,
  isAccountOrganizer = false,
  isOrganizer = true,
}: {
  groupId: string;
  groupName: string;
  isAccountOrganizer?: boolean;
  isOrganizer?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Group options"
        aria-expanded={menuOpen}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-black bg-white text-xl font-black leading-none shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5"
      >
        ···
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-11 z-30 min-w-44 rounded-2xl border-2 border-black bg-white p-1.5 shadow-[4px_4px_0px_0px_#000] space-y-1">
          {isOrganizer ? (
            <button
              type="button"
              data-testid="delete-group-menu-item"
              onClick={() => {
                setMenuOpen(false);
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 cursor-pointer"
            >
              Delete Group
            </button>
          ) : (
            <button
              type="button"
              data-testid="leave-group-menu-item"
              onClick={() => {
                setMenuOpen(false);
                setLeaveError(null);
                setShowLeaveModal(true);
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 cursor-pointer"
            >
              Leave Group
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
        confirmText={leavePending ? "Leaving…" : "Leave Group"}
        cancelText="Cancel"
        confirmVariant="danger"
        disabled={leavePending}
        confirmDataTestId="confirm-leave-group-button"
      />
    </div>
  );
}

