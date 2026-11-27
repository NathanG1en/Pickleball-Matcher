"use client";

import { useState } from "react";
import Link from "next/link";
import { neonAuthClient } from "@/lib/auth/neon-client";
import { checkNeonServerSessionAction } from "./actions";

export default function NeonAuthTestPage() {
  const session = neonAuthClient.useSession();
  const [activeTab, setActiveTab] = useState<"signup" | "verify" | "signin">("signup");

  // Signup form
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpMessage, setSignUpMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // OTP Verification form
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyOtp, setVerifyOtp] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Signin form
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInMessage, setSignInMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Server action check
  const [serverSessionResult, setServerSessionResult] = useState<string | null>(null);
  const [serverCheckLoading, setServerCheckLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpLoading(true);
    setSignUpMessage(null);

    try {
      const res = await neonAuthClient.signUp.email({
        email: signUpEmail.trim(),
        password: signUpPassword,
        name: signUpName.trim(),
      });

      if (res.error) {
        setSignUpMessage({ type: "error", text: res.error.message || "Failed to sign up with Neon Auth." });
      } else {
        setSignUpMessage({
          type: "success",
          text: `Account created! Neon dispatched a verification OTP code to ${signUpEmail}. Check your inbox!`,
        });
        setVerifyEmail(signUpEmail.trim());
        setActiveTab("verify");
      }
    } catch (err) {
      setSignUpMessage({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyMessage(null);

    try {
      const res = await neonAuthClient.emailOtp.verifyEmail({
        email: verifyEmail.trim(),
        otp: verifyOtp.trim(),
      });

      if (res.error) {
        setVerifyMessage({ type: "error", text: res.error.message || "Invalid or expired OTP code." });
      } else {
        setVerifyMessage({
          type: "success",
          text: `Email verified successfully! Session established for ${verifyEmail}.`,
        });
      }
    } catch (err) {
      setVerifyMessage({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!verifyEmail.trim()) {
      setVerifyMessage({ type: "error", text: "Please enter your email to resend OTP." });
      return;
    }
    setVerifyLoading(true);
    setVerifyMessage(null);

    try {
      const res = await neonAuthClient.emailOtp.sendVerificationOtp({
        email: verifyEmail.trim(),
        type: "email-verification",
      });

      if (res.error) {
        setVerifyMessage({ type: "error", text: res.error.message || "Failed to send OTP code." });
      } else {
        setVerifyMessage({ type: "success", text: `New OTP code dispatched to ${verifyEmail}!` });
      }
    } catch (err) {
      setVerifyMessage({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);
    setSignInMessage(null);

    try {
      const res = await neonAuthClient.signIn.email({
        email: signInEmail.trim(),
        password: signInPassword,
      });

      if (res.error) {
        setSignInMessage({ type: "error", text: res.error.message || "Invalid email or password." });
      } else {
        setSignInMessage({ type: "success", text: "Signed in successfully!" });
      }
    } catch (err) {
      setSignInMessage({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignOut = async () => {
    await neonAuthClient.signOut();
    setServerSessionResult(null);
  };

  const checkServerSession = async () => {
    setServerCheckLoading(true);
    const result = await checkNeonServerSessionAction();
    setServerSessionResult(JSON.stringify(result, null, 2));
    setServerCheckLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#FDFBF7] p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#00E599] motion-safe:animate-pulse" />
              <span className="text-xs font-bold text-neutral-600">
                Evaluation Environment
              </span>
            </div>
            <h1 className="font-display text-3xl font-black uppercase text-black">
              Neon Auth Test Bench
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-xl border-2 border-black bg-white px-3 py-1.5 text-sm font-bold hover:bg-neutral-100"
          >
            ← Back Home
          </Link>
        </div>

        {/* Configuration Overview Card */}
        <div className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] text-xs space-y-1.5">
          <div className="font-bold text-black text-sm flex items-center justify-between">
            <span>Neon Branch & Auth Settings</span>
            <span className="rounded bg-black text-[#00E599] px-2 py-0.5 text-xs font-black">
              LIVE BRANCH: test
            </span>
          </div>
          <p className="text-neutral-700">
            <span className="font-bold">Project:</span> db-pickleball (<code>restless-bird-03105578</code>)
          </p>
          <p className="text-neutral-700">
            <span className="font-bold">Email Sender:</span> <code>auth@mail.myneon.app</code> (Neon Shared Mailer)
          </p>
          <p className="text-neutral-700">
            <span className="font-bold">Verification:</span> OTP Numeric Code (6 digits sent to your real inbox)
          </p>
        </div>

        {/* Live Session State Card */}
        <div className="rounded-2xl border-[3px] border-black bg-[#CCFF00] p-4 shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-black uppercase text-black">
              Active Neon Auth Session
            </h2>
            {session.data?.user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border-2 border-black bg-white px-2.5 py-1 text-sm font-bold shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100"
              >
                Sign Out
              </button>
            )}
          </div>
          {session.isPending ? (
            <p className="mt-2 text-xs font-bold text-neutral-800">Checking session…</p>
          ) : session.data?.user ? (
            <div className="mt-2 space-y-1 text-xs font-bold text-black bg-white/80 rounded-xl p-3 border-2 border-black">
              <p>
                <span className="font-black">User ID:</span> <code>{session.data.user.id}</code>
              </p>
              <p>
                <span className="font-black">Email:</span> {session.data.user.email} (
                {session.data.user.emailVerified ? (
                  <span className="text-emerald-700 font-black">✓ Verified</span>
                ) : (
                  <span className="text-amber-700 font-black">⚠ Unverified</span>
                )}
                )
              </p>
              <p>
                <span className="font-black">Name:</span> {session.data.user.name || "N/A"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs font-bold text-neutral-800">
              No active Neon Auth session. Sign up or sign in below.
            </p>
          )}
        </div>

        {/* Interactive Tabs */}
        <div className="rounded-3xl border-[3px] border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]">
          <div className="flex border-b-2 border-black pb-3 mb-6 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("signup")}
              className={`rounded-xl border-2 border-black px-3 py-1.5 text-sm font-bold transition-colors ${
                activeTab === "signup" ? "bg-[#CCFF00] shadow-[2px_2px_0px_0px_#000]" : "bg-white hover:bg-neutral-100"
              }`}
            >
              1. Sign Up (Send Real Email)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("verify")}
              className={`rounded-xl border-2 border-black px-3 py-1.5 text-sm font-bold transition-colors ${
                activeTab === "verify" ? "bg-[#CCFF00] shadow-[2px_2px_0px_0px_#000]" : "bg-white hover:bg-neutral-100"
              }`}
            >
              2. Enter OTP Code
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("signin")}
              className={`rounded-xl border-2 border-black px-3 py-1.5 text-sm font-bold transition-colors ${
                activeTab === "signin" ? "bg-[#CCFF00] shadow-[2px_2px_0px_0px_#000]" : "bg-white hover:bg-neutral-100"
              }`}
            >
              3. Sign In
            </button>
          </div>

          {/* TAB 1: SIGN UP */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  placeholder="Nathan Glen"
                  className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#CCFF00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Your Real Email Address
                </label>
                <input
                  type="email"
                  required
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#CCFF00]"
                />
                <p className="mt-1 text-xs font-bold text-neutral-600">
                  Neon Auth will send a real 6-digit verification code to this inbox.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#CCFF00]"
                />
              </div>

              <button
                type="submit"
                disabled={signUpLoading}
                className="w-full rounded-xl border-2 border-black bg-[#CCFF00] py-2.5 text-sm font-bold shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8e600] disabled:opacity-50"
              >
                {signUpLoading ? "Contacting Neon Auth…" : "Sign Up & Send Code →"}
              </button>

              {signUpMessage && (
                <div
                  className={`rounded-xl border-2 p-3 text-xs font-bold ${
                    signUpMessage.type === "success"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-red-600 bg-red-50 text-red-900"
                  }`}
                >
                  {signUpMessage.text}
                </div>
              )}
            </form>
          )}

          {/* TAB 2: VERIFY OTP */}
          {activeTab === "verify" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={verifyEmail}
                  onChange={(e) => setVerifyEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#CCFF00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  required
                  value={verifyOtp}
                  onChange={(e) => setVerifyOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full rounded-xl border-2 border-black px-3 py-2 text-center text-xl font-mono font-black tracking-widest shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#CCFF00]"
                />
                <p className="mt-1 text-xs font-bold text-neutral-600">
                  Check the inbox of {verifyEmail || "your email"} for the code from <code>auth@mail.myneon.app</code>.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={verifyLoading}
                  className="flex-1 rounded-xl border-2 border-black bg-[#CCFF00] py-2.5 text-sm font-bold shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8e600] disabled:opacity-50"
                >
                  {verifyLoading ? "Verifying…" : "Confirm Code →"}
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={verifyLoading}
                  className="rounded-xl border-2 border-black bg-white px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0px_0px_#000] hover:bg-neutral-100 disabled:opacity-50"
                >
                  Resend Code
                </button>
              </div>

              {verifyMessage && (
                <div
                  className={`rounded-xl border-2 p-3 text-xs font-bold ${
                    verifyMessage.type === "success"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-red-600 bg-red-50 text-red-900"
                  }`}
                >
                  {verifyMessage.text}
                </div>
              )}
            </form>
          )}

          {/* TAB 3: SIGN IN */}
          {activeTab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#CCFF00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#CCFF00]"
                />
              </div>

              <button
                type="submit"
                disabled={signInLoading}
                className="w-full rounded-xl border-2 border-black bg-[#CCFF00] py-2.5 text-sm font-bold shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8e600] disabled:opacity-50"
              >
                {signInLoading ? "Signing In…" : "Sign In →"}
              </button>

              {signInMessage && (
                <div
                  className={`rounded-xl border-2 p-3 text-xs font-bold ${
                    signInMessage.type === "success"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-red-600 bg-red-50 text-red-900"
                  }`}
                >
                  {signInMessage.text}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Server-Side Session Verification Card */}
        <div className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xs font-black uppercase text-black">
              Server-Side Session Test (Next.js Server Action)
            </h3>
            <button
              type="button"
              onClick={checkServerSession}
              disabled={serverCheckLoading}
              className="rounded-lg border-2 border-black bg-[#CCFF00] px-3 py-1 text-sm font-bold shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8e600] disabled:opacity-50"
            >
              {serverCheckLoading ? "Querying Server…" : "Check Server Session"}
            </button>
          </div>
          <p className="text-xs font-bold text-neutral-600">
            Calls <code>neonAuth.getSession()</code> on the server to verify cookies are securely parsed by Server Components and Actions.
          </p>
          {serverSessionResult && (
            <pre className="rounded-xl border-2 border-neutral-300 bg-neutral-900 p-3 text-xs font-mono text-emerald-400 overflow-x-auto">
              {serverSessionResult}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
