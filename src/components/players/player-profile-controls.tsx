"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkUsernameAvailabilityAction,
  leavePublicGroupAction,
  playerLogoutAction,
  updatePlayerProfileAction,
  updatePlayerUsernameAction,
} from "@/app/actions/player-account";
import { updatePlayerPrivacyAction } from "@/app/actions/players";
import { clearRecentGroups, removeRecentGroup } from "@/lib/storage/recent-groups";
import { eloToDupr, formatDupr, getSkillTier } from "@/lib/domain/rating-display";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toast } from "@/components/ui/toast";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { LockIcon, GlobeIcon, InfoIcon, UsersIcon, ChevronDownIcon } from "@/components/ui/icons";
import { useTooltipPosition } from "@/components/ui/use-tooltip-position";
import { AccountOptionsMenu } from "@/components/players/account-options-menu";
import type { ProfileVisibilityLevel, ProfileVisibilitySettings } from "@/lib/domain/types";
import { parseProfileVisibilitySettings } from "@/lib/privacy/profile-visibility";

export { AccountOptionsMenu };

const PORTION_CONFIGS: {
  key: keyof ProfileVisibilitySettings;
  label: string;
  description: string;
}[] = [
  {
    key: "profile",
    label: "Profile Page",
    description: "Controls your general profile page and discoverability in search.",
  },
  {
    key: "activities",
    label: "Activities & Past Sessions",
    description: "Controls who can see your past session history and match results.",
  },
  {
    key: "ratingStats",
    label: "Rating & Stats",
    description: "Controls who can see your DUPR rating, skill tier, win/loss record, and rating chart.",
  },
  {
    key: "chemistry",
    label: "Chemistry Spotlight",
    description: "Controls who can see your best partner chemistry and synergy scores.",
  },
  {
    key: "groups",
    label: "Groups",
    description: "Controls who can see the groups and clubs you have joined.",
  },
];

const VISIBILITY_LEVEL_OPTIONS: {
  value: ProfileVisibilityLevel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "everyone", label: "Everyone", icon: GlobeIcon },
  { value: "group_members", label: "Group Members", icon: UsersIcon },
  { value: "only_you", label: "Only You", icon: LockIcon },
];

export function PlayerProfileHeader({
  backButton,
  initialName,
  initialUsername,
  initialGender,
  initialRating,
  currentRating,
  rating,
  initialIsPublic = true,
  initialVisibilitySettings,
  initialEditing = false,
  initialPrivacySectionOpen = true,
  initialOpenDrawers = {},
}: {
  backButton?: React.ReactNode;
  initialName: string;
  initialUsername: string;
  initialGender?: "male" | "female" | null;
  skillLevel?: string;
  initialRating?: number;
  currentRating?: number;
  rating?: number;
  initialIsPublic?: boolean;
  initialVisibilitySettings?: ProfileVisibilitySettings;
  initialEditing?: boolean;
  initialPrivacySectionOpen?: boolean;
  initialOpenDrawers?: Record<string, boolean>;
}) {
  const displayRating = currentRating ?? rating ?? initialRating ?? 1000;
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(initialEditing);
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [gender, setGender] = useState<"male" | "female" | null | undefined>(initialGender);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [visibilitySettings, setVisibilitySettings] = useState<ProfileVisibilitySettings>(
    () => parseProfileVisibilitySettings(initialVisibilitySettings, initialIsPublic),
  );

  // Edit form state
  const [nameInput, setNameInput] = useState(initialName);
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [genderInput, setGenderInput] = useState<"male" | "female">(
    initialGender === "female" ? "female" : "male",
  );
  const [isPublicInput, setIsPublicInput] = useState(initialIsPublic);
  const [visibilityInput, setVisibilityInput] = useState<ProfileVisibilitySettings>(
    () => parseProfileVisibilitySettings(initialVisibilitySettings, initialIsPublic),
  );
  const [isPrivacySectionOpen, setIsPrivacySectionOpen] = useState(initialPrivacySectionOpen);
  const [openDrawers, setOpenDrawers] = useState<Record<string, boolean>>(initialOpenDrawers);

  const [availability, setAvailability] = useState<{ query: string; available: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showPrivacyTooltip, setShowPrivacyTooltip] = useState(false);
  const {
    triggerRef: privacyTriggerRef,
    tooltipRef: privacyTooltipRef,
    style: privacyTooltipStyle,
  } = useTooltipPosition(showPrivacyTooltip, () => setShowPrivacyTooltip(false));

  const cleanUsernameInput = usernameInput.replace(/^@/, "").trim().toLowerCase();
  const isUsernameTaken =
    isEditing &&
    Boolean(cleanUsernameInput) &&
    cleanUsernameInput !== username.toLowerCase() &&
    availability?.query === cleanUsernameInput &&
    !availability.available;

  useEffect(() => {
    if (!isEditing) return;
    const clean = usernameInput.replace(/^@/, "").trim().toLowerCase();
    if (!clean || clean === username.toLowerCase()) {
      return;
    }
    let cancelled = false;
    checkUsernameAvailabilityAction(clean)
      .then((result) => {
        if (!cancelled) {
          setAvailability({ query: clean, available: result.available });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability({ query: clean, available: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [usernameInput, isEditing, username]);

  const toggleDrawer = (key: string) => {
    setOpenDrawers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleEnterEditMode = () => {
    setNameInput(name);
    setUsernameInput(username);
    setGenderInput(gender === "female" ? "female" : "male");
    setIsPublicInput(isPublic);
    setVisibilityInput(visibilitySettings);
    setIsPrivacySectionOpen(true);
    setOpenDrawers({});
    setSaveError(null);
    setAvailability(null);
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    const hasChanges =
      nameInput.trim() !== name.trim() ||
      cleanUsernameInput !== username.toLowerCase() ||
      genderInput !== (gender ?? "male") ||
      isPublicInput !== isPublic ||
      visibilityInput.profile !== visibilitySettings.profile ||
      visibilityInput.activities !== visibilitySettings.activities ||
      visibilityInput.ratingStats !== visibilitySettings.ratingStats ||
      visibilityInput.chemistry !== visibilitySettings.chemistry ||
      visibilityInput.groups !== visibilitySettings.groups;

    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      handleDiscard();
    }
  };

  const handleDiscard = () => {
    setNameInput(name);
    setUsernameInput(username);
    setGenderInput(gender === "female" ? "female" : "male");
    setIsPublicInput(isPublic);
    setVisibilityInput(visibilitySettings);
    setIsPrivacySectionOpen(true);
    setOpenDrawers({});
    setSaveError(null);
    setAvailability(null);
    setShowDiscardConfirm(false);
    setIsEditing(false);
  };

  const trimmedName = nameInput.trim();
  const isFormValid =
    Boolean(trimmedName) &&
    trimmedName.length <= 80 &&
    Boolean(cleanUsernameInput) &&
    cleanUsernameInput.length >= 3 &&
    cleanUsernameInput.length <= 24 &&
    /^[A-Za-z0-9_]+$/.test(cleanUsernameInput) &&
    !isUsernameTaken;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    if (!trimmedName) {
      setSaveError("Display name is required.");
      return;
    }

    if (
      !cleanUsernameInput ||
      cleanUsernameInput.length < 3 ||
      cleanUsernameInput.length > 24 ||
      !/^[A-Za-z0-9_]+$/.test(cleanUsernameInput)
    ) {
      setSaveError("Username must be 3 to 24 letters, numbers, or underscores.");
      return;
    }

    if (isUsernameTaken) {
      setSaveError("That username is already taken.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const nameChanged = trimmedName !== name;
      const genderChanged = genderInput !== gender;
      if (nameChanged || genderChanged) {
        const profileRes = await updatePlayerProfileAction({
          name: trimmedName,
          gender: genderInput,
        });
        if (!profileRes.ok) {
          setSaveError(profileRes.error ?? "Failed to update profile.");
          setSaving(false);
          return;
        }
      }

      const usernameChanged = cleanUsernameInput !== username.toLowerCase();
      if (usernameChanged) {
        const usernameRes = await updatePlayerUsernameAction({ username: cleanUsernameInput });
        if (!usernameRes.ok) {
          setSaveError(usernameRes.error ?? "Failed to update username.");
          if (usernameRes.error?.toLowerCase().includes("taken")) {
            setAvailability({ query: cleanUsernameInput, available: false });
          }
          setSaving(false);
          return;
        }
      }

      const visibilityChanged =
        isPublicInput !== isPublic ||
        visibilityInput.profile !== visibilitySettings.profile ||
        visibilityInput.activities !== visibilitySettings.activities ||
        visibilityInput.ratingStats !== visibilitySettings.ratingStats ||
        visibilityInput.chemistry !== visibilitySettings.chemistry ||
        visibilityInput.groups !== visibilitySettings.groups;

      if (visibilityChanged) {
        const targetIsPublic = visibilityInput.profile !== "only_you";
        const privacyRes = await updatePlayerPrivacyAction({
          isPublic: targetIsPublic,
          visibilitySettings: visibilityInput,
        });
        if (!privacyRes.ok) {
          setSaveError(privacyRes.error ?? "Failed to update privacy setting.");
          setSaving(false);
          return;
        }
      }

      setName(trimmedName);
      setUsername(cleanUsernameInput);
      setGender(genderInput);
      setIsPublic(visibilityInput.profile !== "only_you");
      setVisibilitySettings(visibilityInput);
      setIsEditing(false);
      setToastMessage("Profile updated successfully");
      if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage(null);
        toastTimeoutRef.current = null;
      }, 3000);

      if (usernameChanged && typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        if (currentPath.includes("/players/")) {
          router.replace(`/players/${encodeURIComponent(cleanUsernameInput)}`);
        } else {
          router.refresh();
        }
      } else {
        router.refresh();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 flex-1 space-y-3">
      {/* Top Header Bar: Back Button & Actions */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">{backButton}</div>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={saving}
                data-testid="cancel-edit-profile-button"
                className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isFormValid}
                data-testid="save-profile-button"
                className="rounded-xl border-2 border-black bg-[#ccff00] px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleEnterEditMode}
                data-testid="edit-profile-button"
                className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Edit Profile
              </button>
              <AccountOptionsMenu />
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        /* Edit Mode View */
        <form onSubmit={handleSave} className="space-y-4 pt-1">
          <div className="flex items-center justify-between border-b-2 border-neutral-200 pb-2">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
              General
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Display Name */}
            <div className="space-y-1">
              <label
                htmlFor="profile-name-input"
                className="block text-xs font-black uppercase tracking-wider text-neutral-700"
              >
                Display Name
              </label>
              <input
                id="profile-name-input"
                aria-label="Display name"
                required
                maxLength={80}
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                autoFocus
              />
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label
                htmlFor="profile-username-input"
                className="block text-xs font-black uppercase tracking-wider text-neutral-700"
              >
                Username
              </label>
              <div className="relative w-full">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-500">
                  @
                </span>
                <input
                  id="profile-username-input"
                  aria-label="Username"
                  required
                  minLength={3}
                  maxLength={24}
                  value={usernameInput}
                  onChange={(event) => {
                    const val = event.target.value.replace(/^@/, "");
                    setUsernameInput(val);
                  }}
                  aria-invalid={isUsernameTaken}
                  className={`w-full rounded-xl pl-7 pr-3 py-2 text-sm font-bold focus:outline-none ${
                    isUsernameTaken
                      ? "border-2 border-red-600 bg-red-50 text-red-900"
                      : "border-2 border-black bg-white text-black focus:ring-2 focus:ring-black"
                  }`}
                />
              </div>
              {isUsernameTaken && (
                <p role="alert" className="text-xs font-bold text-red-600">
                  username taken
                </p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <label
                htmlFor="profile-gender-input"
                className="block text-xs font-black uppercase tracking-wider text-neutral-700"
              >
                Gender
              </label>
              <CustomDropdown
                id="profile-gender-input"
                ariaLabel="Gender"
                value={genderInput}
                onChange={(val) => setGenderInput(val as "male" | "female")}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
                sizeVariant="sm"
              />
            </div>

            {/* Visibility */}
            <div className="space-y-1">
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-700">
                Account Visibility
              </label>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !isPublicInput;
                    setIsPublicInput(nextVal);
                    setVisibilityInput((prev) => ({
                      ...prev,
                      profile: nextVal ? "everyone" : "only_you",
                    }));
                  }}
                  aria-label={`Account visibility: currently ${isPublicInput ? "Public" : "Private"}. Click to switch.`}
                  title={isPublicInput ? "Click to switch to Private" : "Click to switch to Public"}
                  className={`inline-flex items-center gap-1.5 rounded-full border-2 border-black ${
                    isPublicInput ? "bg-[#ccff00]" : "bg-neutral-200"
                  } px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black shadow-[1.5px_1.5px_0px_0px_#000] hover:opacity-90 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer`}
                >
                  {isPublicInput ? (
                    <>
                      <GlobeIcon className="h-3 w-3 shrink-0" />
                      <span>Public</span>
                    </>
                  ) : (
                    <>
                      <LockIcon className="h-3 w-3 shrink-0" />
                      <span>Private</span>
                    </>
                  )}
                </button>

                <div
                  className="relative inline-flex items-center"
                  onMouseEnter={() => setShowPrivacyTooltip(true)}
                  onMouseLeave={() => setShowPrivacyTooltip(false)}
                >
                  <button
                    ref={privacyTriggerRef}
                    type="button"
                    onClick={() => setShowPrivacyTooltip((prev) => !prev)}
                    onFocus={() => setShowPrivacyTooltip(true)}
                    onBlur={() => setShowPrivacyTooltip(false)}
                    aria-label="Account visibility details"
                    title="Account visibility details"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-black transition-all cursor-pointer"
                  >
                    <InfoIcon className="h-2.5 w-2.5" />
                  </button>

                  {showPrivacyTooltip && (
                    <>
                      <div
                        className="fixed inset-0 z-40 sm:hidden"
                        onClick={() => setShowPrivacyTooltip(false)}
                        aria-hidden="true"
                      />
                      <div
                        ref={privacyTooltipRef}
                        role="tooltip"
                        style={privacyTooltipStyle}
                        className="absolute left-0 sm:left-7 top-7 sm:top-1/2 sm:-translate-y-1/2 z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border-2 border-black bg-white p-3 text-left text-black tooltip-animate"
                      >
                        <div className="space-y-1.5 text-xs">
                          <p className="font-bold leading-snug">
                            <span className="font-black text-black uppercase">Public:</span>{" "}
                            <span className="text-neutral-700">
                              Your profile and stats are discoverable by @username search.
                            </span>
                          </p>
                          <p className="font-bold leading-snug">
                            <span className="font-black text-black uppercase">Private:</span>{" "}
                            <span className="text-neutral-700">
                              Your profile is private; stats are hidden from public search.
                            </span>
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Controls · Granular portion visibility drawers */}
          <div className="pt-3 border-t-2 border-neutral-200 space-y-3" data-testid="privacy-controls-section">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsPrivacySectionOpen((prev: boolean) => !prev)}
                aria-expanded={isPrivacySectionOpen}
                aria-controls="privacy-controls-content"
                data-testid="toggle-privacy-section"
                className="group flex w-full items-center justify-between rounded-xl px-1 py-1 text-left transition hover:bg-neutral-100 cursor-pointer"
              >
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">
                  Privacy Controls
                </h3>
                <span className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 group-hover:text-black">
                  <span>{isPrivacySectionOpen ? "Minimize" : "Expand"}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 transition-transform duration-200 ${
                      isPrivacySectionOpen ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </button>
            </div>

            {isPrivacySectionOpen && (
              <div id="privacy-controls-content" className="space-y-2.5">
                {PORTION_CONFIGS.map((portion) => {
                  const isOpen = Boolean(openDrawers[portion.key]);
                  const currentSelected =
                    VISIBILITY_LEVEL_OPTIONS.find(
                      (opt) => opt.value === visibilityInput[portion.key],
                    ) ?? VISIBILITY_LEVEL_OPTIONS[0];
                  const CurrentIcon = currentSelected.icon;

                  return (
                    <div
                      key={portion.key}
                      data-testid={`portion-visibility-${portion.key}`}
                      className="rounded-2xl border-2 border-black bg-white overflow-hidden transition-all shadow-[2px_2px_0px_0px_#000]"
                    >
                      {/* Drawer Toggle Header */}
                      <button
                        type="button"
                        onClick={() => toggleDrawer(portion.key)}
                        aria-expanded={isOpen}
                        aria-controls={`drawer-content-${portion.key}`}
                        data-testid={`toggle-drawer-${portion.key}`}
                        className="flex w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-neutral-50 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-black uppercase text-black">
                            {portion.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 rounded-full border border-black/30 bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-700">
                            <CurrentIcon className="h-3 w-3 shrink-0" />
                            <span>{currentSelected.label}</span>
                          </span>
                          <ChevronDownIcon
                            className={`h-4 w-4 text-neutral-500 transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {/* Drawer Content */}
                      {isOpen && (
                        <div
                          id={`drawer-content-${portion.key}`}
                          className="border-t-2 border-neutral-100 bg-neutral-50/60 p-3 space-y-2.5"
                        >
                          <p className="text-[11px] font-semibold text-neutral-600">
                            {portion.description}
                          </p>
                          <div
                            className="flex flex-wrap gap-1.5"
                            role="radiogroup"
                            aria-label={`${portion.label} visibility`}
                          >
                            {VISIBILITY_LEVEL_OPTIONS.map((opt) => {
                              const isSelected = visibilityInput[portion.key] === opt.value;
                              const Icon = opt.icon;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  aria-label={`${portion.label}: ${opt.label}`}
                                  data-testid={`${portion.key}-visibility-${opt.value}`}
                                  onClick={() => {
                                    const next = { ...visibilityInput, [portion.key]: opt.value };
                                    setVisibilityInput(next);
                                    if (portion.key === "profile") {
                                      setIsPublicInput(opt.value !== "only_you");
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1.5 rounded-xl border-2 border-black px-2.5 py-1 text-xs font-bold uppercase transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-[#ccff00] text-black shadow-[1.5px_1.5px_0px_0px_#000]"
                                      : "bg-white text-neutral-600 hover:bg-neutral-100"
                                  }`}
                                >
                                  <Icon className="h-3 w-3 shrink-0" />
                                  <span>{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {saveError && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-red-100 border border-red-500 text-red-800 text-xs font-bold"
            >
              {saveError}
            </div>
          )}

          <div className="pt-2 border-t-2 border-neutral-100">
            <p className="text-xs font-bold uppercase text-neutral-600">
              {getSkillTier(eloToDupr(displayRating)).name} · current rating {formatDupr(displayRating)}
            </p>
          </div>
        </form>
      ) : (
        /* View Mode */
        <div className="space-y-2">
          <div className="space-y-0.5">
            <h1 className="font-display text-3xl font-black uppercase truncate text-black">
              {name}
            </h1>
            <p className="text-sm font-bold text-neutral-600">@{username}</p>
          </div>

          {gender && (
            <p className="text-xs font-bold uppercase text-neutral-600">
              {gender === "male" ? "Male" : "Female"}
            </p>
          )}

          {/* Visibility indicator */}
          <div className="flex items-center gap-2 pt-0.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border-2 border-black ${
                isPublic ? "bg-[#ccff00]" : "bg-neutral-200"
              } px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black`}
            >
              {isPublic ? (
                <>
                  <GlobeIcon className="h-2.5 w-2.5 shrink-0" />
                  <span>Public</span>
                </>
              ) : (
                <>
                  <LockIcon className="h-2.5 w-2.5 shrink-0" />
                  <span>Private</span>
                </>
              )}
            </span>

            {Object.entries(visibilitySettings).some(([, val]) => val !== "everyone") && (
              <span
                data-testid="custom-visibility-badge"
                className="inline-flex items-center gap-1 rounded-full border-2 border-black bg-[#fde047] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black"
              >
                Custom Controls
              </span>
            )}

            <div
              className="relative inline-flex items-center"
              onMouseEnter={() => setShowPrivacyTooltip(true)}
              onMouseLeave={() => setShowPrivacyTooltip(false)}
            >
              <button
                ref={privacyTriggerRef}
                type="button"
                onClick={() => setShowPrivacyTooltip((prev) => !prev)}
                onFocus={() => setShowPrivacyTooltip(true)}
                onBlur={() => setShowPrivacyTooltip(false)}
                aria-label="Account visibility details"
                title="Account visibility details"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-black transition-all cursor-pointer"
              >
                <InfoIcon className="h-2.5 w-2.5" />
              </button>

              {showPrivacyTooltip && (
                <>
                  <div
                    className="fixed inset-0 z-40 sm:hidden"
                    onClick={() => setShowPrivacyTooltip(false)}
                    aria-hidden="true"
                  />
                  <div
                    ref={privacyTooltipRef}
                    role="tooltip"
                    style={privacyTooltipStyle}
                    className="absolute left-0 sm:left-7 top-7 sm:top-1/2 sm:-translate-y-1/2 z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border-2 border-black bg-white p-3 text-left text-black tooltip-animate"
                  >
                    <div className="space-y-1.5 text-xs">
                      <p className="font-bold leading-snug">
                        <span className="font-black text-black uppercase">Public:</span>{" "}
                        <span className="text-neutral-700">
                          Your profile and stats are discoverable by @username search.
                        </span>
                      </p>
                      <p className="font-bold leading-snug">
                        <span className="font-black text-black uppercase">Private:</span>{" "}
                        <span className="text-neutral-700">
                          Your profile is private; stats are hidden from public search.
                        </span>
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-2 border-t-2 border-neutral-100">
            <p className="text-xs font-bold uppercase text-neutral-600">
              {getSkillTier(eloToDupr(displayRating)).name} · current rating {formatDupr(displayRating)}
            </p>
          </div>
        </div>
      )}

      {/* Discard confirmation dialog */}
      <ConfirmDialog
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleDiscard}
        title="Discard Changes?"
        description="You have unsaved changes to your profile. Are you sure you want to discard them?"
        confirmText="Discard"
        cancelText="Keep Editing"
        confirmVariant="danger"
        confirmDataTestId="confirm-discard-button"
      />

      {/* Success Toast */}
      {toastMessage && (
        <Toast
          role="status"
          onDismiss={() => {
            if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
            setToastMessage(null);
          }}
        >
          <span>{toastMessage}</span>
        </Toast>
      )}
    </div>
  );
}

export function PlayerVisibilityControl({
  initialIsPublic = true,
}: {
  initialIsPublic?: boolean;
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const { triggerRef, tooltipRef, style } = useTooltipPosition(showTooltip, () => setShowTooltip(false));

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setToast(null);
    const nextVal = !isPublic;
    const res = await updatePlayerPrivacyAction({ isPublic: nextVal });
    if (res.ok) {
      setIsPublic(nextVal);
      setToast(nextVal ? "Profile is now Public" : "Profile is now Private");
      router.refresh();
      if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 3000);
    } else {
      setError(res.error ?? "Failed to update visibility.");
    }
    setPending(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={`Account visibility: currently ${isPublic ? "Public" : "Private"}. Click to switch.`}
          title={isPublic ? "Click to switch to Private" : "Click to switch to Public"}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#ccff00] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-[1.5px_1.5px_0px_0px_#000] transition-all cursor-pointer hover:bg-[#bbf000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
        >
          {pending ? (
            <span>Saving…</span>
          ) : isPublic ? (
            <>
              <GlobeIcon className="h-2.5 w-2.5 shrink-0" />
              <span>Public</span>
            </>
          ) : (
            <>
              <LockIcon className="h-2.5 w-2.5 shrink-0" />
              <span>Private</span>
            </>
          )}
        </button>

        <div
          className="relative inline-flex items-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setShowTooltip((prev) => !prev)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label="Account visibility details"
            title="Account visibility details"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-black transition-all cursor-pointer"
          >
            <InfoIcon className="h-2.5 w-2.5" />
          </button>

          {showTooltip && (
            <>
              <div
                className="fixed inset-0 z-40 sm:hidden"
                onClick={() => setShowTooltip(false)}
                aria-hidden="true"
              />
              <div
                ref={tooltipRef}
                role="tooltip"
                style={style}
                className="absolute left-0 sm:left-7 top-7 sm:top-1/2 sm:-translate-y-1/2 z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border-2 border-black bg-white p-3 text-left text-black tooltip-animate"
              >
                <div className="space-y-1.5 text-xs">
                  <p className="font-bold leading-snug">
                    <span className="font-black text-black uppercase">Public:</span>{" "}
                    <span className="text-neutral-700">Your profile and stats are discoverable by @username search.</span>
                  </p>
                  <p className="font-bold leading-snug">
                    <span className="font-black text-black uppercase">Private:</span>{" "}
                    <span className="text-neutral-700">Your profile is private; stats are hidden from public search.</span>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <Toast
          role="status"
          onDismiss={() => {
            if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
            setToast(null);
          }}
        >
          <span>{toast}</span>
        </Toast>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-bold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function PlayerNameEditor({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    if (trimmed === initialName.trim()) {
      setMessage("Name updated.");
      return;
    }
    setPending(true);
    setMessage(null);
    const result = await updatePlayerProfileAction({ name: trimmed });
    setMessage(result.ok ? "Name updated." : result.error);
    if (result.ok) router.refresh();
    setPending(false);
  };
  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="profile-name" className="block text-xs font-black uppercase tracking-wider">
        Display name
      </label>
      <div className="flex gap-2">
        <input
          id="profile-name"
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border-2 border-black px-3 py-2 font-bold"
        />
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {message && <p role="status" className="text-xs font-bold text-neutral-600">{message}</p>}
    </form>
  );
}

export function PlayerLogoutButton({ className }: { className?: string } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const logout = async () => {
    setPending(true);
    clearRecentGroups();
    await playerLogoutAction();
    router.replace("/");
    router.refresh();
  };
  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className={
        className ??
        "rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] disabled:opacity-60 cursor-pointer"
      }
    >
      {pending ? "Signing out…" : "Log Out"}
    </button>
  );
}

export function LeaveGroupButton({
  groupId,
  groupName,
  initialConfirming = false,
}: {
  groupId: string;
  groupName?: string;
  initialConfirming?: boolean;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(initialConfirming);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setPending(true);
    setError(null);
    const result = await leavePublicGroupAction({ groupId });
    if (result.ok) {
      removeRecentGroup(groupId);
      setShowModal(false);
      router.refresh();
    } else {
      setError(result.error ?? "Unable to leave group.");
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setShowModal(true);
        }}
        disabled={pending}
        className="rounded-xl border-2 border-black bg-white px-2.5 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#ff6b6b] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
      >
        Leave
      </button>

      <ConfirmDialog
        isOpen={showModal}
        onClose={() => {
          if (!pending) {
            setError(null);
            setShowModal(false);
          }
        }}
        onConfirm={leave}
        title="Leave Group"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to leave {groupName ? `"${groupName}"` : "this group"}?
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
        confirmText={pending ? "Leaving…" : "Leave"}
        cancelText="Cancel"
        confirmVariant="danger"
        disabled={pending}
        confirmDataTestId="confirm-leave-group-button"
      />
    </>
  );
}
