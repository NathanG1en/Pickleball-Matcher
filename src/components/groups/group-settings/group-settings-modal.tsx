"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type {
  GroupOrganizerRecord,
  GroupOrganizerPermissions,
  PlayerRecord,
} from "@/lib/domain/types";
import { evaluateGroupPermissions } from "@/lib/auth/group-permissions";
import { GeneralTab } from "./general-tab";
import { OrganizersTab } from "./organizers-tab";
import { PermissionsTab } from "./permissions-tab";
import { DangerZoneTab } from "./danger-zone-tab";

export type GroupSettingsTabId = "general" | "organizers" | "permissions" | "danger";

export interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  initialGroupName: string;
  initialIsPublic: boolean;
  isHost: boolean;
  isOrganizer: boolean;
  isAccountOrganizer?: boolean;
  organizerPermissions?: GroupOrganizerPermissions | null;
  players: readonly PlayerRecord[];
  organizers: readonly GroupOrganizerRecord[];
  initialTab?: GroupSettingsTabId;
}

export function GroupSettingsModal({
  isOpen,
  onClose,
  groupId,
  initialGroupName,
  initialIsPublic,
  isHost,
  isOrganizer,
  isAccountOrganizer = false,
  organizerPermissions: rawPermissions,
  players,
  organizers,
  initialTab = "general",
}: GroupSettingsModalProps) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;

  // Dynamic state for live title and privacy in case General tab saves
  const [currentName, setCurrentName] = useState(initialGroupName);
  const [currentIsPublic, setCurrentIsPublic] = useState(initialIsPublic);
  const [currentPermissions, setCurrentPermissions] = useState<GroupOrganizerPermissions | undefined>(
    rawPermissions ?? undefined,
  );

  // Evaluate user's active permissions
  const permissions = useMemo(() => {
    return evaluateGroupPermissions({
      isHost,
      isOrganizer,
      permissions: currentPermissions,
    });
  }, [isHost, isOrganizer, currentPermissions]);

  // Determine which tabs are accessible
  const availableTabs = useMemo(() => {
    const tabs: { id: GroupSettingsTabId; label: string }[] = [];

    // General tab: accessible if host or organizer
    tabs.push({ id: "general", label: "General" });

    // Organizers tab: host always, organizer only if manage_organizers is enabled
    if (permissions.canManageOrganizers) {
      tabs.push({ id: "organizers", label: "Organizers" });
    }

    // Permissions tab: accessible by host and organizers (read-only for organizers)
    tabs.push({ id: "permissions", label: "Permissions" });

    // Danger Zone tab: accessible only if delete_group is enabled (or host)
    if (permissions.canDeleteGroup) {
      tabs.push({ id: "danger", label: "Danger Zone" });
    }

    return tabs;
  }, [permissions]);

  const [selectedTab, setSelectedTab] = useState<GroupSettingsTabId>(initialTab);
  const activeTab = availableTabs.some((t) => t.id === selectedTab)
    ? selectedTab
    : availableTabs[0]?.id ?? "general";
  const setActiveTab = setSelectedTab;

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl border-[3px] border-black bg-[#FFFDF7] text-black shadow-[8px_8px_0px_0px_#000] overflow-hidden"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b-[2.5px] border-black px-6 py-4 sm:px-7 sm:py-5 bg-[#FFFDF7] shrink-0">
          <div>
            <h2
              id={titleId}
              className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight text-black"
            >
              Group Settings
            </h2>
            <p className="text-xs font-bold text-neutral-600 truncate max-w-md">
              {currentName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings dialog"
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white text-lg font-black leading-none hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-colors"
          >
            ×
          </button>
        </div>

        {/* Fixed Tab Navigation */}
        <div className="border-b-2 border-black bg-neutral-100/70 px-6 py-2 sm:px-7 shrink-0 overflow-x-auto no-scrollbar">
          <nav
            role="tablist"
            aria-label="Group settings sections"
            className="flex items-center gap-2 min-w-max"
          >
            {availableTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const isDanger = tab.id === "danger";

              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`settings-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`settings-tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`settings-tab-${tab.id}`}
                  className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? isDanger
                        ? "bg-[#E32929] text-white border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                        : "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                      : isDanger
                      ? "text-red-700 hover:bg-red-100 border-2 border-transparent"
                      : "text-neutral-700 hover:text-black hover:bg-neutral-200 border-2 border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7">
          {/* General Tab */}
          <div
            role="tabpanel"
            id="settings-tabpanel-general"
            aria-labelledby="settings-tab-general"
            className={activeTab === "general" ? "block" : "hidden"}
          >
            <GeneralTab
              groupId={groupId}
              initialName={currentName}
              initialIsPublic={currentIsPublic}
              canEditGroupName={permissions.canEditGroupName}
              canEditGroupPrivacy={permissions.canEditGroupPrivacy}
              onSaved={(newName, newIsPublic) => {
                setCurrentName(newName);
                setCurrentIsPublic(newIsPublic);
              }}
            />
          </div>

          {/* Organizers Tab */}
          {permissions.canManageOrganizers && (
            <div
              role="tabpanel"
              id="settings-tabpanel-organizers"
              aria-labelledby="settings-tab-organizers"
              className={activeTab === "organizers" ? "block" : "hidden"}
            >
              <OrganizersTab
                groupId={groupId}
                canManageOrganizers={permissions.canManageOrganizers}
                players={players}
                organizers={organizers}
              />
            </div>
          )}

          {/* Permissions Tab */}
          <div
            role="tabpanel"
            id="settings-tabpanel-permissions"
            aria-labelledby="settings-tab-permissions"
            className={activeTab === "permissions" ? "block" : "hidden"}
          >
            <PermissionsTab
              groupId={groupId}
              isHost={isHost}
              initialPermissions={currentPermissions}
              onSaved={(newPerms) => {
                setCurrentPermissions(newPerms);
              }}
            />
          </div>

          {/* Danger Zone Tab */}
          {permissions.canDeleteGroup && (
            <div
              role="tabpanel"
              id="settings-tabpanel-danger"
              aria-labelledby="settings-tab-danger"
              className={activeTab === "danger" ? "block" : "hidden"}
            >
              <DangerZoneTab
                groupId={groupId}
                groupName={currentName}
                canDeleteGroup={permissions.canDeleteGroup}
                isAccountOrganizer={isAccountOrganizer}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
