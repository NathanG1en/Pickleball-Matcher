"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leavePublicGroupAction, playerLogoutAction, updatePlayerProfileAction } from "@/app/actions/player-account";
import { Button } from "@/components/ui/button";

export function PlayerNameEditor({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await updatePlayerProfileAction({ name });
    setMessage(result.ok ? "Name updated." : result.error);
    if (result.ok) router.refresh();
    setPending(false);
  };
  return <form onSubmit={save} className="space-y-2">
    <label htmlFor="profile-name" className="block text-xs font-black uppercase tracking-wider">Display name</label>
    <div className="flex gap-2"><input id="profile-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 rounded-xl border-2 border-black px-3 py-2 font-bold" /><Button type="submit" variant="primary" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save"}</Button></div>
    {message && <p role="status" className="text-xs font-bold text-neutral-600">{message}</p>}
  </form>;
}

export function PlayerLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const logout = async () => {
    setPending(true);
    await playerLogoutAction();
    router.replace("/");
    router.refresh();
  };
  return <button type="button" onClick={logout} disabled={pending} className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047]">{pending ? "Signing out…" : "Log Out"}</button>;
}

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = async () => {
    setPending(true);
    setError(null);
    const result = await leavePublicGroupAction({ groupId });
    if (result.ok) router.refresh();
    else setError(result.error);
    setPending(false);
  };
  return <div className="flex flex-col items-end gap-1">
    <button type="button" onClick={leave} disabled={pending} className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-[10px] font-black uppercase hover:bg-[#ff6b6b] disabled:opacity-60">{pending ? "Leaving…" : "Leave group"}</button>
    {error && <p role="alert" className="max-w-40 text-right text-[10px] font-bold text-red-700">{error}</p>}
  </div>;
}
