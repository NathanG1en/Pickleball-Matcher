import Link from "next/link";
import { VerifyEmailView } from "@/components/players/verify-email-view";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; email?: string }>;
}) {
  const resolved = await searchParams;
  const token = resolved?.token;
  const email = resolved?.email;

  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
      <section className="relative w-full max-w-sm rounded-3xl border-[3px] border-black bg-[#FFFDF7] p-6 text-center shadow-[8px_8px_0px_0px_#000] sm:p-8">
        <Link
          href="/"
          aria-label="Return home"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black text-xl font-black hover:bg-[#fde047]"
        >
          ×
        </Link>
        <h1 className="mb-2 font-display text-2xl sm:text-3xl font-black uppercase text-black">
          Verify Email
        </h1>
        <VerifyEmailView token={token} email={email} />
      </section>
    </main>
  );
}

