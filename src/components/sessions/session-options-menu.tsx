"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { deleteSessionAction, duplicateSessionAction, updateSessionNameAction } from "@/app/actions/sessions";
import type { SessionRecord } from "@/lib/domain/types";

export interface SessionOptionsMenuProps {
  readonly groupId: string;
  readonly sessionId: string;
  readonly sessionName?: string | null;
  readonly redirectTo?: string;
  readonly onDeleted?: () => void;
  readonly onDuplicated?: (newSession: SessionRecord) => void;
  readonly onRenamed?: (newName: string) => void;
  readonly dataTestId?: string;
}

export function SessionOptionsMenu({
  groupId,
  sessionId,
  sessionName,
  redirectTo,
  onDeleted,
  onDuplicated,
  onRenamed,
  dataTestId = "session-options-menu-button",
}: SessionOptionsMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState(sessionName ?? "");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleOpenRename = () => {
    setMenuOpen(false);
    setRenameInput(sessionName ?? "");
    setRenameError(null);
    setShowRenameModal(true);
  };

  const handleCloseRename = () => {
    if (isPending) return;
    setRenameInput(sessionName ?? "");
    setRenameError(null);
    setShowRenameModal(false);
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameInput.trim();
    if (!trimmed || isPending) return;
    if (trimmed === (sessionName ?? "").trim()) {
      setShowRenameModal(false);
      return;
    }
    setIsPending(true);
    setRenameError(null);
    try {
      const res = await updateSessionNameAction({
        groupId,
        sessionId,
        name: trimmed,
      });
      if (res.ok) {
        setShowRenameModal(false);
        setIsPending(false);
        onRenamed?.(trimmed);
        router.refresh();
      } else {
        setRenameError(res.error ?? "Failed to rename session.");
        setIsPending(false);
      }
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Failed to rename session.");
      setIsPending(false);
    }
  };

  const handleOpenDelete = () => {
    setMenuOpen(false);
    setError(null);
    setShowDeleteModal(true);
  };

  const handleCloseDelete = () => {
    if (isPending) return;
    setError(null);
    setShowDeleteModal(false);
  };

  const handleConfirmDelete = async () => {
    setIsPending(true);
    setError(null);
    try {
      const res = await deleteSessionAction({ groupId, sessionId });
      if (res.ok) {
        setShowDeleteModal(false);
        setIsPending(false);
        onDeleted?.();
        if (redirectTo) {
          router.replace(redirectTo);
        }
        router.refresh();
      } else {
        setError(res.error ?? "Failed to delete session.");
        setIsPending(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session.");
      setIsPending(false);
    }
  };

  const handleOpenDuplicate = () => {
    setMenuOpen(false);
    setError(null);
    setShowDuplicateModal(true);
  };

  const handleCloseDuplicate = () => {
    if (isPending) return;
    setError(null);
    setShowDuplicateModal(false);
  };

  const handleConfirmDuplicate = async () => {
    setIsPending(true);
    setError(null);
    try {
      const res = await duplicateSessionAction({ groupId, sessionId });
      if (res.ok) {
        setShowDuplicateModal(false);
        setIsPending(false);
        onDuplicated?.(res.data);
        router.push(`/g/${groupId}/sessions/${res.data.id}`);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to duplicate session.");
        setIsPending(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate session.");
      setIsPending(false);
    }
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
        aria-label="Session options"
        aria-expanded={menuOpen}
        data-testid={dataTestId}
        className="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-black bg-white text-lg sm:text-xl font-black leading-none shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 select-none"
      >
        ···
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Session actions"
          className="absolute right-0 top-10 sm:top-11 z-30 min-w-44 rounded-2xl border-2 border-black bg-white p-1.5 shadow-[4px_4px_0px_0px_#000] space-y-1"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="rename-session-menu-item"
            onClick={handleOpenRename}
            className="w-full rounded-xl px-3 py-2 text-left text-xs font-black uppercase text-black hover:bg-neutral-100 cursor-pointer transition-colors"
          >
            Rename Session
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="duplicate-session-menu-item"
            onClick={handleOpenDuplicate}
            className="w-full rounded-xl px-3 py-2 text-left text-xs font-black uppercase text-black hover:bg-neutral-100 cursor-pointer transition-colors"
          >
            Duplicate Session
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="delete-session-menu-item"
            onClick={handleOpenDelete}
            className="w-full rounded-xl px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
          >
            Delete Session
          </button>
        </div>
      )}

      <Modal
        isOpen={showRenameModal}
        onClose={handleCloseRename}
        title="Rename Session"
        description="Enter a new name for this session."
        size="sm"
        role="dialog"
      >
        <form onSubmit={handleConfirmRename} className="space-y-4 pt-2">
          <div>
            <label
              htmlFor="rename-session-name-input"
              className="block text-xs font-black uppercase tracking-wider text-black mb-1.5"
            >
              Session Name
            </label>
            <input
              id="rename-session-name-input"
              type="text"
              required
              maxLength={80}
              placeholder="Session name..."
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              disabled={isPending}
              autoFocus
              className="w-full p-2.5 rounded-xl border-2 border-black bg-white text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
            />
          </div>

          {renameError && (
            <p role="alert" className="text-xs font-bold text-red-600">
              {renameError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseRename}
              disabled={isPending}
              className="px-4 py-2 rounded-xl border-2 border-black bg-white font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !renameInput.trim()}
              data-testid="confirm-rename-session-button"
              className="px-4 py-2 rounded-xl border-2 border-black bg-[#ccff00] text-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDuplicateModal}
        onClose={handleCloseDuplicate}
        onConfirm={handleConfirmDuplicate}
        title="Duplicate Session"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to duplicate {sessionName ? `"${sessionName}"` : "this session"}? A new session will be created
              with attendance copied from the end of this session, and its name will be set to today&apos;s date.
            </p>
            {error && (
              <div
                role="alert"
                className="p-2.5 rounded-lg bg-red-100 border border-red-500 text-red-800 text-xs font-bold"
              >
                {error}
              </div>
            )}
          </div>
        }
        confirmText={isPending ? "Duplicating..." : "Duplicate Session"}
        cancelText="Cancel"
        confirmVariant="primary"
        confirmDataTestId="confirm-duplicate-session-button"
        disabled={isPending}
      />

      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Session"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to delete {sessionName ? `"${sessionName}"` : "this session"}? All rounds, matches, and
              scores in this session will be permanently deleted. This action cannot be undone.
            </p>
            {error && (
              <div
                role="alert"
                className="p-2.5 rounded-lg bg-red-100 border border-red-500 text-red-800 text-xs font-bold"
              >
                {error}
              </div>
            )}
          </div>
        }
        confirmText={isPending ? "Deleting..." : "Delete Session"}
        cancelText="Cancel"
        confirmVariant="danger"
        confirmDataTestId="confirm-delete-session-button"
        disabled={isPending}
      />
    </div>
  );
}

