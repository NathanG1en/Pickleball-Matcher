"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteSessionAction } from "@/app/actions/sessions";

export interface SessionOptionsMenuProps {
  readonly groupId: string;
  readonly sessionId: string;
  readonly sessionName?: string | null;
  readonly redirectTo?: string;
  readonly onDeleted?: () => void;
  readonly dataTestId?: string;
}

export function SessionOptionsMenu({
  groupId,
  sessionId,
  sessionName,
  redirectTo,
  onDeleted,
  dataTestId = "session-options-menu-button",
}: SessionOptionsMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
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
            data-testid="delete-session-menu-item"
            onClick={handleOpenDelete}
            className="w-full rounded-xl px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
          >
            Delete Session
          </button>
        </div>
      )}

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
        disabled={isPending}
      />
    </div>
  );
}

