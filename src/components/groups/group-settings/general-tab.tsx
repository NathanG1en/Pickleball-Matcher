"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGroupNameAction, updateGroupVisibilityAction } from "@/app/actions/group-settings";
import { CheckIcon, CopyIcon, InfoIcon } from "@/components/ui/icons";

export interface GeneralTabProps {
  groupId: string;
  initialName: string;
  initialIsPublic: boolean;
  canEditGroupName: boolean;
  canEditGroupPrivacy: boolean;
  onSaved?: (newName: string, newIsPublic: boolean) => void;
}

export function GeneralTab({
  groupId,
  initialName,
  initialIsPublic,
  canEditGroupName,
  canEditGroupPrivacy,
  onSaved,
}: GeneralTabProps) {
  const router = useRouter();

  // Baseline committed values
  const [committedName, setCommittedName] = useState(initialName);
  const [committedIsPublic, setCommittedIsPublic] = useState(initialIsPublic);

  // Local form state
  const [name, setName] = useState(initialName);
  const [isPublic, setIsPublic] = useState(initialIsPublic);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const isNameChanged = name.trim() !== committedName.trim();
  const isPrivacyChanged = isPublic !== committedIsPublic;
  const hasChanges = (canEditGroupName && isNameChanged) || (canEditGroupPrivacy && isPrivacyChanged);

  const handleCopyGroupId = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(groupId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore clipboard write failures
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || saving) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      const trimmedName = name.trim();

      // If name changed
      if (canEditGroupName && trimmedName !== committedName.trim()) {
        const nameRes = await updateGroupNameAction({ groupId, name: trimmedName });
        if (!nameRes.ok) {
          setStatusMessage({ type: "error", text: nameRes.error ?? "Failed to update group name." });
          setSaving(false);
          return;
        }
      }

      // If privacy changed
      if (canEditGroupPrivacy && isPublic !== committedIsPublic) {
        const privRes = await updateGroupVisibilityAction({ groupId, isPublic });
        if (!privRes.ok) {
          setStatusMessage({ type: "error", text: privRes.error ?? "Failed to update group privacy." });
          setSaving(false);
          return;
        }
      }

      setCommittedName(trimmedName);
      setCommittedIsPublic(isPublic);
      setStatusMessage({ type: "success", text: "General settings saved successfully." });
      onSaved?.(trimmedName, isPublic);
      router.refresh();
    } catch {
      setStatusMessage({ type: "error", text: "An error occurred while saving." });
    } finally {
      setSaving(false);
    }
  };

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
              <span>You have unsaved changes in General settings.</span>
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

        {/* Group Name Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="group-settings-name"
            className="block text-xs font-black uppercase tracking-wider text-black"
          >
            Group Name
          </label>
          <input
            id="group-settings-name"
            type="text"
            required
            maxLength={80}
            disabled={!canEditGroupName || saving}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (statusMessage) setStatusMessage(null);
            }}
            placeholder="Enter group name"
            className="w-full rounded-xl border-2 border-black bg-white px-3.5 py-2.5 text-sm font-bold text-black shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed transition-shadow"
          />
          {!canEditGroupName && (
            <p className="text-[11px] font-semibold text-neutral-500">
              Only authorized organizers or the host can edit the group name.
            </p>
          )}
        </div>

        {/* Group Privacy Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-black uppercase tracking-wider text-black">
              Group Privacy
            </span>
            <span className="text-[11px] font-bold text-neutral-600">
              Currently: {isPublic ? "Public" : "Private"}
            </span>
          </div>

          <div
            role="group"
            aria-label="Group privacy option"
            className="inline-flex w-full items-center rounded-xl border-2 border-black bg-neutral-100 p-1 shadow-[2px_2px_0px_0px_#000]"
          >
            <button
              type="button"
              disabled={!canEditGroupPrivacy || saving}
              onClick={() => {
                setIsPublic(true);
                if (statusMessage) setStatusMessage(null);
              }}
              aria-pressed={isPublic}
              data-testid="group-settings-privacy-public-button"
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed ${
                isPublic
                  ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                  : "border-2 border-transparent text-neutral-600 hover:text-black hover:bg-black/5"
              }`}
            >
              Public
            </button>
            <button
              type="button"
              disabled={!canEditGroupPrivacy || saving}
              onClick={() => {
                setIsPublic(false);
                if (statusMessage) setStatusMessage(null);
              }}
              aria-pressed={!isPublic}
              data-testid="group-settings-privacy-private-button"
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed ${
                !isPublic
                  ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                  : "border-2 border-transparent text-neutral-600 hover:text-black hover:bg-black/5"
              }`}
            >
              Private
            </button>
          </div>

          {/* Privacy explanation banner */}
          <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-2.5 text-xs text-neutral-700 space-y-1">
            <div className="flex items-start gap-1.5">
              <InfoIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-neutral-500" />
              <div className="space-y-0.5 text-[11px] font-medium leading-relaxed">
                <p>
                  <strong className="font-black text-black">Public:</strong> Anyone can discover and join this group through group search.
                </p>
                <p>
                  <strong className="font-black text-black">Private:</strong> Hidden from public search. Players can only join via direct invite link.
                </p>
              </div>
            </div>
          </div>

          {!canEditGroupPrivacy && (
            <p className="text-[11px] font-semibold text-neutral-500">
              Only authorized organizers or the host can change group privacy.
            </p>
          )}
        </div>

        {/* Group ID Field (Read-only with Copy) */}
        <div className="space-y-1.5 pt-2 border-t-2 border-neutral-200">
          <label
            htmlFor="group-settings-id"
            className="block text-xs font-black uppercase tracking-wider text-black"
          >
            Group ID
          </label>
          <div className="flex items-center gap-2">
            <input
              id="group-settings-id"
              type="text"
              readOnly
              value={groupId}
              aria-label="Group ID"
              className="flex-1 min-w-0 rounded-xl border-2 border-black bg-neutral-100 px-3.5 py-2 font-mono text-xs font-bold text-neutral-800 shadow-[2px_2px_0px_0px_#000] focus:outline-none select-all"
            />
            <button
              type="button"
              onClick={handleCopyGroupId}
              aria-label="Copy Group ID"
              data-testid="copy-group-id-button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-black bg-white hover:bg-[#ccff00] text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-black" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <CopyIcon className="h-3.5 w-3.5 text-black" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] font-semibold text-neutral-500">
            This identifier uniquely identifies your group in links and URLs.
          </p>
        </div>
      </div>

      {/* Tab Save Button */}
      <div className="pt-4 border-t-2 border-black/10 flex justify-end">
        <button
          type="submit"
          disabled={!hasChanges || saving}
          data-testid="save-general-settings-button"
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] text-black font-display text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer"
        >
          {saving ? "Saving Changes…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

