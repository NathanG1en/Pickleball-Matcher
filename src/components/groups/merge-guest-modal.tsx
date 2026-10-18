"use client";

import React, { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Button, Input, Label, Modal } from "@/components/ui";
import { mergeGuestPlayersAction } from "@/app/actions/players";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import type { PlayerRecord } from "@/lib/domain/types";
import { formatDupr } from "@/lib/domain/rating-display";

export interface MergeGuestModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly guestPlayer: PlayerRecord | null;
  readonly allPlayers: readonly PlayerRecord[];
  readonly groupId: string;
  readonly onMerged?: (mergedPlayer: PlayerRecord) => void;
}

const SKIP_CONFIRM_KEY = "pickleball:skip_merge_guest_confirm";

function subscribeToLocalStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSkipConfirmSnapshot(): boolean {
  try {
    return localStorage.getItem(SKIP_CONFIRM_KEY) === "true";
  } catch {
    return false;
  }
}

function getSkipConfirmServerSnapshot(): boolean {
  return false;
}

export function MergeGuestModal({
  isOpen,
  onClose,
  guestPlayer,
  allPlayers,
  groupId,
  onMerged,
}: MergeGuestModalProps) {
  if (!isOpen || !guestPlayer) return null;

  return (
    <MergeGuestModalContent
      onClose={onClose}
      guestPlayer={guestPlayer}
      allPlayers={allPlayers}
      groupId={groupId}
      onMerged={onMerged}
    />
  );
}

function MergeGuestModalContent({
  onClose,
  guestPlayer,
  allPlayers,
  groupId,
  onMerged,
}: {
  readonly onClose: () => void;
  readonly guestPlayer: PlayerRecord;
  readonly allPlayers: readonly PlayerRecord[];
  readonly groupId: string;
  readonly onMerged?: (mergedPlayer: PlayerRecord) => void;
}) {
  const nameInputId = useId();
  const searchInputId = useId();
  const doNotAskId = useId();

  const [mergedName, setMergedName] = useState(guestPlayer.name);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set([guestPlayer.id]),
  );
  const [searchFilter, setSearchFilter] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skipConfirmation = useSyncExternalStore(
    subscribeToLocalStorage,
    getSkipConfirmSnapshot,
    getSkipConfirmServerSnapshot,
  );

  // Filter only active unique guest players from this group
  const candidateGuests = useMemo(() => {
    const seen = new Set<string>();
    return allPlayers.filter((p) => {
      if (p.accountId || !p.active || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [allPlayers]);

  const togglePlayer = (playerId: string) => {
    setError(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const selectedPlayers = candidateGuests.filter((p) => selectedIds.has(p.id));

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = mergedName.trim();
    if (!trimmed) {
      setError("Merged player name cannot be empty.");
      return;
    }

    if (selectedIds.size < 2) {
      setError("Please select at least 2 guest players to merge together.");
      return;
    }

    if (skipConfirmation) {
      void handleExecuteMerge();
    } else {
      setError(null);
      setIsConfirming(true);
    }
  };

  const handleExecuteMerge = async () => {
    const trimmed = mergedName.trim();
    if (!trimmed || selectedIds.size < 2) return;

    if (doNotAskAgain) {
      try {
        localStorage.setItem(SKIP_CONFIRM_KEY, "true");
        window.dispatchEvent(new Event("storage"));
      } catch {
        // localStorage not available
      }
    }

    setIsSaving(true);
    setError(null);

    // Pick targetPlayerId as guestPlayer.id if selected, else first selected id
    const targetPlayerId = selectedIds.has(guestPlayer.id)
      ? guestPlayer.id
      : [...selectedIds][0];
    const sourcePlayerIds = [...selectedIds].filter((id) => id !== targetPlayerId);

    try {
      const res = await mergeGuestPlayersAction({
        groupId,
        targetPlayerId,
        sourcePlayerIds,
        mergedName: trimmed,
        idempotencyKey: createIdempotencyKey("guest_merge"),
      });

      if (res.ok) {
        onMerged?.(res.data);
        onClose();
      } else {
        setError(res.error ?? "Failed to merge guest players.");
        setIsConfirming(false);
      }
    } catch {
      setError("An unexpected error occurred while merging guest players.");
      setIsConfirming(false);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCandidates = candidateGuests.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.trim().toLowerCase()),
  );

  const selectedPlayerNames = selectedPlayers.map((p) => p.name).join(", ");

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        if (!isSaving) onClose();
      }}
      size="md"
      role="dialog"
      title="Merge Guest Players"
      description="Combine 2 or more guest profiles, merge their session histories, and remove duplicate profiles."
    >
      {isConfirming ? (
        <div data-testid="merge-confirm-dialog" className="space-y-4 pt-1">
          <div className="rounded-xl border-2 border-black bg-amber-50 p-3 shadow-[2px_2px_0px_0px_#000]">
            <p
              data-testid="merge-confirm-message"
              className="text-sm font-black text-neutral-900"
            >
              Are you sure you want to merge these players together: {selectedPlayerNames}?
            </p>
            <p className="mt-1.5 text-xs font-semibold text-neutral-600">
              Their session attendance, match results, and round sits will be combined into &quot;{mergedName.trim()}&quot;. Duplicate guest entries will be removed.
            </p>
          </div>

          <label
            htmlFor={doNotAskId}
            className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-neutral-700"
          >
            <input
              id={doNotAskId}
              type="checkbox"
              data-testid="merge-do-not-ask-again"
              checked={doNotAskAgain}
              onChange={(e) => setDoNotAskAgain(e.target.checked)}
              className="h-4 w-4 rounded border-2 border-black accent-black cursor-pointer"
            />
            <span>Do not ask me again</span>
          </label>

          {error && (
            <p role="alert" className="text-xs font-bold text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              data-testid="merge-confirm-no"
              disabled={isSaving}
              onClick={() => setIsConfirming(false)}
              className="font-display text-xs uppercase tracking-wider"
            >
              No
            </Button>
            <Button
              type="button"
              variant="primary"
              data-testid="merge-confirm-yes"
              disabled={isSaving}
              onClick={handleExecuteMerge}
              className="font-display text-xs uppercase tracking-wider bg-[#ccff00] hover:bg-[#b8e600] text-black"
            >
              {isSaving ? "Merging…" : "Yes"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleOpenConfirm} data-testid="merge-guest-modal" className="space-y-4 pt-1">
          {/* Merged Name Field */}
          <div>
            <Label htmlFor={nameInputId} className="text-neutral-800 font-bold text-xs uppercase">
              Merged Player Name
            </Label>
            <Input
              id={nameInputId}
              type="text"
              required
              data-testid="merge-guest-name-input"
              value={mergedName}
              onChange={(e) => {
                setMergedName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. John Doe"
              maxLength={80}
              className="mt-1"
            />
            <p className="mt-1 text-[11px] font-semibold text-neutral-500">
              Auto-populated from one of the players. You can change this to any display name.
            </p>
          </div>

          {/* Select Guests */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={searchInputId} className="text-neutral-800 font-bold text-xs uppercase">
                Select Guests to Merge ({selectedIds.size} selected)
              </Label>
              {selectedIds.size < 2 && (
                <span className="text-[11px] font-bold text-amber-700">
                  Select at least 2 guests
                </span>
              )}
            </div>

            {candidateGuests.length > 5 && (
              <Input
                id={searchInputId}
                type="search"
                sizeVariant="sm"
                placeholder="Filter guest names…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="text-xs"
              />
            )}

            <div className="max-h-52 overflow-y-auto rounded-xl border-2 border-black bg-white p-1.5 shadow-[2px_2px_0px_0px_#000] space-y-1">
              {filteredCandidates.length === 0 ? (
                <p className="p-3 text-center text-xs font-semibold text-neutral-500">
                  No guest players found.
                </p>
              ) : (
                filteredCandidates.map((player) => {
                  const isChecked = selectedIds.has(player.id);
                  return (
                    <div
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? "border-black bg-[#fef08a]"
                          : "border-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      <label
                        className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePlayer(player.id)}
                          data-testid={`merge-checkbox-${player.id}`}
                          className="h-4 w-4 rounded border-2 border-black accent-black cursor-pointer shrink-0"
                        />
                        <span className="font-bold text-xs text-neutral-900 truncate">
                          {player.name}
                        </span>
                        {player.id === guestPlayer.id && (
                          <span className="rounded bg-black/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-neutral-700">
                            Current
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-neutral-500">
                          {formatDupr(player.rating)} · {player.ratedGamesPlayed}g
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-bold text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="font-display text-xs uppercase tracking-wider"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              data-testid="merge-guest-submit-button"
              disabled={isSaving || selectedIds.size < 2 || !mergedName.trim()}
              className="font-display text-xs uppercase tracking-wider bg-[#ccff00] hover:bg-[#b8e600] text-black"
            >
              {isSaving ? "Merging…" : "Merge Players"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
