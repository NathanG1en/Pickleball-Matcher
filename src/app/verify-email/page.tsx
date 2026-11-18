import Link from "next/link";
import { getActivePlayerAccountId } from "@/app/actions/action-context";
import { VerifyEmailView } from "@/components/players/verify-email-view";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; email?: string }>;
}) {
  const resolved = await searchParams;
  const token = resolved?.token;
  const email = resolved?.email;
  // Resending needs the signed-in account; a signed-out visitor only gets the code form.
  const canResend = Boolean(await getActivePlayerAccountId().catch(() => null));

  return (
    // Fills exactly the space under the navigation (and above the phone tab bar), so the card sits
    // in the middle of what's visible and the page doesn't scroll the code boxes away. Only a screen
    // too short for the card (a phone in landscape) scrolls, just enough to reach it.
    <main data-fill-screen className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <section className="relative w-full max-w-sm rounded-3xl border-[3px] border-black bg-[#FFFDF7] p-6 text-center shadow-[8px_8px_0px_0px_#000] sm:p-8">
        <Link
          href="/"
          aria-label="Return home"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black text-xl font-black hover:bg-[#fde047]"
        >
          ×
        </Link>
        <VerifyEmailView token={token} email={email} canResend={canResend} />
      </section>
    </main>
  );
}

