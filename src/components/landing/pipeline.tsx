"use client";
import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion, useInView } from "motion/react";
import { Bot, CircleDollarSign, FileCheck2, Lock, Wallet } from "lucide-react";

const STEPS = [
  { Icon: FileCheck2, title: "Agree on “done”", text: "Describe the job in plain words. AI drafts milestones and a checklist that both sides can verify, and flags anything too vague." },
  { Icon: Lock, title: "Fund the milestone", text: "The client pays with PayPal. The money is authorized and held: the freelancer can see it's there, nobody can move it." },
  { Icon: Bot, title: "AI verifies the proof", text: "The freelancer submits a live site or before/after photos. An AI agent crawls every page, tests links and forms, and cites evidence." },
  { Icon: Wallet, title: "Released automatically", text: "Every item passes → PayPal releases the payment at once. Something missing → it stays on hold with a clear list of fixes." },
];
const STEP_S = 0.7;
const START_S = 0.3;
const REPLAY_MS = 10_000; // how often the payment run replays while the section is on screen

// Remounted every cycle (key), so the line, coin and step pulses play again from the start.
function Run({ steps }: { steps: number }) {
  const travel = { duration: STEP_S * (steps - 1), ease: "easeInOut" as const, delay: START_S };
  return (
    <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-1 rounded-full bg-line md:block">
      <motion.div
        className="h-full origin-left rounded-full bg-gradient-to-r from-brand via-violet-500 to-emerald-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={travel}
      />
      <motion.span
        className="absolute -top-2.5 z-20 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-amber-400 text-amber-950 shadow-lg"
        initial={{ left: "0%" }}
        animate={{ left: ["0%", "33.3%", "66.6%", "100%"] }}
        transition={{ ...travel, times: [0, 0.33, 0.66, 1] }}
      >
        <CircleDollarSign className="size-4" />
      </motion.span>
    </div>
  );
}

export function Pipeline() {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [cycle, setCycle] = useState(0);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const first = setTimeout(() => setSeen(true), 0);
    const t = setInterval(() => setCycle((c) => c + 1), REPLAY_MS);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [inView]);

  return (
    <MotionConfig reducedMotion="user">
      <ol ref={ref} className="relative grid gap-6 md:grid-cols-4 md:gap-5">
        {seen && <Run key={cycle} steps={STEPS.length} />}
        {STEPS.map(({ Icon, title, text }, i) => (
          <motion.li
            key={title}
            className="relative flex gap-4 md:flex-col md:items-center md:text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={seen ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: START_S + i * STEP_S, duration: 0.45 }}
          >
            <motion.span
              key={cycle}
              className="relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-white text-brand shadow-sm"
              initial={{ scale: 1 }}
              animate={seen ? { scale: [1, 1.15, 1], boxShadow: ["0 0 0 0 rgba(3,105,161,0)", "0 0 0 8px rgba(3,105,161,0.15)", "0 0 0 0 rgba(3,105,161,0)"] } : undefined}
              transition={{ delay: START_S + i * STEP_S, duration: 0.6 }}
            >
              <Icon aria-hidden className="size-6" />
              <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
            </motion.span>
            <div className="space-y-1.5 md:px-2">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="leading-relaxed text-ink-soft">{text}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </MotionConfig>
  );
}
