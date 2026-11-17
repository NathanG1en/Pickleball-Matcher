"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  resendVerificationEmailAction,
  updatePlayerEmailAction,
  updatePlayerPasswordAction,
} from "@/app/actions/player-account";
import { updatePlayerPrivacyAction } from "@/app/actions/players";
import { Toast } from "@/components/ui/toast";
import {
  AlertCircleSolidIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  LockIcon,
  UsersIcon,
} from "@/components/ui/icons";
import type { ProfileVisibilityLevel, ProfileVisibilitySettings } from "@/lib/domain/types";
import {
  clampVisibilityLevel,
  parseProfileVisibilitySettings,
  PROFILE_VISIBILITY_RANKS,
} from "@/lib/privacy/profile-visibility";

export const PORTION_CONFIGS: {
  key: keyof ProfileVisibilitySettings;
  label: string;
  optionDescriptions: Record<ProfileVisibilityLevel, string>;
}[] = [
  {
    key: "profile",
    label: "Profile Page",
    optionDescriptions: {
      everyone: "Anyone can search for your profile and view your profile page.",
      group_members: "Only athletes in your shared groups can view your profile page.",
      only_you: "Your profile is completely private and hidden from search.",
    },
  },
  {
    key: "activities",
    label: "Activities & Past Sessions",
    optionDescriptions: {
      everyone: "Anyone viewing your profile can see your past session and match history.",
      group_members: "Only athletes in your shared groups can see your past session history.",
      only_you: "Only you can see your past session and match history.",
    },
  },
  {
    key: "ratingStats",
    label: "Rating & Stats",
    optionDescriptions: {
      everyone: "Anyone can view your DUPR rating, skill tier, win/loss stats, and rating chart.",
      group_members: "Only athletes in your shared groups can view your rating and stats.",
      only_you: "Only you can view your rating and stats.",
    },
  },
  {
    key: "chemistry",
    label: "Chemistry Spotlight",
    optionDescriptions: {
      everyone: "Anyone can view your best partner synergy and chemistry scores.",
      group_members: "Only athletes in your shared groups can view your partner synergy scores.",
      only_you: "Only you can view your partner synergy scores.",
    },
  },
  {
    key: "groups",
    label: "Groups",
    optionDescriptions: {
      everyone: "Anyone can view the groups and clubs you have joined.",
      group_members: "Only athletes in your shared groups can view your joined groups.",
      only_you: "Only you can view your joined groups.",
    },
  },
];

export const VISIBILITY_LEVEL_OPTIONS: {
  value: ProfileVisibilityLevel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "everyone", label: "Everyone", icon: GlobeIcon },
  { value: "group_members", label: "Group Members", icon: UsersIcon },
  { value: "only_you", label: "Only You", icon: LockIcon },
];

export function validateEmailFormat(val: string): { isValid: boolean; message: string | null } {
  const trimmed = val.trim();
  if (!trimmed) {
    return { isValid: false, message: "Email address is required." };
  }
  if (!trimmed.includes("@")) {
    return { isValid: false, message: "Double-check the spelling: missing '@' symbol." };
  }
  const atIndex = trimmed.lastIndexOf("@");
  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  if (!localPart) {
    return { isValid: false, message: "Please enter an email username before the '@'." };
  }
  if (!domainPart || !domainPart.includes(".")) {
    return { isValid: false, message: "Double-check the spelling and try again." };
  }
  const domainParts = domainPart.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) {
    return { isValid: false, message: "Double-check the spelling and try again." };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, message: "Double-check the spelling and try again." };
  }
  return { isValid: true, message: null };
}

export interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "account" | "privacy";
  initialEmail?: string | null;
  initialEmailVerified?: boolean;
  hasPassword?: boolean;
  initialVisibilitySettings?: ProfileVisibilitySettings;
  initialIsPublic?: boolean;
  initialOpenDrawers?: Record<string, boolean>;
  onProfilePrivacyUpdated?: (newSettings: ProfileVisibilitySettings, isPublic: boolean) => void;
  onEmailUpdated?: (newEmail: string) => void;
}

export function UserSettingsModal({
  isOpen,
  onClose,
  initialTab = "account",
  initialEmail = "",
  initialEmailVerified = false,
  hasPassword = true,
  initialVisibilitySettings,
  initialIsPublic = true,
  initialOpenDrawers = {},
  onProfilePrivacyUpdated,
  onEmailUpdated,
}: UserSettingsModalProps) {
  const router = useRouter();
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descId = `${generatedId}-desc`;
  const [activeTab, setActiveTab] = useState<"account" | "privacy">(initialTab);

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

  // Email form state
  const [currentEmail, setCurrentEmail] = useState(initialEmail ?? "");
  const [newEmail, setNewEmail] = useState(initialEmail ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(initialEmailVerified ?? false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPasswordTouched, setCurrentPasswordTouched] = useState(false);
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordGeneralError, setPasswordGeneralError] = useState<string | null>(null);

  // Privacy controls state
  const baseVisibility = useMemo(
    () => parseProfileVisibilitySettings(initialVisibilitySettings, initialIsPublic),
    [initialVisibilitySettings, initialIsPublic],
  );
  const [visibilityInput, setVisibilityInput] = useState<ProfileVisibilitySettings>(() =>
    parseProfileVisibilitySettings(initialVisibilitySettings, initialIsPublic),
  );
  const [openDrawers, setOpenDrawers] = useState<Record<string, boolean>>(initialOpenDrawers);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  // Change detection & validation
  const trimmedNewEmail = newEmail.trim().toLowerCase();
  const trimmedCurrentEmail = currentEmail.trim().toLowerCase();
  const emailValidation = validateEmailFormat(newEmail);
  const isEmailValid = emailValidation.isValid;
  const showEmailError = emailTouched && !isEmailValid;
  const hasEmailChanges =
    isEmailValid && Boolean(trimmedNewEmail) && trimmedNewEmail !== trimmedCurrentEmail;

  const hasPrivacyChanges = PORTION_CONFIGS.some(
    (portion) => visibilityInput[portion.key] !== baseVisibility[portion.key],
  );

  const showCurrentPasswordError =
    currentPasswordError || (currentPasswordTouched && hasPassword && !currentPassword.trim());
  const showNewPasswordError =
    newPasswordTouched && Boolean(newPassword) && newPassword.length < 10;
  const showConfirmPasswordError =
    Boolean(confirmPassword) &&
    (confirmPasswordTouched || confirmPassword.length >= newPassword.length) &&
    confirmPassword !== newPassword;

  const hasPasswordChanges =
    (!hasPassword || Boolean(currentPassword.trim())) &&
    newPassword.length >= 10 &&
    Boolean(confirmPassword) &&
    confirmPassword === newPassword;

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current !== null) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  const toggleDrawer = (key: string) => {
    setOpenDrawers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setEmailError(null);
    try {
      const res = await resendVerificationEmailAction();
      if (!res.ok) {
        setEmailError(res.error ?? "Failed to resend verification link.");
        return;
      }
      if (res.data.verificationToken) {
        setVerificationToken(res.data.verificationToken);
      }
      showToast("Verification link sent! Check your inbox.");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to resend verification link.");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailSaving || !hasEmailChanges) return;

    setEmailSaving(true);
    setEmailError(null);

    try {
      const res = await updatePlayerEmailAction({ email: trimmedNewEmail });
      if (!res.ok) {
        setEmailError(res.error ?? "Failed to update email.");
        setEmailSaving(false);
        return;
      }

      setCurrentEmail(trimmedNewEmail);
      setIsEmailVerified(false);
      if (res.data.verificationToken) {
        setVerificationToken(res.data.verificationToken);
      }
      onEmailUpdated?.(trimmedNewEmail);
      showToast("Email updated. Please verify your new email address.");
      router.refresh();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to update email.");
    } finally {
      setEmailSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordSaving || !hasPasswordChanges) return;

    if (hasPassword && !currentPassword.trim()) {
      setCurrentPasswordError("Current password is required.");
      return;
    }

    if (newPassword.length < 10) {
      setNewPasswordTouched(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordTouched(true);
      return;
    }

    setPasswordSaving(true);
    setCurrentPasswordError(null);
    setPasswordGeneralError(null);

    try {
      const res = await updatePlayerPasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.ok) {
        if (
          res.error?.toLowerCase().includes("current password") ||
          res.fieldErrors?.currentPassword
        ) {
          setCurrentPasswordError(
            res.fieldErrors?.currentPassword?.[0] ?? res.error ?? "Current password is incorrect.",
          );
        } else {
          setPasswordGeneralError(res.error ?? "Failed to update password.");
        }
        setPasswordSaving(false);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPasswordTouched(false);
      setNewPasswordTouched(false);
      setConfirmPasswordTouched(false);
      setCurrentPasswordError(null);
      setPasswordGeneralError(null);
      showToast("Password updated successfully");
    } catch (err) {
      setPasswordGeneralError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (privacySaving || !hasPrivacyChanges) return;
    setPrivacySaving(true);
    setPrivacyError(null);

    try {
      const targetIsPublic = visibilityInput.profile !== "only_you";
      const res = await updatePlayerPrivacyAction({
        isPublic: targetIsPublic,
        visibilitySettings: visibilityInput,
      });

      if (!res.ok) {
        setPrivacyError(res.error ?? "Failed to update privacy settings.");
        setPrivacySaving(false);
        return;
      }

      onProfilePrivacyUpdated?.(visibilityInput, targetIsPublic);
      showToast("Privacy settings updated");
      router.refresh();
    } catch (err) {
      setPrivacyError(err instanceof Error ? err.message : "Failed to update privacy settings.");
    } finally {
      setPrivacySaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl border-[3px] border-black bg-[#FFFDF7] text-black shadow-[8px_8px_0px_0px_#000] overflow-hidden">
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b-[2.5px] border-black px-6 py-4 sm:px-7 sm:py-5 bg-[#FFFDF7] shrink-0">
          <div>
            <h2
              id={titleId}
              className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight text-black"
            >
              Settings
            </h2>
            <p id={descId} className="text-xs font-bold text-neutral-600 truncate max-w-md">
              Manage your account security, credentials, and profile privacy.
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
            aria-label="Settings categories"
            className="flex items-center gap-2 min-w-max"
          >
            <button
              type="button"
              role="tab"
              id="tab-account"
              aria-selected={activeTab === "account"}
              aria-controls="tabpanel-account"
              data-testid="tab-account"
              onClick={() => setActiveTab("account")}
              className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                activeTab === "account"
                  ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                  : "text-neutral-700 hover:text-black hover:bg-neutral-200 border-2 border-transparent"
              }`}
            >
              Account & Security
            </button>

            <button
              type="button"
              role="tab"
              id="tab-privacy"
              aria-selected={activeTab === "privacy"}
              aria-controls="tabpanel-privacy"
              data-testid="tab-privacy"
              onClick={() => setActiveTab("privacy")}
              className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                activeTab === "privacy"
                  ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                  : "text-neutral-700 hover:text-black hover:bg-neutral-200 border-2 border-transparent"
              }`}
            >
              Privacy
            </button>
          </nav>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
          {/* Account Tab Panel */}
          <div
            id="tabpanel-account"
            role="tabpanel"
            aria-labelledby="tab-account"
            className={activeTab === "account" ? "space-y-6" : "hidden"}
          >
          {/* Email Section */}
          <section className="space-y-3 rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_#000]">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-black">
                  Email Address
                </h3>
                {currentEmail ? (
                  isEmailVerified ? (
                    <span
                      data-testid="email-verified-badge"
                      className="inline-flex items-center rounded-full border border-black bg-[#ccff00] px-2 py-0.5 text-[10px] font-black uppercase text-black"
                    >
                      Verified
                    </span>
                  ) : (
                    <span
                      data-testid="email-unverified-badge"
                      className="inline-flex items-center rounded-full border border-amber-500 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900"
                    >
                      Unverified · Re-verification Required
                    </span>
                  )
                ) : null}
              </div>
              <p className="mt-0.5 text-xs font-bold text-neutral-600">
                {currentEmail ? (
                  <>
                    Current email: <span className="text-black font-black">{currentEmail}</span>
                  </>
                ) : (
                  "No email address linked to your account."
                )}
              </p>
              {currentEmail && !isEmailVerified && (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] font-bold text-amber-800">
                    Your email address requires verification. An email update requires re-verification before it can be used for account recovery.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={resendingVerification}
                      onClick={handleResendVerification}
                      data-testid="settings-resend-verification-button"
                      className="rounded-lg border border-black bg-neutral-100 px-2.5 py-1 text-[11px] font-black uppercase text-black hover:bg-neutral-200 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
                    >
                      {resendingVerification ? "Sending…" : "Resend Verification Link"}
                    </button>
                    {verificationToken && (
                      <Link
                        href={`/verify-email?token=${verificationToken}`}
                        data-testid="settings-verify-now-link"
                        className="text-[11px] font-black text-black underline underline-offset-2 hover:text-neutral-800"
                      >
                        Verify Now →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleUpdateEmail} noValidate className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="settings-email-input"
                  className="block text-xs font-black uppercase tracking-wider text-neutral-700"
                >
                  New Email Address
                </label>
                <input
                  id="settings-email-input"
                  data-testid="settings-email-input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailError(null);
                  }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="athlete@example.com"
                  className={`w-full rounded-xl border-2 ${
                    showEmailError
                      ? "border-red-500 bg-white text-red-600 outline-none ring-0 focus:border-red-500 focus:outline-none focus:ring-0"
                      : "border-black bg-white text-black outline-none focus:outline-none focus:ring-2 focus:ring-black"
                  } px-3 py-2 text-sm font-bold`}
                />
                {showEmailError && (
                  <div
                    role="alert"
                    data-testid="email-invalid-input-box"
                    className="flex items-center gap-1.5 pt-1 text-xs font-bold text-red-600"
                  >
                    <AlertCircleSolidIcon className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{emailValidation.message}</span>
                  </div>
                )}
                {emailError && !showEmailError && (
                  <div
                    role="alert"
                    data-testid="email-server-error"
                    className="flex items-center gap-1.5 pt-1 text-xs font-bold text-red-600"
                  >
                    <AlertCircleSolidIcon className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{emailError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={emailSaving || !hasEmailChanges}
                  data-testid="save-email-button"
                  className="rounded-xl border-2 border-black bg-[#ccff00] px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-neutral-200 disabled:hover:text-neutral-500 disabled:active:translate-x-0 disabled:active:translate-y-0"
                >
                  {emailSaving ? "Saving…" : "Update Email"}
                </button>
              </div>
            </form>
          </section>

          {/* Password Section */}
          <section className="space-y-3 rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_#000]">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-black">
                Password
              </h3>
              <p className="mt-0.5 text-xs font-bold text-neutral-600">
                {hasPassword
                  ? "Update your password to keep your player account secure."
                  : "Set a password so you can sign in directly with your email and password."}
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} noValidate className="space-y-3">
              {/* Current Password */}
              <div className="space-y-1">
                <label
                  htmlFor="settings-current-password"
                  className="block text-xs font-black uppercase tracking-wider text-neutral-700"
                >
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="settings-current-password"
                    data-testid="settings-current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setCurrentPasswordError(null);
                      setPasswordGeneralError(null);
                    }}
                    onBlur={() => setCurrentPasswordTouched(true)}
                    placeholder="Enter current password"
                    className={`w-full rounded-xl border-2 ${
                      showCurrentPasswordError
                        ? "border-red-500 bg-white text-red-600 outline-none ring-0 focus:border-red-500 focus:outline-none focus:ring-0"
                        : "border-black bg-white text-black outline-none focus:outline-none focus:ring-2 focus:ring-black"
                    } px-3 py-2 pr-10 text-sm font-bold`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                    data-testid="toggle-current-password-visibility"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-600 hover:text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    {showCurrentPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {showCurrentPasswordError && (
                  <div
                    role="alert"
                    data-testid="current-password-error"
                    className="flex items-center gap-1.5 pt-1 text-xs font-bold text-red-600"
                  >
                    <AlertCircleSolidIcon className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{currentPasswordError || "Current password is required."}</span>
                  </div>
                )}
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <label
                  htmlFor="settings-new-password"
                  className="block text-xs font-black uppercase tracking-wider text-neutral-700"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="settings-new-password"
                    data-testid="settings-new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordGeneralError(null);
                    }}
                    onBlur={() => setNewPasswordTouched(true)}
                    placeholder="At least 10 characters"
                    className={`w-full rounded-xl border-2 ${
                      showNewPasswordError
                        ? "border-red-500 bg-white text-red-600 outline-none ring-0 focus:border-red-500 focus:outline-none focus:ring-0"
                        : "border-black bg-white text-black outline-none focus:outline-none focus:ring-2 focus:ring-black"
                    } px-3 py-2 pr-10 text-sm font-bold`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    data-testid="toggle-new-password-visibility"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-600 hover:text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    {showNewPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {showNewPasswordError && (
                  <div
                    role="alert"
                    data-testid="new-password-error"
                    className="flex items-center gap-1.5 pt-1 text-xs font-bold text-red-600"
                  >
                    <AlertCircleSolidIcon className="h-4 w-4 shrink-0 text-red-600" />
                    <span>New password must be at least 10 characters.</span>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1">
                <label
                  htmlFor="settings-confirm-password"
                  className="block text-xs font-black uppercase tracking-wider text-neutral-700"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="settings-confirm-password"
                    data-testid="settings-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordGeneralError(null);
                    }}
                    onBlur={() => setConfirmPasswordTouched(true)}
                    placeholder="Re-enter new password"
                    className={`w-full rounded-xl border-2 ${
                      showConfirmPasswordError
                        ? "border-red-500 bg-white text-red-600 outline-none ring-0 focus:border-red-500 focus:outline-none focus:ring-0"
                        : "border-black bg-white text-black outline-none focus:outline-none focus:ring-2 focus:ring-black"
                    } px-3 py-2 pr-10 text-sm font-bold`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm new password" : "Show confirm new password"}
                    data-testid="toggle-confirm-password-visibility"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-600 hover:text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {showConfirmPasswordError && (
                  <div
                    role="alert"
                    data-testid="confirm-password-error"
                    className="flex items-center gap-1.5 pt-1 text-xs font-bold text-red-600"
                  >
                    <AlertCircleSolidIcon className="h-4 w-4 shrink-0 text-red-600" />
                    <span>Confirm password must match the new password.</span>
                  </div>
                )}
              </div>

              {passwordGeneralError && (
                <div
                  role="alert"
                  data-testid="password-general-error"
                  className="flex items-center gap-1.5 pt-1 text-xs font-bold text-red-600"
                >
                  <AlertCircleSolidIcon className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{passwordGeneralError}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={passwordSaving || !hasPasswordChanges}
                  data-testid="save-password-button"
                  className="rounded-xl border-2 border-black bg-[#ccff00] px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-neutral-200 disabled:hover:text-neutral-500 disabled:active:translate-x-0 disabled:active:translate-y-0"
                >
                  {passwordSaving ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Privacy Tab Panel */}
        <div
          id="tabpanel-privacy"
          role="tabpanel"
          aria-labelledby="tab-privacy"
          className={activeTab === "privacy" ? "space-y-4" : "hidden"}
        >
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-black">
              Privacy Controls
            </h3>
            <p className="mt-0.5 text-xs font-bold text-neutral-600">
              Customize who can discover your profile and see each section of your athlete activity.
            </p>
          </div>

          <div id="privacy-controls-content" className="space-y-2.5">
            {PORTION_CONFIGS.map((portion) => {
              const isOpenDrawer = Boolean(openDrawers[portion.key]);
              const currentSelected =
                VISIBILITY_LEVEL_OPTIONS.find(
                  (opt) => opt.value === visibilityInput[portion.key],
                ) ?? VISIBILITY_LEVEL_OPTIONS[0];
              const CurrentIcon = currentSelected.icon;
              const currentCeiling = visibilityInput.profile;
              const isCapped = portion.key !== "profile" && currentCeiling !== "everyone";

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
                    aria-expanded={isOpenDrawer}
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
                          isOpenDrawer ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Drawer Content */}
                  {isOpenDrawer && (
                    <div
                      id={`drawer-content-${portion.key}`}
                      className="border-t-2 border-neutral-100 bg-neutral-50/60 p-3 space-y-2"
                    >
                      {isCapped && (
                        <p className="text-[10px] font-bold text-neutral-500 mb-1">
                          Visibility ceiling:{" "}
                          {currentCeiling === "only_you" ? "Only You" : "Group Members"} (from Profile Page)
                        </p>
                      )}
                      <div
                        className="space-y-1.5"
                        role="radiogroup"
                        aria-label={`${portion.label} visibility`}
                      >
                        {VISIBILITY_LEVEL_OPTIONS.map((opt) => {
                          const isSelected = visibilityInput[portion.key] === opt.value;
                          const Icon = opt.icon;
                          const isExceedingCeiling =
                            portion.key !== "profile" &&
                            PROFILE_VISIBILITY_RANKS[opt.value] >
                              PROFILE_VISIBILITY_RANKS[currentCeiling];
                          const optionDesc = portion.optionDescriptions[opt.value];

                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              aria-label={`${portion.label}: ${opt.label}. ${optionDesc}`}
                              aria-disabled={isExceedingCeiling}
                              disabled={isExceedingCeiling}
                              title={
                                isExceedingCeiling
                                  ? `Limited by Profile Page (${
                                      currentCeiling === "only_you"
                                        ? "Only You"
                                        : "Group Members"
                                    })`
                                  : undefined
                              }
                              data-testid={`${portion.key}-visibility-${opt.value}`}
                              onClick={() => {
                                if (isExceedingCeiling) return;
                                if (portion.key === "profile") {
                                  const newProfile = opt.value;
                                  setVisibilityInput({
                                    profile: newProfile,
                                    activities: clampVisibilityLevel(
                                      visibilityInput.activities,
                                      newProfile,
                                    ),
                                    ratingStats: clampVisibilityLevel(
                                      visibilityInput.ratingStats,
                                      newProfile,
                                    ),
                                    chemistry: clampVisibilityLevel(
                                      visibilityInput.chemistry,
                                      newProfile,
                                    ),
                                    groups: clampVisibilityLevel(
                                      visibilityInput.groups,
                                      newProfile,
                                    ),
                                  });
                                } else {
                                  setVisibilityInput({
                                    ...visibilityInput,
                                    [portion.key]: opt.value,
                                  });
                                }
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 p-2.5 text-left transition-all ${
                                isExceedingCeiling
                                  ? "border-neutral-200 bg-neutral-100/60 opacity-40 cursor-not-allowed"
                                  : isSelected
                                  ? "border-black bg-white shadow-[1.5px_1.5px_0px_0px_#000] cursor-pointer"
                                  : "border-neutral-200 bg-white hover:border-black/50 hover:bg-neutral-50 cursor-pointer"
                              }`}
                            >
                              {/* Left: Option Label & Description */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <Icon className="h-3.5 w-3.5 shrink-0 text-black" />
                                  <span className="text-xs font-black uppercase text-black">
                                    {opt.label}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] font-normal text-neutral-600 leading-snug">
                                  {optionDesc}
                                </p>
                              </div>

                              {/* Right: Radio Button (turns green when selected) */}
                              <div
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                  isSelected
                                    ? "border-black bg-[#ccff00] shadow-[1px_1px_0px_0px_#000]"
                                    : "border-neutral-400 bg-white"
                                }`}
                                aria-hidden="true"
                              >
                                {isSelected && (
                                  <div className="h-2 w-2 rounded-full bg-black" />
                                )}
                              </div>
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

          {privacyError && (
            <div
              role="alert"
              className="rounded-lg border border-red-500 bg-red-100 p-2 text-xs font-bold text-red-800"
            >
              {privacyError}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSavePrivacy}
              disabled={privacySaving || !hasPrivacyChanges}
              data-testid="save-privacy-settings-button"
              className="rounded-xl border-2 border-black bg-[#ccff00] px-4 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-neutral-200 disabled:hover:text-neutral-500 disabled:active:translate-x-0 disabled:active:translate-y-0"
            >
              {privacySaving ? "Saving…" : "Save Privacy Settings"}
            </button>
          </div>
        </div>
      </div>

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
  </div>
);
}
