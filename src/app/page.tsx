import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Subtle court background grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      {/* Radial glow accent in background */}
      <div 
        className="absolute w-96 h-96 -top-24 -left-24 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute w-96 h-96 -bottom-24 -right-24 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />

      <section 
        className="relative max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-xl text-center space-y-7"
        aria-labelledby="home-title"
      >
        {/* Eyebrow badge */}
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Courtside Organizer
          </span>
        </div>

        {/* Big Athletic Heading */}
        <div className="space-y-1">
          <h1 
            id="home-title" 
            className="font-display text-5xl sm:text-6xl font-black text-white tracking-tight leading-[0.92] uppercase"
          >
            Fair Rounds.
            <br />
            <span className="text-emerald-400">Fresh Partners.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 pt-3 leading-relaxed max-w-xs mx-auto">
            Build balanced pickleball rotations automatically — without keeping the math in your head.
          </p>
        </div>

        {/* Athletic Court Element: Pickleball Court Mark */}
        <div className="flex flex-col items-center justify-center gap-1.5 py-1" aria-hidden="true">
          <div className="flex items-center justify-center gap-2">
            <div className="w-16 h-1 rounded-full bg-emerald-500/80" />
            <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 bg-amber-400/20" />
            <div className="w-16 h-1 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
            Smart Rotation Engine
          </span>
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <div className="text-xs font-bold text-white">Equal Sits</div>
            <div className="text-[10px] text-slate-400">Even play time</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <div className="text-xs font-bold text-white">New Pairs</div>
            <div className="text-[10px] text-slate-400">Partner variety</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <div className="text-xs font-bold text-white">Competitive</div>
            <div className="text-[10px] text-slate-400">Rating balance</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3.5 pt-1">
          <Link
            href="/setup"
            className="block w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-emerald-950/60 transition-all text-center tracking-wide"
          >
            Create Your Group →
          </Link>
          <p className="text-xs text-slate-400">
            Returning organizer? Open your group&apos;s private bookmark or link.
          </p>
        </div>
      </section>
    </main>
  );
}
