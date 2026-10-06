import React from "react";
import { LoginForm } from "@/components/auth/login-form";

export default async function GroupLoginPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center">
        <p className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 mb-1">
          Pickleball Matchmaker
        </p>
        <h1 className="text-2xl font-black text-white mb-2">Organizer Sign In</h1>
        <p className="text-sm text-slate-400 mb-6">
          Enter your organizer PIN to manage sessions.
        </p>

        <LoginForm groupId={groupId} />
      </div>
    </main>
  );
}
