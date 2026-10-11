"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGroupAction } from "@/app/actions/group-settings";
import { Button } from "@/components/ui/button";
import { ShareGroupModal } from "@/components/groups/share-group-modal";

export function GroupOptionsMenu({
  groupId,
  groupName,
  isAccountOrganizer,
}: {
  groupId: string;
  groupName: string;
  isAccountOrganizer: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName.trim().toLowerCase() !== groupName.trim().toLowerCase()) {
      setDeleteError("Group name does not match.");
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    const result = await deleteGroupAction({
      groupId,
      confirmationName: confirmName.trim(),
    });
    if (result.ok) {
      router.replace(isAccountOrganizer ? "/players" : "/");
      router.refresh();
    } else {
      setDeleteError(result.error ?? "Unable to delete group.");
      setDeletePending(false);
    }
  };

  const isConfirmed = confirmName.trim().toLowerCase() === groupName.trim().toLowerCase();

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
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setShowShareModal(true);
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-xs font-black uppercase text-black hover:bg-neutral-100 flex items-center gap-2 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
              aria-hidden="true"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share Group
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setConfirmName("");
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 cursor-pointer"
          >
            Delete Group
          </button>
        </div>
      )}

      <ShareGroupModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        groupId={groupId}
        groupName={groupName}
      />

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="w-full max-w-sm space-y-4 rounded-3xl border-[3px] border-black bg-white p-6 text-black shadow-[8px_8px_0px_0px_#000]"
          >
            <h3 id="delete-dialog-title" className="font-display text-2xl font-black uppercase tracking-tight text-black">
              Delete Group
            </h3>
            <p id="delete-dialog-description" className="text-sm font-bold text-neutral-700">
              You are about to delete the group. Are you sure? Enter in the name of the group to continue.
            </p>
            <form onSubmit={handleDelete} className="space-y-3">
              <div>
                <label htmlFor="confirm-group-name" className="block text-xs font-black uppercase tracking-wider text-neutral-600 mb-1">
                  Type <span className="text-black font-black select-all">&quot;{groupName}&quot;</span> to confirm
                </label>
                <input
                  id="confirm-group-name"
                  type="text"
                  required
                  value={confirmName}
                  onChange={(e) => {
                    setConfirmName(e.target.value);
                    if (deleteError) setDeleteError(null);
                  }}
                  placeholder={groupName}
                  className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                  autoFocus
                />
              </div>

              {deleteError && (
                <p role="alert" className="text-xs font-bold text-red-600">
                  {deleteError}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletePending}
                  className="font-display text-xs uppercase tracking-wider"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={!isConfirmed || deletePending}
                  className="font-display text-xs uppercase tracking-wider"
                >
                  {deletePending ? "Deleting…" : "Delete Group"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

