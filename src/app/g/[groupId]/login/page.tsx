import React from "react";
import { LoginForm } from "@/components/auth/login-form";

export default async function GroupLoginPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white border-[3px] border-black rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] text-center">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_0px_#000] mb-3">
          Pickleball Matchmaker
        </span>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black mb-2">
          Organizer Sign In
        </h1>
        <p className="text-sm font-bold text-neutral-700 mb-6">
          Enter your organizer PIN to manage sessions.
        </p>

        <LoginForm groupId={groupId} />
      </div>
    </main>
  );
}
