"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { playerLoginAction } from "@/app/actions/player-account";
import { Button } from "@/components/ui/button";

export function PlayerLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await playerLoginAction({ username, password });
    if (result.ok) {
      router.push("/players");
      router.refresh();
      return;
    }
    setError(result.error);
    setPending(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      {error && <div role="alert" className="rounded-xl border-2 border-black bg-[#ff6b6b] p-3 text-center text-sm font-black">{error}</div>}
      <div><label htmlFor="player-login-username" className="mb-1.5 block text-xs font-black uppercase tracking-wider">Username</label><input id="player-login-username" required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} /></div>
      <div><label htmlFor="player-login-password" className="mb-1.5 block text-xs font-black uppercase tracking-wider">Password</label><input id="player-login-password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></div>
      <Button type="submit" variant="primary" size="lg" disabled={pending || !username.trim() || !password} className="w-full font-display text-lg uppercase">{pending ? "Signing in…" : "Sign In"}</Button>
      <p className="text-center text-sm font-bold text-neutral-700">New player? <Link href="/player-signup" className="underline">Create an account</Link></p>
    </form>
  );
}

const inputClass = "w-full rounded-xl border-2 border-black bg-white px-4 py-3 font-bold text-black shadow-[3px_3px_0px_0px_#000] focus:outline-none focus:shadow-[5px_5px_0px_0px_#000]";
