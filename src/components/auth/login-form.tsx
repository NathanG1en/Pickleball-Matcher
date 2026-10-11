"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { organizerLoginAction } from "@/app/actions/auth";
import { Alert, Button, Input, Label, VisibilityToggle } from "@/components/ui";
import {
  getRecentGroupsSnapshot,
  saveRecentGroup,
  subscribeRecentGroups,
  type RecentGroup,
} from "@/lib/storage/recent-groups";

export function LoginForm({ initialGroupName = "" }: { initialGroupName?: string }) {
  const router = useRouter();
  const [groupName, setGroupName] = useState(initialGroupName);
  const [pin, setPin] = useState("");
  const [pinVisible, setPinVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const recentGroupsJson = useSyncExternalStore(
    subscribeRecentGroups,
    getRecentGroupsSnapshot,
    getRecentGroupsSnapshot
  );

  const recentGroups: RecentGroup[] = useMemo(() => {
    try {
      return JSON.parse(recentGroupsJson);
    } catch {
      return [];
    }
  }, [recentGroupsJson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const trimmedName = groupName.trim();
      const res = await organizerLoginAction({
        groupName: trimmedName,
        pin: pin.trim(),
      });

      if (!res.ok) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      saveRecentGroup({ id: res.data.groupId, name: trimmedName });
      router.push(`/g/${res.data.groupId}`);
    } catch {
      setError("Unable to sign in. Please try again.");
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {error && (
        <Alert variant="danger" size="sm" className="text-center">
          {error}
        </Alert>
      )}

      <div>
        <Label htmlFor="login-group-name">
          Group Name
        </Label>
        <Input
          id="login-group-name"
          type="text"
          required
          autoComplete="off"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Enter your group name"
        />
        {recentGroups.length > 0 && !groupName && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
              Recent:
            </span>
            {recentGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupName(g.name)}
                className="px-2 py-0.5 text-xs font-bold rounded-lg border border-black bg-[#fef08a] hover:bg-[#fde047] shadow-[1px_1px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="login-pin">
          Organizer PIN
        </Label>
        <div className="relative">
          <Input
            id="login-pin"
            type={pinVisible ? "text" : "password"}
            inputMode="numeric"
            pattern="[0-9]*"
            required
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="pr-14 text-center text-3xl font-mono tracking-widest"
          />
          <VisibilityToggle visible={pinVisible} onToggle={() => setPinVisible((visible) => !visible)} label="organizer PIN" />
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isPending || pin.length < 4 || !groupName.trim()}
        className="w-full mt-3 font-display text-lg tracking-wide uppercase"
      >
        {isPending ? "Signing In..." : "Unlock"}
      </Button>
    </form>
  );
}
