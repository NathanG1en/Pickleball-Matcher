import { redirect } from "next/navigation";
import { getActionRepository } from "@/app/actions/action-context";
import { FinishGoogleSignupForm } from "@/components/players/finish-google-signup-form";
import { readPendingGoogleSignup } from "@/lib/auth/pending-google-signup";
import { suggestUsernameForEmail, usernameBaseFromEmail } from "@/lib/auth/social-sign-in";

export const dynamic = "force-dynamic";

function safeReturnPath(path: string | undefined): string | undefined {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : undefined;
}

/** "Finish your profile": shown once, after a first Google sign-in, before the account exists. */
export default async function FinishGoogleSignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const next = safeReturnPath((await searchParams)?.next);
  const pending = await readPendingGoogleSignup();
  if (!pending) {
    const login = new URLSearchParams({ error: "Your Google sign-in timed out. Please try again." });
    if (next) login.set("next", next);
    redirect(`/player-login?${login.toString()}`);
  }

  // If the availability check fails, suggest the plain name; submitting still rejects a taken one.
  const suggestedUsername = await suggestUsernameForEmail(getActionRepository(), pending.email).catch(() =>
    usernameBaseFromEmail(pending.email),
  );

  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border-[3px] border-black bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_0px_#000] sm:p-8">
        <header className="mb-6 space-y-1 text-center">
          <h1 className="font-display text-3xl font-black uppercase sm:text-4xl">Finish your profile</h1>
          <p className="text-sm font-bold text-neutral-700">
            Signed in with Google as{" "}
            <span className="font-black text-black [overflow-wrap:anywhere]">{pending.email}</span>
          </p>
        </header>
        <FinishGoogleSignupForm
          suggestedUsername={suggestedUsername}
          suggestedName={pending.name ?? ""}
          next={next}
        />
      </section>
    </main>
  );
}
