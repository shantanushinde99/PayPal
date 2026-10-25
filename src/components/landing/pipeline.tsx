"use client";
import { MotionConfig, motion } from "motion/react";
import { Bot, CircleDollarSign, FileCheck2, Lock, Wallet } from "lucide-react";

const STEPS = [
  { Icon: FileCheck2, title: "Agree on “done”", text: "Describe the job in plain words. AI drafts milestones and a checklist that both sides can verify, and flags anything too vague." },
  { Icon: Lock, title: "Fund the milestone", text: "The client pays with PayPal. The money is authorized and held: the freelancer can see it's there, nobody can move it." },
  { Icon: Bot, title: "AI verifies the proof", text: "The freelancer submits a live site or before/after photos. An AI agent crawls every page, tests links and forms, and cites evidence." },
  { Icon: Wallet, title: "Released automatically", text: "Every item passes → PayPal releases the payment at once. Something missing → it stays on hold with a clear list of fixes." },
];
const STEP_S = 0.7;

export function Pipeline() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.ol
        className="relative grid gap-6 md:grid-cols-4 md:gap-5"
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, amount: 0.35 }}
      >
        {/* connector + travelling payment (desktop) */}
        <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-1 rounded-full bg-line md:block">
          <motion.div
            className="h-full origin-left rounded-full bg-gradient-to-r from-brand via-violet-500 to-emerald-500"
            variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1, transition: { duration: STEP_S * 3, ease: "easeInOut", delay: 0.3 } } }}
          />
          <motion.span
            className="absolute -top-2.5 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-amber-400 text-amber-950 shadow-lg"
            variants={{ hidden: { left: "0%" }, shown: { left: ["0%", "33.3%", "66.6%", "100%"], transition: { duration: STEP_S * 3, ease: "easeInOut", delay: 0.3, times: [0, 0.33, 0.66, 1] } } }}
          >
            <CircleDollarSign className="size-4" />
          </motion.span>
        </div>

        {STEPS.map(({ Icon, title, text }, i) => (
          <motion.li
            key={title}
            className="relative flex gap-4 md:flex-col md:items-center md:text-center"
            variants={{ hidden: { opacity: 0, y: 20 }, shown: { opacity: 1, y: 0, transition: { delay: 0.3 + i * STEP_S, duration: 0.45 } } }}
          >
            <motion.span
              className="relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-white text-brand shadow-sm"
              variants={{ hidden: { scale: 0.8 }, shown: { scale: [0.8, 1.12, 1], transition: { delay: 0.3 + i * STEP_S, duration: 0.5 } } }}
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
      </motion.ol>
    </MotionConfig>
  );
}
