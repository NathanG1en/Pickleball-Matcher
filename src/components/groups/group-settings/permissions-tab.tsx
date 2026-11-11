"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGroupPermissionsAction } from "@/app/actions/group-settings";
import {
  type GroupOrganizerPermissions,
  type GroupOrganizerPermissionKey,
} from "@/lib/domain/types";
import {
  GROUP_ORGANIZER_PERMISSION_DEFINITIONS,
  parseGroupOrganizerPermissions,
} from "@/lib/auth/group-permissions";
import { InfoIcon, LockIcon } from "@/components/ui/icons";

export interface PermissionsTabProps {
  groupId: string;
  isHost: boolean;
  initialPermissions?: GroupOrganizerPermissions | null;
  onSaved?: (newPermissions: GroupOrganizerPermissions) => void;
}

export function PermissionsTab({
  groupId,
  isHost,
  initialPermissions,
  onSaved,
}: PermissionsTabProps) {
  const router = useRouter();

  const parsedInitial = parseGroupOrganizerPermissions(initialPermissions);

  const [committedPermissions, setCommittedPermissions] = useState<GroupOrganizerPermissions>(parsedInitial);
  const [permissions, setPermissions] = useState<GroupOrganizerPermissions>(parsedInitial);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if any permission was changed
  const hasChanges = (
    permissions.edit_group_name !== committedPermissions.edit_group_name ||
    permissions.edit_group_privacy !== committedPermissions.edit_group_privacy ||
    permissions.manage_organizers !== committedPermissions.manage_organizers ||
    permissions.delete_group !== committedPermissions.delete_group
  );

  const handleToggle = (key: GroupOrganizerPermissionKey) => {
    if (!isHost || saving) return;
    setStatusMessage(null);
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || saving || !isHost) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      const result = await updateGroupPermissionsAction({
        groupId,
        permissions,
      });

      if (result.ok) {
        setCommittedPermissions({ ...permissions });
        setStatusMessage({ type: "success", text: "Organizer permissions saved successfully." });
        onSaved?.(permissions);
        router.refresh();
      } else {
        setStatusMessage({ type: "error", text: result.error ?? "Failed to save permissions." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "An error occurred while saving permissions." });
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
              <span>You have unsaved changes in Permissions.</span>
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

        {/* Header Notice */}
        <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-3 space-y-1">
          <div className="flex items-start gap-2">
            <InfoIcon className="h-4 w-4 mt-0.5 text-neutral-600 shrink-0" />
            <div className="text-xs text-neutral-700 leading-relaxed">
              {isHost ? (
                <>
                  <p className="font-bold text-black">
                    Configure what organizers are allowed to do.
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    As the group host, you always retain full administrative control regardless of these toggle states.
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-1.5 font-bold text-neutral-700">
                  <LockIcon className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                  <span>
                    Read-only view. These permissions are configured and managed by the group host.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Permission Controls List */}
        <div className="space-y-3">
          {GROUP_ORGANIZER_PERMISSION_DEFINITIONS.map((def) => {
            const isEnabled = permissions[def.key];
            const inputId = `permission-toggle-${def.key}`;

            return (
              <div
                key={def.key}
                className="flex items-start justify-between gap-4 p-3.5 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <label
                    htmlFor={inputId}
                    className="text-xs sm:text-sm font-black uppercase text-black block cursor-pointer select-none"
                  >
                    {def.label}
                  </label>
                  <p className="text-[11px] sm:text-xs font-medium text-neutral-600 leading-snug">
                    {def.description}
                  </p>
                </div>

                <div className="shrink-0 pt-0.5">
                  {isHost ? (
                    <button
                      type="button"
                      id={inputId}
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={def.label}
                      data-testid={`permission-toggle-${def.key}`}
                      onClick={() => handleToggle(def.key)}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-black transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? "bg-[#ccff00]" : "bg-neutral-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full border border-black bg-white shadow-[1px_1px_0px_0px_#000] transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  ) : (
                    <span
                      data-testid={`permission-status-${def.key}`}
                      className={`inline-flex items-center px-2 py-0.5 rounded-md border-2 border-black text-[10px] font-black uppercase tracking-wider ${
                        isEnabled
                          ? "bg-[#ccff00] text-black"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {isEnabled ? "Enabled" : "Disabled"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Save Button (Host Only) */}
      {isHost && (
        <div className="pt-4 border-t-2 border-black/10 flex justify-end">
          <button
            type="submit"
            disabled={!hasChanges || saving}
            data-testid="save-permissions-button"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] text-black font-display text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer"
          >
            {saving ? "Saving Permissions…" : "Save Permissions"}
          </button>
        </div>
      )}
    </form>
  );
}

