import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen p-4 sm:p-8 flex items-center justify-center relative overflow-hidden">
      {/* Background decoration elements */}
      <div
        className="absolute top-8 left-8 w-24 h-24 rounded-full bg-[#fde047] border-2 border-black shadow-[4px_4px_0px_0px_#000] hidden md:block pointer-events-none -rotate-12"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-10 w-28 h-28 rounded-2xl bg-[#7dd3fc] border-2 border-black shadow-[5px_5px_0px_0px_#000] hidden md:block pointer-events-none rotate-6"
        aria-hidden="true"
      />

      <section
        className="relative max-w-lg w-full bg-white border-[3px] border-black rounded-3xl p-7 sm:p-10 shadow-[8px_8px_0px_0px_#000] text-center space-y-7 z-10"
        aria-labelledby="home-title"
      >
        {/* Eyebrow badge */}
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
            Pickleball Matchmaker
          </span>
        </div>

        {/* Big Bold Barlow Condensed Heading */}
        <div className="space-y-3">
          <h1
            id="home-title"
            className="font-display text-5xl sm:text-6xl font-black text-black tracking-tight leading-[0.9] uppercase"
          >
            FAIR ROUNDS.
            <br />
            <span className="inline-block mt-1 bg-[#ccff00] text-black px-3 py-0.5 border-2 border-black shadow-[3px_3px_0px_0px_#000] -rotate-1">
              FRESH PARTNERS.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-800 pt-2 font-medium leading-relaxed max-w-sm mx-auto">
            An elevated hands experienced.
          </p>
        </div>

        {/* Neobrutalist Court Divider */}
        <div className="flex items-center justify-center gap-3 py-1" aria-hidden="true">
          <div className="h-1 flex-1 bg-black rounded-full" />
          <div className="w-4 h-4 rounded-full bg-[#ccff00] border-2 border-black shadow-[1px_1px_0px_0px_#000]" />
          <div className="h-1 flex-1 bg-black rounded-full" />
        </div>

        {/* 3 Neobrutalist Feature Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
          <div className="p-3 rounded-xl bg-[#e0f2fe] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
            <div className="font-display text-base font-black text-black uppercase">Equal Sits</div>
            <div className="text-[11px] font-bold text-neutral-700">Even court time</div>
          </div>
          <div className="p-3 rounded-xl bg-[#fef08a] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
            <div className="font-display text-base font-black text-black uppercase">New Pairs</div>
            <div className="text-[11px] font-bold text-neutral-700">Partner variety</div>
          </div>
          <div className="p-3 rounded-xl bg-[#dcfce7] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
            <div className="font-display text-base font-black text-black uppercase">Fair Games</div>
            <div className="text-[11px] font-bold text-neutral-700">Rating balance</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4 pt-2">
          <Link
            href="/setup"
            className="block w-full py-4 px-6 rounded-2xl bg-[#ccff00] hover:bg-[#b8eb00] text-black font-black text-lg border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all text-center tracking-wide uppercase font-display"
          >
            Create Your Group →
          </Link>
          <p className="text-xs font-bold text-neutral-600">
            Returning organizer? Open your group&apos;s private bookmark or link.
          </p>
        </div>
      </section>
    </main>
  );
}
