import { BadgeCheck, CheckCircle2, Lock, Undo2 } from "lucide-react";
import type { PaymentItem } from "@/lib/payment-history";
import { captureStatus } from "@/lib/paypal";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui";
import { CopyId } from "@/components/copy-id";

const TONE = {
  held: { Icon: Lock, circle: "bg-sky-100 text-sky-700", amount: "text-ink", chip: "bg-sky-50 text-sky-800" },
  done: { Icon: CheckCircle2, circle: "bg-emerald-100 text-emerald-700", amount: "text-emerald-700", chip: "bg-emerald-50 text-emerald-800" },
  returned: { Icon: Undo2, circle: "bg-slate-100 text-slate-600", amount: "text-slate-600", chip: "bg-slate-100 text-slate-700" },
};

const when = (d: Date) => d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Google Pay–style history. Completed payments are re-checked with PayPal for a "Confirmed" badge.
export async function PaymentsList({ items, showJob = false, empty }: { items: PaymentItem[]; showJob?: boolean; empty: string }) {
  if (!items.length) return <Card className="p-6 text-center text-ink-soft">{empty}</Card>;
  const confirmed = await Promise.all(items.map((p) => (p.kind === "paid" || p.kind === "captured" ? captureStatus(p.paypalId) : null)));
  return (
    <Card>
      <ul className="divide-y divide-line">
        {items.map((p, i) => {
          const t = TONE[p.view.tone];
          return (
            <li key={p.id} className="flex items-start gap-3 p-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${t.circle}`}><t.Icon aria-hidden className="size-5" /></span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-semibold">{p.view.title}</p>
                <p className="truncate text-sm text-ink-soft">{showJob ? `${p.jobTitle} · ` : ""}{p.milestoneTitle} · {when(p.createdAt)}</p>
                <div className="flex flex-wrap items-center gap-x-2">
                  <CopyId value={p.paypalId} />
                  {confirmed[i] === "COMPLETED" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck aria-hidden className="size-3.5" /> Confirmed by PayPal</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`font-display text-lg font-bold tabular-nums ${t.amount}`}>{p.view.sign}{formatMoney(p.amountMinor, p.currency)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.chip}`}>{p.view.status}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
