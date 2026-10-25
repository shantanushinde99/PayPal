import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Hourglass, Lock, ReceiptText, ShieldCheck, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { loadPaymentsForUser, type PaymentItem } from "@/lib/payment-history";
import { walletSummary } from "@/lib/wallet";
import { formatMoney } from "@/lib/money";
import { Header } from "@/components/header";
import { PaymentsList } from "@/components/payments-list";

const FILTERS = {
  all: { label: "All", keep: () => true },
  in: { label: "Received", keep: (p: PaymentItem) => p.view.sign === "+" && p.kind !== "void" },
  out: { label: "Paid", keep: (p: PaymentItem) => p.view.sign === "-" && p.kind !== "hold" },
  held: { label: "On hold", keep: (p: PaymentItem) => p.view.status === "Held" },
  released: { label: "Released", keep: (p: PaymentItem) => p.kind === "void" },
} as const;
type Filter = keyof typeof FILTERS;

// ponytail: day headings use the server timezone (row times are local to the viewer); move grouping client-side if users span far timezones.
function dayLabel(d: Date) {
  const today = new Date(); const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default async function Wallet({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await requireUser();
  const f = ((await searchParams).f ?? "all") as Filter;
  const filter = FILTERS[f] ?? FILTERS.all;
  const all = await loadPaymentsForUser(user);
  const totals = walletSummary(all);
  const main = totals.find((t) => t.currency === "USD") ?? totals[0];
  const shown = all.filter(filter.keep);
  const days = [...new Set(shown.map((p) => dayLabel(p.createdAt)))];

  const stats = main ? [
    { label: "Incoming (held for you)", value: main.incoming, Icon: Hourglass },
    { label: "Your money on hold", value: main.onHoldMine, Icon: Lock },
    { label: "Released back to you", value: main.released, Icon: Undo2 },
  ] : [];

  return (
    <>
      <Header email={user.email} />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="text-ink-soft">Every PayPal movement on your Verifund jobs, with its transaction ID.</p>
        </div>

        <section aria-label="Balance summary" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-night via-[#0b2447] to-brand p-6 text-white shadow-[0_24px_60px_-24px_rgba(3,105,161,0.6)] md:p-8">
          <div aria-hidden className="absolute -right-16 -top-16 size-64 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-sky-200">Linked PayPal account</p>
                <p className="break-all font-semibold">{user.email}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold"><ShieldCheck aria-hidden className="size-4 text-emerald-300" /> Verified via Log in with PayPal</span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm text-sky-200"><ArrowDownLeft aria-hidden className="size-4" /> Received</p>
                <p className="font-display text-4xl font-bold tabular-nums md:text-5xl">{formatMoney(main?.received ?? 0, main?.currency ?? "USD")}</p>
              </div>
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm text-sky-200"><ArrowUpRight aria-hidden className="size-4" /> Paid out</p>
                <p className="font-display text-4xl font-bold tabular-nums md:text-5xl">{formatMoney(main?.paid ?? 0, main?.currency ?? "USD")}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {stats.map(({ label, value, Icon }) => (
                <div key={label} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="inline-flex items-center gap-1.5 text-xs text-sky-100"><Icon aria-hidden className="size-3.5" />{label}</p>
                  <p className="text-xl font-bold tabular-nums">{formatMoney(value, main!.currency)}</p>
                </div>
              ))}
            </div>
            {totals.length > 1 && (
              <ul className="space-y-1 border-t border-white/15 pt-4 text-sm text-sky-100">
                {totals.filter((t) => t !== main).map((t) => (
                  <li key={t.currency}>{t.currency}: received {formatMoney(t.received, t.currency)} · paid {formatMoney(t.paid, t.currency)} · on hold {formatMoney(t.onHoldMine + t.incoming, t.currency)}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <nav aria-label="Filter transactions" className="flex flex-wrap gap-2">
          {(Object.keys(FILTERS) as Filter[]).map((key) => (
            <Link key={key} href={key === "all" ? "/wallet" : `/wallet?f=${key}`} aria-current={key === f ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${key === f ? "bg-ink text-white" : "border border-line bg-white text-ink-soft hover:text-ink"}`}>
              {FILTERS[key].label}
            </Link>
          ))}
        </nav>

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-10 text-center text-ink-soft">
            <ReceiptText aria-hidden className="mx-auto mb-2 size-8" />
            {all.length ? "No transactions match this filter." : "No transactions yet. Funded milestones, payments and released holds will appear here."}
          </div>
        ) : (
          days.map((day) => (
            <section key={day} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{day}</h2>
              <PaymentsList items={shown.filter((p) => dayLabel(p.createdAt) === day)} showJob empty="" />
            </section>
          ))
        )}
        <p className="text-xs text-ink-soft">Payments marked “Confirmed by PayPal” were checked live with PayPal. Sandbox demo: no real money moves.</p>
      </main>
    </>
  );
}
