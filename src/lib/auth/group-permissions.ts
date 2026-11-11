import {
  type GroupOrganizerPermissions,
  type GroupOrganizerPermissionKey,
  DEFAULT_GROUP_ORGANIZER_PERMISSIONS,
} from "@/lib/domain/types";

export interface PermissionDefinition {
  key: GroupOrganizerPermissionKey;
  label: string;
  description: string;
  defaultValue: boolean;
}

export const GROUP_ORGANIZER_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    key: "edit_group_name",
    label: "Edit group name",
    description: "Allows organizers to change the group's display name.",
    defaultValue: true,
  },
  {
    key: "edit_group_privacy",
    label: "Edit group privacy",
    description: "Allows organizers to switch the group between public and private.",
    defaultValue: true,
  },
  {
    key: "manage_organizers",
    label: "Manage organizers",
    description: "Allows organizers to assign or remove other organizers.",
    defaultValue: false,
  },
  {
    key: "delete_group",
    label: "Delete group",
    description: "Allows organizers to permanently delete the group.",
    defaultValue: false,
  },
] as const;

export function parseGroupOrganizerPermissions(val: unknown): GroupOrganizerPermissions {
  if (!val || typeof val !== "object") {
    return { ...DEFAULT_GROUP_ORGANIZER_PERMISSIONS };
  }
  const obj = typeof val === "string" ? safeJsonParse(val) : (val as Record<string, unknown>);
  return {
    edit_group_name:
      typeof obj.edit_group_name === "boolean"
        ? obj.edit_group_name
        : DEFAULT_GROUP_ORGANIZER_PERMISSIONS.edit_group_name,
    edit_group_privacy:
      typeof obj.edit_group_privacy === "boolean"
        ? obj.edit_group_privacy
        : DEFAULT_GROUP_ORGANIZER_PERMISSIONS.edit_group_privacy,
    manage_organizers:
      typeof obj.manage_organizers === "boolean"
        ? obj.manage_organizers
        : DEFAULT_GROUP_ORGANIZER_PERMISSIONS.manage_organizers,
    delete_group:
      typeof obj.delete_group === "boolean"
        ? obj.delete_group
        : DEFAULT_GROUP_ORGANIZER_PERMISSIONS.delete_group,
  };
}

function safeJsonParse(val: string): Record<string, unknown> {
  try {
    const res = JSON.parse(val);
    return typeof res === "object" && res !== null ? res : {};
  } catch {
    return {};
  }
}

export interface UserGroupPermissions {
  isHost: boolean;
  isOrganizer: boolean;
  canEditGroupName: boolean;
  canEditGroupPrivacy: boolean;
  canManageOrganizers: boolean;
  canDeleteGroup: boolean;
  canManagePermissions: boolean;
  organizerPermissions: GroupOrganizerPermissions;
}

export function evaluateGroupPermissions({
  isHost,
  isOrganizer,
  permissions,
}: {
  isHost: boolean;
  isOrganizer: boolean;
  permissions?: GroupOrganizerPermissions | null;
}): UserGroupPermissions {
  const perms = parseGroupOrganizerPermissions(permissions);
  if (isHost) {
    return {
      isHost: true,
      isOrganizer: true,
      canEditGroupName: true,
      canEditGroupPrivacy: true,
      canManageOrganizers: true,
      canDeleteGroup: true,
      canManagePermissions: true,
      organizerPermissions: perms,
    };
  }
  if (isOrganizer) {
    return {
      isHost: false,
      isOrganizer: true,
      canEditGroupName: perms.edit_group_name,
      canEditGroupPrivacy: perms.edit_group_privacy,
      canManageOrganizers: perms.manage_organizers,
      canDeleteGroup: perms.delete_group,
      canManagePermissions: false,
      organizerPermissions: perms,
    };
  }
  return {
    isHost: false,
    isOrganizer: false,
    canEditGroupName: false,
    canEditGroupPrivacy: false,
    canManageOrganizers: false,
    canDeleteGroup: false,
    canManagePermissions: false,
    organizerPermissions: perms,
  };
}

