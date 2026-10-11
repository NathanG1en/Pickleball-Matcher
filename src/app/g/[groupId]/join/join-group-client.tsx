"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinAsGuestAction, joinGroupViaInviteAction } from "@/app/actions/player-account";
import { saveRecentGroup } from "@/lib/storage/recent-groups";

interface AccountSummary {
  id: string;
  username: string;
  name: string;
  initialRating: number;
}

interface GuestSummary {
  id: string;
  name: string;
}

export function JoinGroupClient({
  groupId,
  groupName,
  isPublic,
  activePlayerCount,
  account,
  isOrganizer,
  isAccountMember,
  guestPlayer,
}: {
  groupId: string;
  groupName: string;
  isPublic: boolean;
  activePlayerCount: number;
  account: AccountSummary | null;
  isOrganizer: boolean;
  isAccountMember: boolean;
  guestPlayer: GuestSummary | null;
}) {
  const router = useRouter();

  // Account join state
  const [accountJoining, setAccountJoining] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Guest join state
  const [guestName, setGuestName] = useState("");
  const [guestSkill, setGuestSkill] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [guestJoining, setGuestJoining] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const isAlreadyInGroup = isOrganizer || isAccountMember || Boolean(guestPlayer);

  const handleAccountJoin = async () => {
    setAccountJoining(true);
    setAccountError(null);
    const result = await joinGroupViaInviteAction({ groupId });
    if (result.ok) {
      saveRecentGroup({ id: groupId, name: groupName });
      router.push(`/g/${groupId}`);
      router.refresh();
      return;
    }
    setAccountError(result.error);
    setAccountJoining(false);
  };

  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = guestName.trim();
    if (!trimmed) {
      setGuestError("Please enter your name.");
      return;
    }
    setGuestJoining(true);
    setGuestError(null);
    const result = await joinAsGuestAction({
      groupId,
      name: trimmed,
      skillLevel: guestSkill,
    });
    if (result.ok) {
      saveRecentGroup({ id: groupId, name: groupName });
      router.push(`/g/${groupId}`);
      router.refresh();
      return;
    }
    setGuestError(result.error);
    setGuestJoining(false);
  };

  // Case 1: Already a member
  if (isAlreadyInGroup) {
    return (
      <section className="relative w-full max-w-md rounded-3xl border-[3px] border-black bg-white p-6 sm:p-8 text-center shadow-[8px_8px_0px_0px_#000] space-y-5">
        <Link
          href="/"
          aria-label="Return home"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black text-xl font-black hover:bg-[#fde047] cursor-pointer"
        >
          ×
        </Link>
        <div className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#ccff00] border-2 border-black">
          {isOrganizer ? "Group Organizer" : "Already a Member"}
        </div>
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black mb-2">
            {groupName}
          </h1>
          <p className="text-sm font-bold text-neutral-700">
            {guestPlayer
              ? `You are joined to this group on this device as guest "${guestPlayer.name}".`
              : account
              ? `You are already a member as @${account.username} (${account.name}).`
              : "You are already a member of this group."}
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <Link
            href={`/g/${groupId}`}
            className="block text-center w-full py-3.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
          >
            Go to Group Dashboard →
          </Link>
          <Link
            href="/"
            className="block text-center text-xs font-black uppercase tracking-wider text-neutral-600 underline hover:text-black"
          >
            Back to Home
          </Link>
        </div>
      </section>
    );
  }

  // Case 2: Signed in with an account, but not a member yet
  if (account) {
    return (
      <section className="relative w-full max-w-md rounded-3xl border-[3px] border-black bg-white p-6 sm:p-8 text-center shadow-[8px_8px_0px_0px_#000] space-y-5">
        <Link
          href="/"
          aria-label="Return home"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black text-xl font-black hover:bg-[#fde047] cursor-pointer"
        >
          ×
        </Link>

        <div className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#ccff00] border-2 border-black">
          Group Invitation
        </div>

        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black mb-1">
            Join {groupName}
          </h1>
          <p className="text-xs font-bold text-neutral-600">
            {activePlayerCount} active player{activePlayerCount === 1 ? "" : "s"} • {isPublic ? "Public Group" : "Private Group"}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-black bg-neutral-50 p-4 text-left shadow-[2px_2px_0px_0px_#000]">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block mb-1">
            Signing in as
          </span>
          <div className="font-display text-lg font-black uppercase text-black">
            @{account.username}
          </div>
          <div className="text-xs font-bold text-neutral-700">
            {account.name} (Starting Rating: {account.initialRating})
          </div>
        </div>

        {accountError && (
          <div role="alert" className="rounded-xl border-2 border-black bg-[#ff6b6b] p-3 text-sm font-black text-black">
            {accountError}
          </div>
        )}

        <div className="pt-2 space-y-3">
          <button
            type="button"
            onClick={handleAccountJoin}
            disabled={accountJoining}
            className="block text-center w-full py-3.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] disabled:opacity-60 cursor-pointer"
          >
            {accountJoining ? "Joining Group…" : "Join Group Now"}
          </button>
          <div className="text-xs font-bold text-neutral-600">
            <span>Not you? </span>
            <Link
              href={`/player-login?next=${encodeURIComponent(`/g/${groupId}/join`)}`}
              className="font-black text-black underline"
            >
              Switch Account
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Case 3: Visitor is NOT signed in on this device
  return (
    <section className="relative w-full max-w-md rounded-3xl border-[3px] border-black bg-white p-6 sm:p-8 text-center shadow-[8px_8px_0px_0px_#000] space-y-5">
      <Link
        href="/"
        aria-label="Return home"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black text-xl font-black hover:bg-[#fde047] cursor-pointer"
      >
        ×
      </Link>

      <div className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#ccff00] border-2 border-black">
        Group Invitation
      </div>

      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black mb-1">
          Join {groupName}
        </h1>
        <p className="text-xs font-bold text-neutral-600">
          {activePlayerCount} player{activePlayerCount === 1 ? "" : "s"} • {isPublic ? "Public Group" : "Private Group"}
        </p>
      </div>

      <p className="text-sm font-bold text-neutral-700">
        You were invited to play with this group! Choose how you would like to join:
      </p>

      {/* Option 1: Guest Join Form */}
      <div className="rounded-2xl border-2 border-black bg-[#fefce8] p-4 text-left shadow-[3px_3px_0px_0px_#000] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-black">
            ⚡ Quick Guest Join
          </span>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black text-[#ccff00]">
            No Password
          </span>
        </div>
        <p className="text-xs font-bold text-neutral-700">
          Play right away on this device without creating an account.
        </p>

        {guestError && (
          <div role="alert" className="rounded-xl border-2 border-black bg-[#ff6b6b] p-2.5 text-xs font-black text-black">
            {guestError}
          </div>
        )}

        <form onSubmit={handleGuestJoin} className="space-y-3">
          <div>
            <label htmlFor="guest-join-name" className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
              Your Name
            </label>
            <input
              id="guest-join-name"
              type="text"
              required
              maxLength={80}
              placeholder="e.g. Alex"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black shadow-[2px_2px_0px_0px_#000] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="guest-join-skill" className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
              Skill Level
            </label>
            <select
              id="guest-join-skill"
              value={guestSkill}
              onChange={(e) => setGuestSkill(e.target.value as "beginner" | "intermediate" | "advanced")}
              className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-bold text-black shadow-[2px_2px_0px_0px_#000] focus:outline-none"
            >
              <option value="beginner">Beginner (900 rating)</option>
              <option value="intermediate">Intermediate (1,000 rating)</option>
              <option value="advanced">Advanced (1,100 rating)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={guestJoining || !guestName.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-neutral-900 text-[#ccff00] font-display text-base font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 cursor-pointer"
          >
            {guestJoining ? "Joining as Guest…" : "Join as Guest"}
          </button>
        </form>
      </div>

      {/* Divider */}
      <div className="relative flex py-1 items-center">
        <div className="flex-grow border-t-2 border-neutral-200"></div>
        <span className="flex-shrink mx-3 text-[10px] font-black uppercase tracking-widest text-neutral-500">
          Or with a Player Account
        </span>
        <div className="flex-grow border-t-2 border-neutral-200"></div>
      </div>

      {/* Option 2 & 3: Sign In or Create Account */}
      <div className="space-y-2">
        <Link
          href={`/player-login?next=${encodeURIComponent(`/g/${groupId}/join`)}`}
          className="block text-center w-full py-3 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-base font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
        >
          Sign In to Existing Account
        </Link>
        <Link
          href={`/player-signup?next=${encodeURIComponent(`/g/${groupId}/join`)}`}
          className="block text-center w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-50 text-black border-2 border-black font-display text-base font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
        >
          Create New Account
        </Link>
      </div>

      <p className="text-[11px] font-semibold text-neutral-500">
        Player accounts keep track of ratings, matches, and synergies across all your devices.
      </p>
    </section>
  );
}

