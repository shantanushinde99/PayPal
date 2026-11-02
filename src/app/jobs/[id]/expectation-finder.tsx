"use client";
import { useState, useTransition } from "react";
import { Loader2, SearchCheck } from "lucide-react";
import type { Expectation } from "@/lib/expectations";
import { btn } from "@/components/ui";

type Find = () => Promise<{ items?: Expectation[]; error?: string }>;
type Apply = (add: string[], excluded: string[]) => Promise<{ error?: string }>;

// Before paying: the AI lists what clients usually assume is included. Ticked items join the checklist;
// the rest is written down as "not included", so nobody argues about it later.
export function ExpectationFinder({ find, apply }: { find: Find; apply: Apply }) {
  const [items, setItems] = useState<Expectation[] | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  const run = () => start(async () => {
    setError("");
    const r = await find();
    if (r.error) setError(r.error);
    else { setItems(r.items ?? []); setTicked(new Set()); }
  });
  const save = () => start(async () => {
    const list = items ?? [];
    const r = await apply(list.filter((_, i) => ticked.has(i)).map((x) => x.item), list.filter((_, i) => !ticked.has(i)).map((x) => x.item));
    if (r.error) setError(r.error); else setItems(null);
  });

  return (
    <section aria-label="Find what's missing" className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl space-y-0.5">
          <p className="flex items-center gap-2 font-semibold text-violet-950"><SearchCheck aria-hidden className="size-4" /> Did you forget anything?</p>
          <p className="text-sm text-violet-900">Clients often assume things are included and never write them down. The AI lists what people usually expect for this kind of job, so you can decide now, before paying.</p>
        </div>
        {!items && (
          <button type="button" onClick={run} disabled={busy} className={btn.secondary}>
            {busy ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Looking…</> : "Find what's missing"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {items && items.length === 0 && <p className="text-sm text-violet-900">Nothing obvious is missing: the checklist already covers what clients usually expect.</p>}
      {items && items.length > 0 && (
        <div className="space-y-3">
          <ul className="space-y-2">
            {items.map((x, i) => (
              <li key={x.item}>
                <label className="flex cursor-pointer gap-3 rounded-lg bg-white px-3 py-2.5">
                  <input type="checkbox" className="mt-1 size-4 shrink-0 accent-violet-700" checked={ticked.has(i)}
                    onChange={() => setTicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                  <span className="min-w-0"><span className="block font-medium">{x.item}</span><span className="block text-sm text-ink-soft">{x.why}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-sm text-violet-900">Ticked items are added to the checklist. The others are written down as <b>not included</b>, which the freelancer sees before accepting.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={busy} className={btn.primary}>
              {busy ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Saving…</> : `Add ${ticked.size} to checklist`}
            </button>
            <button type="button" onClick={() => setItems(null)} disabled={busy} className={btn.secondary}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
