"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateGroupOrganizersAction } from "@/app/actions/group-organizers";
import type { GroupOrganizerRecord, PlayerRecord } from "@/lib/domain/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CrownIcon, SearchIcon, Trash2Icon, UserPlusIcon, XIcon } from "@/components/ui/icons";

export interface OrganizersTabProps {
  groupId: string;
  canManageOrganizers: boolean;
  players: readonly PlayerRecord[];
  organizers: readonly GroupOrganizerRecord[];
  onSaved?: () => void;
}

export function OrganizersTab({
  groupId,
  canManageOrganizers,
  players,
  organizers: initialOrganizers,
  onSaved,
}: OrganizersTabProps) {
  const router = useRouter();

  // Committed list of organizers
  const [currentOrganizers, setCurrentOrganizers] = useState(initialOrganizers);

  // Staged changes
  const [stagedAddAccountIds, setStagedAddAccountIds] = useState<Set<string>>(new Set());
  const [stagedRemoveAccountIds, setStagedRemoveAccountIds] = useState<Set<string>>(new Set());

  // Search query for candidate roster players
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Confirmation state for removing an organizer
  const [organizerToRemove, setOrganizerToRemove] = useState<GroupOrganizerRecord | null>(null);

  // Active organizers taking into account staged removals
  const displayOrganizers = useMemo(() => {
    return currentOrganizers.filter((o) => !stagedRemoveAccountIds.has(o.accountId));
  }, [currentOrganizers, stagedRemoveAccountIds]);

  // Candidates for becoming an organizer:
  // Active players in the group who have an accountId and are NOT in currentOrganizers (and not staged to be removed)
  const candidatePlayers = useMemo(() => {
    const existingOrganizerAccountIds = new Set(
      currentOrganizers
        .filter((o) => !stagedRemoveAccountIds.has(o.accountId))
        .map((o) => o.accountId),
    );

    return players.filter(
      (p) => Boolean(p.accountId) && p.active && !existingOrganizerAccountIds.has(p.accountId!),
    );
  }, [players, currentOrganizers, stagedRemoveAccountIds]);

  // Filtered candidate players based on search query
  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, "");
    if (!q) return candidatePlayers;
    return candidatePlayers.filter((p) => {
      const uName = p.username?.toLowerCase() ?? "";
      const name = p.name.toLowerCase();
      return name.includes(q) || uName.includes(q);
    });
  }, [candidatePlayers, searchQuery]);

  const hasChanges = stagedAddAccountIds.size > 0 || stagedRemoveAccountIds.size > 0;

  const handleToggleCandidate = (accountId: string) => {
    if (!canManageOrganizers) return;
    setStatusMessage(null);
    setStagedAddAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleStageRemove = (organizer: GroupOrganizerRecord) => {
    if (!canManageOrganizers) return;
    if (organizer.isHost) return; // Cannot remove host
    setOrganizerToRemove(organizer);
  };

  const handleConfirmRemove = () => {
    if (!organizerToRemove) return;
    const accountId = organizerToRemove.accountId;
    setStatusMessage(null);

    // If it was in stagedAddAccountIds, remove from stagedAdd
    if (stagedAddAccountIds.has(accountId)) {
      setStagedAddAccountIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    } else {
      // Stage removal
      setStagedRemoveAccountIds((prev) => {
        const next = new Set(prev);
        next.add(accountId);
        return next;
      });
    }

    setOrganizerToRemove(null);
  };

  const handleCancelStagedRemove = (accountId: string) => {
    setStagedRemoveAccountIds((prev) => {
      const next = new Set(prev);
      next.delete(accountId);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || saving || !canManageOrganizers) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      const result = await updateGroupOrganizersAction({
        groupId,
        addAccountIds: Array.from(stagedAddAccountIds),
        removeAccountIds: Array.from(stagedRemoveAccountIds),
      });

      if (result.ok) {
        // Rebuild current organizers
        const removedSet = stagedRemoveAccountIds;
        const addedSet = stagedAddAccountIds;

        const remaining = currentOrganizers.filter((o) => !removedSet.has(o.accountId));
        const newlyAdded: GroupOrganizerRecord[] = [];
        for (const accountId of addedSet) {
          const player = players.find((p) => p.accountId === accountId);
          if (player) {
            newlyAdded.push({
              accountId,
              name: player.name,
              username: player.username ?? "",
              isHost: false,
            });
          }
        }

        setCurrentOrganizers([...remaining, ...newlyAdded]);
        setStagedAddAccountIds(new Set());
        setStagedRemoveAccountIds(new Set());
        setStatusMessage({ type: "success", text: "Organizers updated successfully." });
        onSaved?.();
        router.refresh();
      } else {
        setStatusMessage({ type: "error", text: result.error ?? "Failed to update organizers." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "An error occurred while saving organizers." });
    } finally {
      setSaving(false);
    }
  };

  if (!canManageOrganizers) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border-2 border-black bg-neutral-100 text-neutral-800 text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
          You do not have permission to manage organizers for this group. Contact the group host to request access.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col justify-between h-full space-y-6">
      <div className="space-y-5">
        {/* Unsaved changes notice */}
        {hasChanges && (
          <div
            role="status"
            className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border-2 border-black text-amber-900 text-xs font-bold shadow-[2px_2px_0px_0px_#000]"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                Pending changes: {stagedAddAccountIds.size > 0 && `+${stagedAddAccountIds.size} to add `}
                {stagedRemoveAccountIds.size > 0 && `-${stagedRemoveAccountIds.size} to remove`}
              </span>
            </span>
          </div>
        )}

        {/* Status message */}
        {statusMessage && (
          <div
            role="alert"
            className={`p-3 rounded-xl border-2 border-black text-xs font-bold shadow-[2px_2px_0px_0px_#000] ${
              statusMessage.type === "success"
                ? "bg-[#ccff00] text-black"
                : "bg-red-100 text-red-900"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Section 1: Current Organizers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-black">
              Current Organizers ({displayOrganizers.length + stagedAddAccountIds.size})
            </h3>
            {stagedRemoveAccountIds.size > 0 && (
              <span className="text-[11px] font-bold text-red-600">
                ({stagedRemoveAccountIds.size} staged for removal)
              </span>
            )}
          </div>

          <div className="rounded-xl border-2 border-black bg-white divide-y-2 divide-neutral-100 shadow-[2px_2px_0px_0px_#000] max-h-56 overflow-y-auto">
            {displayOrganizers.map((org) => (
              <div
                key={org.accountId}
                className="flex items-center justify-between gap-3 p-3 hover:bg-neutral-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-black text-black truncate">{org.name}</span>
                    {org.username && (
                      <span className="text-xs font-bold text-neutral-500 truncate">
                        @{org.username}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {org.isHost ? (
                    <span
                      data-testid="organizer-host-badge"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border-2 border-black bg-[#fde047] text-[10px] font-black uppercase tracking-wider text-black shadow-[1px_1px_0px_0px_#000]"
                    >
                      <CrownIcon className="h-3 w-3 text-black" />
                      <span>Host</span>
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md border-2 border-black bg-[#bae6fd] text-[10px] font-black uppercase tracking-wider text-black">
                        Organizer
                      </span>
                      {canManageOrganizers && (
                        <button
                          type="button"
                          onClick={() => handleStageRemove(org)}
                          aria-label={`Remove ${org.name} as organizer`}
                          title="Remove organizer"
                          className="p-1 rounded-lg border-2 border-black bg-white hover:bg-red-50 text-red-600 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-all"
                        >
                          <Trash2Icon className="h-3.5 w-3.5 stroke-2" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Staged additions preview */}
            {Array.from(stagedAddAccountIds).map((accId) => {
              const p = players.find((pl) => pl.accountId === accId);
              if (!p) return null;
              return (
                <div
                  key={accId}
                  className="flex items-center justify-between gap-3 p-3 bg-lime-50/70 border-l-4 border-l-[#ccff00]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-black text-black truncate">{p.name}</span>
                      {p.username && (
                        <span className="text-xs font-bold text-neutral-500">@{p.username}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md border-2 border-black bg-[#ccff00] text-[10px] font-black uppercase tracking-wider text-black">
                      Staged Add
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleCandidate(accId)}
                      aria-label={`Cancel adding ${p.name}`}
                      className="p-1 rounded-lg border border-black bg-white hover:bg-neutral-100 text-neutral-600 cursor-pointer"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Staged removals notice with undo option */}
          {stagedRemoveAccountIds.size > 0 && (
            <div className="space-y-1 pt-1">
              {Array.from(stagedRemoveAccountIds).map((accId) => {
                const org = currentOrganizers.find((o) => o.accountId === accId);
                if (!org) return null;
                return (
                  <div
                    key={accId}
                    className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-900"
                  >
                    <span>Staged for removal: {org.name}</span>
                    <button
                      type="button"
                      onClick={() => handleCancelStagedRemove(accId)}
                      className="text-[11px] font-black uppercase underline hover:text-black cursor-pointer"
                    >
                      Undo
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Add Organizers via Bulk Selection */}
        <div className="space-y-2.5 pt-3 border-t-2 border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <UserPlusIcon className="h-4 w-4 text-black" />
              <h3 className="text-xs font-black uppercase tracking-wider text-black">
                Assign Organizers From Roster
              </h3>
            </div>
            {stagedAddAccountIds.size > 0 && (
              <span className="text-[11px] font-black text-black bg-[#ccff00] px-2 py-0.5 rounded-full border border-black">
                {stagedAddAccountIds.size} selected
              </span>
            )}
          </div>

          <p className="text-[11px] font-semibold text-neutral-600">
            Select one or more roster members with player accounts to give them organizer privileges.
          </p>

          {/* Candidate Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter roster by player name or @username..."
              aria-label="Filter roster players"
              className="w-full rounded-xl border-2 border-black bg-white pl-9 pr-3.5 py-2 text-xs font-bold text-black shadow-[2px_2px_0px_0px_#000] focus:outline-none placeholder:text-neutral-400"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear filter"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black font-black text-sm cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Candidates List */}
          <div className="rounded-xl border-2 border-black bg-[#FFFDF7] p-2 max-h-48 overflow-y-auto space-y-1 shadow-[2px_2px_0px_0px_#000]">
            {filteredCandidates.length === 0 ? (
              <p className="p-3 text-center text-xs font-bold text-neutral-500">
                {candidatePlayers.length === 0
                  ? "All eligible account players are already organizers."
                  : `No eligible players matching "${searchQuery}".`}
              </p>
            ) : (
              filteredCandidates.map((player) => {
                if (!player.accountId) return null;
                const isChecked = stagedAddAccountIds.has(player.accountId);
                return (
                  <label
                    key={player.id}
                    className={`flex items-center justify-between gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-[#ccff00]/30 border-black"
                        : "bg-white border-neutral-200 hover:border-black"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCandidate(player.accountId!)}
                        className="h-4 w-4 rounded border-2 border-black accent-black cursor-pointer"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-black text-black truncate block">
                          {player.name}
                        </span>
                        {player.username && (
                          <span className="text-[11px] font-bold text-neutral-500 truncate block">
                            @{player.username}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase text-neutral-500">
                      {isChecked ? "Selected" : "Select"}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Tab Save Button */}
      <div className="pt-4 border-t-2 border-black/10 flex justify-end">
        <button
          type="submit"
          disabled={!hasChanges || saving || !canManageOrganizers}
          data-testid="save-organizers-button"
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] text-black font-display text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer"
        >
          {saving ? "Saving Changes…" : "Save Changes"}
        </button>
      </div>

      {/* Remove Organizer Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(organizerToRemove)}
        onClose={() => setOrganizerToRemove(null)}
        onConfirm={handleConfirmRemove}
        title="Remove Organizer"
        description={
          organizerToRemove
            ? `Are you sure you want to remove "${organizerToRemove.name}" (@${organizerToRemove.username}) as an organizer? They will return to being a regular group member.`
            : ""
        }
        confirmText="Remove"
        cancelText="Cancel"
        confirmVariant="danger"
        confirmDataTestId="confirm-remove-organizer-button"
      />
    </form>
  );
}
