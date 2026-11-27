import Link from "next/link";
import { PlayerLoginForm } from "@/components/players/player-login-form";
import { getActionRepository } from "@/app/actions/action-context";

/** When the return path points into a group, name it so a shared link keeps its context. */
async function groupForReturnPath(next: string | undefined): Promise<{ id: string; name: string } | null> {
  const match = next?.match(/^\/g\/([A-Za-z0-9_-]+)(?:\/|$)/);
  if (!match || next!.includes("//")) return null;
  try {
    const group = await getActionRepository().getGroup(match[1]!);
    return group ? { id: group.id, name: group.name } : null;
  } catch {
    return null;
  }
}

export default async function PlayerLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next;
  const error = params?.error;
  const group = await groupForReturnPath(next);
  const joinHref = group ? `/g/${group.id}/join?next=${encodeURIComponent(next!)}` : null;

  return (
    // Centers the card vertically and horizontally across the viewport without navigation clutter or scroll overflow.
    <main data-fill-screen className="flex flex-1 items-center justify-center min-h-[100svh] p-4 sm:p-6">
      <section className="relative my-auto w-full max-w-sm rounded-3xl border-[3px] border-black bg-[#FFFDF7] p-6 text-center shadow-[8px_8px_0px_0px_#000] sm:p-8">
        <Link href="/" aria-label="Return home" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black text-xl font-black hover:bg-[#fde047]">×</Link>
        <h1 className="mb-2 font-display text-3xl font-black uppercase">Player Sign In</h1>
        {group ? (
          <p data-testid="login-group-context" className="mb-6 text-sm font-bold text-neutral-700">
            Sign in to open <span className="font-black text-black">{group.name}</span>.
          </p>
        ) : (
          <p className="mb-6 text-sm font-bold text-neutral-700">Sign in to see your groups and match history.</p>
        )}
        <PlayerLoginForm initialError={error} initialNext={next} />
        {joinHref && (
          <Link
            href={joinHref}
            data-testid="login-join-group-link"
            className="mt-5 flex min-h-11 items-center justify-center rounded-xl border-2 border-dashed border-black px-3 text-sm font-bold text-black hover:bg-[#ccff00]"
          >
            Not in this group yet? Join as a guest →
          </Link>
        )}
      </section>
    </main>
  );
}
