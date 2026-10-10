"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAccountGroupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { saveRecentGroup } from "@/lib/storage/recent-groups";

export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const result = await createAccountGroupAction({ name, isPublic });
    if (!result.ok) {
      setError(result.error);
      setIsPending(false);
      return;
    }
    saveRecentGroup({ id: result.data.groupId, name: result.data.name });
    router.push(`/g/${result.data.groupId}`);
    router.refresh();
  };

  return <form onSubmit={submit} className="space-y-5">
    {error && <p role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <div>
      <label htmlFor="group-name" className="mb-1.5 block text-xs font-black uppercase tracking-wider">Group name</label>
      <input id="group-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Tuesday Morning Doubles" className="w-full rounded-xl border-2 border-black px-4 py-3 font-bold shadow-[3px_3px_0px_0px_#000] focus:outline-none" />
      <p className="mt-1 text-xs font-semibold text-neutral-600">Names are case-sensitive and must be unique.</p>
    </div>
    <label className="flex items-start gap-3 rounded-xl border-2 border-black bg-neutral-50 p-4 text-sm font-bold">
      <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="mt-0.5 h-4 w-4 accent-black" />
      <span>Make this group public so players can find and join it.</span>
    </label>
    <Button type="submit" variant="primary" size="lg" disabled={isPending || !name.trim()} className="w-full font-display text-lg uppercase">{isPending ? "Creating…" : "Create Group"}</Button>
  </form>;
}
