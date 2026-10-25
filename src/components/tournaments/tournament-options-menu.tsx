"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTournamentAction, updateTournamentStatusAction } from "@/app/actions/tournaments";
import type { TournamentStatus } from "@/lib/domain/types";

export interface TournamentOptionsMenuProps {
  readonly groupId: string;
  readonly tournamentId: string;
  readonly tournamentName?: string | null;
  readonly status?: TournamentStatus;
  readonly onToggleStatus?: () => void | Promise<void>;
  readonly redirectTo?: string;
  readonly onDeleted?: () => void;
  readonly dataTestId?: string;
}

export function TournamentOptionsMenu({
  groupId,
  tournamentId,
  tournamentName,
  status,
  onToggleStatus,
  redirectTo,
  onDeleted,
  dataTestId = "tournament-options-menu-button",
}: TournamentOptionsMenuProps) {
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
      const res = await deleteTournamentAction({ groupId, tournamentId });
      if (res.ok) {
        setShowDeleteModal(false);
        setIsPending(false);
        onDeleted?.();
        router.replace(redirectTo ?? `/g/${groupId}`);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to delete tournament.");
        setIsPending(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tournament.");
      setIsPending(false);
    }
  };

  const handleToggleStatus = async () => {
    setMenuOpen(false);
    if (onToggleStatus) {
      await onToggleStatus();
      return;
    }
    if (!status) return;
    setIsPending(true);
    setError(null);
    try {
      const nextStatus = status === "completed" ? "active" : "completed";
      const res = await updateTournamentStatusAction({
        groupId,
        tournamentId,
        status: nextStatus,
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? "Failed to update tournament status.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tournament status.");
    } finally {
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
        aria-label="Tournament options"
        aria-expanded={menuOpen}
        data-testid={dataTestId}
        className="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-black bg-white text-lg sm:text-xl font-black leading-none shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 select-none"
      >
        ···
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Tournament actions"
          className="absolute right-0 top-10 sm:top-11 z-30 min-w-48 rounded-2xl border-2 border-black bg-white p-1.5 shadow-[4px_4px_0px_0px_#000] space-y-1"
        >
          {status && (
            <button
              type="button"
              role="menuitem"
              data-testid={status === "completed" ? "reopen-tournament-menu-item" : "finish-tournament-menu-item"}
              onClick={handleToggleStatus}
              disabled={isPending}
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium uppercase text-black hover:bg-neutral-100 cursor-pointer transition-colors disabled:opacity-50"
            >
              {status === "completed" ? "Reopen Tournament" : "Finish Tournament"}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            data-testid="delete-tournament-menu-item"
            onClick={handleOpenDelete}
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium uppercase text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
          >
            Delete Tournament
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Tournament"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to delete {tournamentName ? `"${tournamentName}"` : "this tournament"}? All matches and
              scores in this tournament will be permanently deleted. This action cannot be undone.
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
        confirmText={isPending ? "Deleting..." : "Delete Tournament"}
        cancelText="Cancel"
        confirmVariant="danger"
        confirmDataTestId="confirm-delete-tournament-button"
        disabled={isPending}
      />
    </div>
  );
}

