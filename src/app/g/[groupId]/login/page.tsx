import React from "react";
import Link from "next/link";
import { getActionRepository } from "@/app/actions/action-context";
import { LoginForm } from "@/components/auth/login-form";

export default async function GroupLoginPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const group = await getActionRepository().getGroup(groupId);

  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
      <div className="relative w-full max-w-sm bg-white border-[3px] border-black rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] text-center">
        <Link
          href="/"
          aria-label="Close sign in and return home"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-xl font-black leading-none hover:bg-[#fde047]"
        >
          ×
        </Link>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black mb-2">
          Organizer Sign In
        </h1>
        <p className="text-sm font-bold text-neutral-700 mb-6">
          Enter your organizer PIN to manage sessions.
        </p>

        <LoginForm initialGroupName={group?.name ?? ""} />

        <div className="mt-6 pt-4 border-t-2 border-neutral-100 text-xs font-bold text-neutral-600">
          <span>Are you a player? </span>
          <Link href="/player-login" className="font-black text-black underline">
            Sign in here
          </Link>
        </div>
      </div>
    </main>
  );
}
