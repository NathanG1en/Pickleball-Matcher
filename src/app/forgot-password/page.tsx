import Link from "next/link";
import { ForgotPasswordForm } from "@/components/players/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
      <section className="relative w-full max-w-sm rounded-3xl border-[3px] border-black bg-[#FFFDF7] p-6 text-center shadow-[8px_8px_0px_0px_#000] sm:p-8">
        <Link
          href="/player-login"
          aria-label="Return to sign in"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black text-xl font-black hover:bg-[#fde047]"
        >
          ×
        </Link>
        <h1 className="mb-2 font-display text-3xl font-black uppercase">Forgot Password</h1>
        <p className="mb-6 text-sm font-bold text-neutral-700">
          Enter your username or email address and we&apos;ll send you a link to reset your password.
        </p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}

