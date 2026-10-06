import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-shell min-h-screen p-4 sm:p-6 flex items-center justify-center bg-slate-950 text-slate-100">
      <section className="home-card max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6" aria-labelledby="home-title">
        <p className="eyebrow text-xs uppercase font-extrabold tracking-widest text-emerald-400">
          Courtside Organizer
        </p>
        <h1 id="home-title" className="text-3xl sm:text-4xl font-black text-white leading-tight">
          Fair rounds.
          <br />
          Fresh partners.
        </h1>
        <p className="home-summary text-sm text-slate-400">
          Build balanced pickleball games without keeping the rotation in your head.
        </p>

        <div className="court-mark flex items-center justify-center gap-2 py-2" aria-hidden="true">
          <span className="w-12 h-1 bg-emerald-500 rounded-full" />
          <span className="w-3 h-1 bg-amber-400 rounded-full" />
          <span className="w-12 h-1 bg-emerald-500 rounded-full" />
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/setup"
            className="block w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-950/50 transition-colors"
          >
            Create Your Group →
          </Link>
          <p className="text-xs text-slate-500">
            For existing groups, open your group&apos;s private bookmark or link.
          </p>
        </div>
      </section>
    </main>
  );
}
