"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTournamentAction, updateTournamentStatusAction } from "@/app/actions/tournaments";
import type { TournamentStatus } from "@/lib/domain/types";
import { RotateCwIcon, TrophyIcon, Trash2Icon } from "@/components/ui/icons";

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
  const [openUpward, setOpenUpward] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => {
      const next = !prev;
      if (next && menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 140;
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
        onClick={handleToggleMenu}
        aria-label="Tournament options"
        aria-expanded={menuOpen}
        data-testid={dataTestId}
        className="flex h-7 w-7 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-lg sm:rounded-xl border-2 border-black bg-white text-sm sm:text-xl font-black leading-none shadow-[1px_1px_0px_0px_#000] sm:shadow-[2px_2px_0px_0px_#000] hover:bg-[#ccff00] active:translate-x-0.5 active:translate-y-0.5 select-none transition-colors"
      >
        ···
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Tournament actions"
          className={`absolute right-0 ${
            openUpward ? "bottom-full mb-1.5 dropdown-animate-up" : "top-full mt-1.5 dropdown-animate"
          } z-40 w-[260px] max-w-[calc(100vw-32px)] rounded-[20px] border-[2.5px] border-black bg-[#FFFDF6] p-2 space-y-0.5`}
        >
          {status && (
            <button
              type="button"
              role="menuitem"
              data-testid={status === "completed" ? "reopen-tournament-menu-item" : "finish-tournament-menu-item"}
              onClick={handleToggleStatus}
              disabled={isPending}
              className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-black hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none disabled:opacity-50"
            >
              {status === "completed" ? (
                <>
                  <RotateCwIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                  <span>Reopen Tournament</span>
                </>
              ) : (
                <>
                  <TrophyIcon className="w-[18px] h-[18px] shrink-0 text-black stroke-2" />
                  <span>Finish Tournament</span>
                </>
              )}
            </button>
          )}
          <div className="my-1 border-t border-neutral-300" role="separator" />
          <button
            type="button"
            role="menuitem"
            data-testid="delete-tournament-menu-item"
            onClick={handleOpenDelete}
            className="flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-semibold text-[#E32929] hover:bg-[#F0EEE7] active:bg-[#EAE5D9] transition-colors duration-150 cursor-pointer select-none"
          >
            <Trash2Icon className="w-[18px] h-[18px] shrink-0 text-[#E32929] stroke-2" />
            <span>Delete Tournament</span>
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

