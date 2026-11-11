"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGroupAction } from "@/app/actions/group-settings";
import { ConfirmGroupNameModal } from "@/components/groups/confirm-group-name-modal";
import { AlertTriangleIcon, Trash2Icon } from "@/components/ui/icons";

export interface DangerZoneTabProps {
  groupId: string;
  groupName: string;
  canDeleteGroup: boolean;
  isAccountOrganizer?: boolean;
}

export function DangerZoneTab({
  groupId,
  groupName,
  canDeleteGroup,
  isAccountOrganizer = false,
}: DangerZoneTabProps) {
  const router = useRouter();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (confirmationName: string) => {
    if (confirmationName.trim() !== groupName.trim()) {
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

  if (!canDeleteGroup) {
    return (
      <div className="p-4 rounded-xl border-2 border-black bg-neutral-100 text-neutral-800 text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
        You do not have permission to delete this group.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-red-500 bg-red-50/50 p-4 sm:p-5 space-y-4 shadow-[3px_3px_0px_0px_#000]">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-red-100 border-2 border-red-500 text-red-700 shrink-0">
            <AlertTriangleIcon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-base font-black uppercase text-red-900 tracking-tight">
              Delete This Group
            </h3>
            <p className="text-xs font-medium text-neutral-700 leading-relaxed">
              Once you delete a group, there is no going back. All active and past sessions, tournament brackets, and player roster links for this group will be permanently deleted.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setShowConfirmModal(true);
            }}
            data-testid="delete-group-menu-item"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-black bg-[#E32929] hover:bg-red-700 text-white font-display text-xs sm:text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all cursor-pointer"
          >
            <Trash2Icon className="h-4 w-4 stroke-2" />
            <span>Delete Group</span>
          </button>
        </div>
      </div>

      <ConfirmGroupNameModal
        isOpen={showConfirmModal}
        onClose={() => {
          if (!deletePending) {
            setShowConfirmModal(false);
            setDeleteError(null);
          }
        }}
        onConfirm={handleDelete}
        title="Delete Group"
        description="You are about to permanently delete this group. This action is irreversible. Enter the name of the group to continue."
        groupName={groupName}
        confirmButtonText="Delete Group"
        pendingButtonText="Deleting…"
        confirmVariant="danger"
        error={deleteError}
        isPending={deletePending}
        onClearError={() => setDeleteError(null)}
      />
    </div>
  );
}
