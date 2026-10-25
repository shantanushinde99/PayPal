"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { Bot, Check, CircleDollarSign, Globe, Loader2, Lock, RotateCw, User, X } from "lucide-react";

type Phase = "crawl" | "check" | "held" | "resubmit" | "recheck" | "paid";
type ItemState = "idle" | "checking" | "pass" | "fail";

type Step = [Phase, number]; // duration 0 = stop here and wait for the visitor
// Auto-play tells the whole story on repeat; the buttons let a visitor play the freelancer.
const AUTO: Step[] = [["crawl", 2800], ["check", 3400], ["held", 3000], ["resubmit", 1700], ["recheck", 1800], ["paid", 3600]];
const SUBMIT_V1: Step[] = [["crawl", 2400], ["check", 3400], ["held", 0]];
const SHIP_FIX: Step[] = [["resubmit", 1400], ["recheck", 1800], ["paid", 0]];
const PAGES = ["/", "/menu", "/about", "/contact"];
const ITEMS = ["Menu with prices", "Opening hours", "All links work", "Contact form works"];
const FAILING = 3;
const STEP_MS = 750;

const BADGE: Record<Phase, { label: string; tone: string; spin?: boolean }> = {
  crawl: { label: "Crawling site", tone: "bg-violet-100 text-violet-800", spin: true },
  check: { label: "AI checking", tone: "bg-violet-100 text-violet-800", spin: true },
  held: { label: "Changes needed", tone: "bg-amber-100 text-amber-900" },
  resubmit: { label: "Fix submitted", tone: "bg-sky-100 text-sky-900" },
  recheck: { label: "AI re-checking", tone: "bg-violet-100 text-violet-800", spin: true },
  paid: { label: "Paid", tone: "bg-emerald-600 text-white" },
};

function itemState(phase: Phase, i: number, revealed: number): ItemState {
  switch (phase) {
    case "crawl": return "idle";
    case "check": return i < revealed ? (i === FAILING ? "fail" : "pass") : i === revealed ? "checking" : "idle";
    case "held":
    case "resubmit": return i === FAILING ? "fail" : "pass";
    case "recheck": return i === FAILING ? "checking" : "pass";
    case "paid": return "pass";
  }
}

function ItemIcon({ state }: { state: ItemState }) {
  // key forces a fresh element per state, so each new icon pops in (no exit hand-off to get stuck)
  return (
    <motion.span
      key={state}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className={`grid size-6 shrink-0 place-items-center rounded-full ${
        state === "pass" ? "bg-emerald-500 text-white" : state === "fail" ? "bg-red-500 text-white" : state === "checking" ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-400"
      }`}
    >
      {state === "pass" && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
      {state === "fail" && <X aria-hidden className="size-3.5" strokeWidth={3} />}
      {state === "checking" && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
    </motion.span>
  );
}

const BANNER: Record<Phase, { tone: string; text: string }> = {
  crawl: { tone: "bg-slate-50 text-ink-soft", text: "Visiting every page and testing every link…" },
  check: { tone: "bg-violet-50 text-violet-900", text: "Comparing the live site against the agreed checklist…" },
  held: { tone: "bg-amber-50 text-amber-900", text: "Contact form is missing. Add it and resubmit — your $200 stays safely on hold." },
  resubmit: { tone: "bg-sky-50 text-sky-900", text: "The freelancer shipped a fix. Checking again…" },
  recheck: { tone: "bg-violet-50 text-violet-900", text: "Submitting the contact form with test data…" },
  paid: { tone: "bg-emerald-50 text-emerald-900", text: "All 4 requirements verified · $200 released to the freelancer." },
};

function MoneyFlow({ phase }: { phase: Phase }) {
  const at = phase === "paid" ? 2 : 1;
  const nodes = [
    { label: "Client", Icon: User },
    { label: "Held by PayPal", Icon: Lock },
    { label: "Freelancer", Icon: User },
  ];
  return (
    <LayoutGroup>
      <div className="relative grid grid-cols-3 items-start">
        <div aria-hidden className="absolute left-[16.6%] right-[16.6%] top-5 h-0.5 bg-line" />
        <motion.div
          aria-hidden
          className="absolute left-[16.6%] top-5 h-0.5 origin-left bg-emerald-500"
          style={{ width: "66.8%" }}
          animate={{ scaleX: phase === "paid" ? 1 : 0.5 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        {nodes.map(({ label, Icon }, i) => (
          <div key={label} className="relative flex flex-col items-center gap-1.5">
            <div className={`relative grid size-10 place-items-center rounded-full border-2 bg-white ${i <= at ? "border-emerald-500 text-emerald-600" : "border-line text-slate-400"}`}>
              <Icon aria-hidden className="size-4.5" />
              {i === at && (
                <motion.span
                  layoutId="coin"
                  className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-amber-400 text-amber-950 shadow-md"
                  transition={{ type: "spring", stiffness: 140, damping: 16 }}
                >
                  <CircleDollarSign aria-hidden className="size-4" />
                </motion.span>
              )}
            </div>
            <span className="text-xs font-medium text-ink-soft">{label}</span>
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}

export function HeroDemo() {
  const [run, setRun] = useState<{ seq: Step[]; i: number; loop: boolean }>({ seq: AUTO, i: 0, loop: true });
  const [revealed, setRevealed] = useState(0);
  const [phase, ms] = run.seq[run.i];

  useEffect(() => {
    if (!ms) return; // waiting for the visitor
    const t = setTimeout(() => {
      setRevealed(0);
      setRun((r) => (r.i + 1 < r.seq.length ? { ...r, i: r.i + 1 } : r.loop ? { ...r, i: 0 } : r));
    }, ms);
    return () => clearTimeout(t);
  }, [run, ms]);

  useEffect(() => {
    if (phase !== "check") return;
    const t = setInterval(() => setRevealed((r) => Math.min(r + 1, ITEMS.length)), STEP_MS);
    return () => clearInterval(t);
  }, [phase, run]);

  const play = (seq: Step[], loop = false) => { setRevealed(0); setRun({ seq, i: 0, loop }); };
  const manual = !run.loop;

  const badge = BADGE[phase];
  const version = phase === "resubmit" || phase === "recheck" || phase === "paid" ? "v2" : "v1";

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="Interactive demo: an AI checks a bakery website before releasing a $200 payment" className="relative">
        <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-sky-500/35 via-violet-500/15 to-emerald-400/30 blur-2xl" />
        <div className="overflow-hidden rounded-2xl border border-white/20 bg-white text-ink shadow-[0_30px_80px_-24px_rgba(56,189,248,0.45)]">
          <div className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-3">
            <span className="flex gap-1.5" aria-hidden><span className="size-2.5 rounded-full bg-red-300" /><span className="size-2.5 rounded-full bg-amber-300" /><span className="size-2.5 rounded-full bg-emerald-300" /></span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md bg-white px-2.5 py-1 text-xs text-ink-soft">
              <Globe aria-hidden className="size-3.5 shrink-0" /> sunrise-bakery.com
              <motion.span key={version} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="ml-1 rounded bg-slate-100 px-1 font-mono text-[10px]">{version}</motion.span>
            </span>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Bakery website · Milestone 1</p>
                <p className="text-sm text-ink-soft">$200 · funded via PayPal</p>
              </div>
              <AnimatePresence mode="wait">
                <motion.span
                  key={phase}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${badge.tone}`}
                >
                  {badge.spin ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : phase === "paid" ? <Check aria-hidden className="size-3.5" /> : phase === "held" ? <RotateCw aria-hidden className="size-3.5" /> : <Bot aria-hidden className="size-3.5" />}
                  {badge.label}
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap gap-1.5" aria-hidden>
              {PAGES.map((p, i) => (
                <motion.span
                  key={p}
                  initial={false}
                  animate={{ opacity: phase === "crawl" ? [0.3, 1] : 1, scale: phase === "crawl" ? [0.9, 1] : 1 }}
                  transition={{ delay: phase === "crawl" ? i * 0.45 : 0, duration: 0.3 }}
                  className="rounded-md bg-canvas px-2 py-1 font-mono text-[11px] text-ink-soft"
                >
                  {p} <span className="text-emerald-600">200</span>
                </motion.span>
              ))}
            </div>

            <ul className="space-y-2">
              {ITEMS.map((label, i) => {
                const s = itemState(phase, i, revealed);
                return (
                  <motion.li
                    key={label}
                    animate={s === "fail" && phase === "check" ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.45 }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-300 ${s === "fail" ? "bg-red-50" : s === "pass" ? "bg-emerald-50/60" : "bg-canvas"}`}
                  >
                    <ItemIcon state={s} />
                    <span className="flex-1">{label}</span>
                    <span className={`text-xs font-medium ${s === "fail" ? "text-red-700" : s === "pass" ? "text-emerald-700" : "text-ink-soft"}`}>
                      {s === "pass" ? "Verified" : s === "fail" ? "Missing" : s === "checking" ? "Checking" : "Queued"}
                    </span>
                  </motion.li>
                );
              })}
            </ul>

            <div className="min-h-[3.25rem]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phase}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  aria-live="polite"
                  className={`rounded-lg px-3 py-2.5 text-sm ${BANNER[phase].tone}`}
                >
                  {BANNER[phase].text}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="border-t border-line pt-4">
              <MoneyFlow phase={phase} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-1 font-medium text-slate-300">Try it, you&apos;re the freelancer:</span>
          <button onClick={() => play(SUBMIT_V1)} className="min-h-10 cursor-pointer rounded-full border border-white/20 bg-white/10 px-4 font-semibold text-white transition-colors hover:bg-white/20">1 · Submit v1</button>
          <motion.button
            onClick={() => play(SHIP_FIX)}
            disabled={!(manual && phase === "held")}
            animate={manual && phase === "held"
              ? { boxShadow: ["0 0 0 0 rgba(52,211,153,0.6)", "0 0 0 10px rgba(52,211,153,0)"] }
              : { boxShadow: "0 0 0 0 rgba(52,211,153,0)" }}
            transition={{ repeat: manual && phase === "held" ? Infinity : 0, duration: 1.4 }}
            className="min-h-10 cursor-pointer rounded-full bg-emerald-500 px-4 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
          >2 · Ship the fix</motion.button>
          {manual && <button onClick={() => play(AUTO, true)} className="min-h-10 cursor-pointer rounded-full px-3 font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">Auto-play</button>}
        </div>
      </section>
    </MotionConfig>
  );
}
