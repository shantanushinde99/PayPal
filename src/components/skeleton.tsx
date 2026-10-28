// Shown instantly while a page's data loads (loading.tsx). Mirrors the real layout so nothing jumps when it arrives.
const bar = "animate-pulse rounded-lg bg-slate-200/80";

export function PageSkeleton({ cards = 3, rows = 4, wide = false }: { cards?: number; rows?: number; wide?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 z-10 border-b border-line bg-white/90">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <div className={`${bar} size-8`} /><div className={`${bar} h-5 w-24`} />
          <div className="ml-auto hidden gap-3 md:flex">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`${bar} h-4 w-16`} />)}</div>
        </div>
      </div>
      <main className={`mx-auto w-full ${wide ? "max-w-[1400px]" : "max-w-5xl"} space-y-6 px-4 py-8`}>
        <div className="space-y-2"><div className={`${bar} h-8 w-56`} /><div className={`${bar} h-4 w-80 max-w-full`} /></div>
        {cards > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: cards }, (_, i) => <div key={i} className="rounded-xl border border-line bg-white p-5"><div className={`${bar} h-4 w-24`} /><div className={`${bar} mt-3 h-7 w-32`} /></div>)}
          </div>
        )}
        <div className="divide-y divide-line rounded-xl border border-line bg-white">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className={`${bar} size-10 shrink-0 rounded-full`} />
              <div className="flex-1 space-y-2"><div className={`${bar} h-4 w-2/3`} /><div className={`${bar} h-3 w-1/3`} /></div>
              <div className={`${bar} h-5 w-20`} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
