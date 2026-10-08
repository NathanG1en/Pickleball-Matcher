import Link from "next/link";
import { PlayerSignupForm } from "@/components/players/player-signup-form";

export default function PlayerSignupPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
      <section className="relative w-full max-w-md rounded-3xl border-[3px] border-black bg-white p-6 shadow-[8px_8px_0px_0px_#000] sm:p-8">
        <Link href="/" aria-label="Return home" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black text-xl font-black hover:bg-[#fde047]">×</Link>
        <header className="mb-6 space-y-2 text-center">
          <span className="inline-block rounded-full border-2 border-black bg-[#fde047] px-3 py-1 text-xs font-black uppercase tracking-wider">Player Account</span>
          <h1 className="font-display text-4xl font-black uppercase">Join the game</h1>
          <p className="text-sm font-bold text-neutral-700">Create a player profile, then find public groups to join.</p>
        </header>
        <PlayerSignupForm />
      </section>
    </main>
  );
}
