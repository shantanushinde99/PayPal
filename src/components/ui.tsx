import type { ReactNode } from "react";
import { Ban, CheckCircle2, CircleDashed, Clock, Loader2, Lock, RotateCw, Scale, Wallet } from "lucide-react";
import type { MilestoneState } from "@/lib/milestone-state";

export const btn = {
  primary: "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60",
  paypal: "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-paypal px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#005ea6] disabled:opacity-60",
  secondary: "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas",
  danger: "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50",
};

export const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-slate-400 transition-colors focus:border-brand";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>{children}</div>;
}

const STATES: Record<MilestoneState, { label: string; tone: string; Icon: typeof Lock; spin?: boolean }> = {
  draft: { label: "Draft", tone: "bg-slate-100 text-slate-700", Icon: CircleDashed },
  funding: { label: "Awaiting payment", tone: "bg-sky-50 text-sky-800", Icon: Wallet },
  funded: { label: "Funded · on hold", tone: "bg-sky-100 text-sky-900", Icon: Lock },
  verifying: { label: "AI checking", tone: "bg-violet-100 text-violet-800", Icon: Loader2, spin: true },
  failed: { label: "Changes needed", tone: "bg-amber-100 text-amber-900", Icon: RotateCw },
  passed: { label: "Verified · review window", tone: "bg-emerald-50 text-emerald-800", Icon: Clock },
  disputed: { label: "In dispute", tone: "bg-orange-100 text-orange-900", Icon: Scale },
  paid_out: { label: "Paid", tone: "bg-emerald-600 text-white", Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "bg-slate-100 text-slate-500", Icon: Ban },
};

export function StatusBadge({ state }: { state: string }) {
  const s = STATES[state as MilestoneState] ?? STATES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>
      <s.Icon aria-hidden className={`size-3.5 ${s.spin ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
}
