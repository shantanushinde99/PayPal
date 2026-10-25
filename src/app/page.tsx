import Link from "next/link";
import { inArray } from "drizzle-orm";
import { Briefcase, ChevronRight, Lock, Plus, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { jobRole, myJobsWhere } from "@/lib/job-access";
import { db } from "@/db";
import { jobs, milestones, type Job, type Milestone } from "@/db/schema";
import { Header } from "@/components/header";
import { Landing } from "@/components/landing/landing";
import { Card, StatusBadge, btn } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { loadPaymentsForUser } from "@/lib/payment-history";
import { PaymentsList } from "@/components/payments-list";

const HELD = new Set(["funded", "verifying", "failed", "passed"]);

function sumByCurrency(rows: { amountMinor: number; currency: string }[]) {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amountMinor);
  return totals.size ? [...totals].map(([c, v]) => formatMoney(v, c)).join(" · ") : formatMoney(0, "USD");
}

function JobList({ title, items, ms, empty, who }: {
  title: string; items: Job[]; ms: Milestone[]; empty: string; who: (j: Job) => string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <Card className="p-6 text-center text-ink-soft">{empty}</Card>
      ) : (
        <ul className="space-y-3">
          {items.map((j) => {
            const mine = ms.filter((m) => m.jobId === j.id).sort((a, b) => a.position - b.position);
            const paid = mine.filter((m) => m.state === "paid_out").length;
            const current = mine.find((m) => !["paid_out", "cancelled"].includes(m.state)) ?? mine.at(-1);
            const total = mine.reduce((s, m) => s + m.amountMinor, 0);
            return (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="group block">
                  <Card className="flex items-center gap-4 p-4 transition-colors group-hover:border-brand/40">
                    <span className="hidden size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand sm:grid"><Briefcase aria-hidden className="size-5" /></span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-semibold">{j.title}</p>
                      <p className="truncate text-sm text-ink-soft">{who(j)} · {paid}/{mine.length} milestones paid</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-semibold tabular-nums">{formatMoney(total, j.currency)}</span>
                      {current && <StatusBadge state={current.state} />}
                    </div>
                    <ChevronRight aria-hidden className="size-5 text-slate-400" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function Home() {
  const user = await currentUser();
  if (!user) return <Landing />;
  if (!user.onboardedAt) redirect("/onboarding");
  const { id, email } = user;

  const all = await db.select().from(jobs).where(myJobsWhere(user));
  const ms = all.length ? await db.select().from(milestones).where(inArray(milestones.jobId, all.map((j) => j.id))) : [];
  const currencyOf = new Map(all.map((j) => [j.id, j.currency]));
  const withCur = (pred: (m: Milestone) => boolean) => ms.filter(pred).map((m) => ({ amountMinor: m.amountMinor, currency: currencyOf.get(m.jobId)! }));
  const recent = await loadPaymentsForUser({ id, email }, { limit: 8 });
  const posted = all.filter((j) => j.clientId === id);
  const working = all.filter((j) => jobRole(j, user) === "freelancer");

  const stats = [
    { label: "On hold in PayPal", value: sumByCurrency(withCur((m) => HELD.has(m.state))), Icon: Lock },
    { label: "Released to freelancers", value: sumByCurrency(withCur((m) => m.state === "paid_out")), Icon: Wallet },
    { label: "Active jobs", value: String(all.filter((j) => ms.some((m) => m.jobId === j.id && !["paid_out", "cancelled"].includes(m.state))).length), Icon: Briefcase },
  ];

  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-ink-soft">Your escrowed jobs and payments.</p>
          </div>
          <Link href="/jobs/new" className={btn.primary}><Plus aria-hidden className="size-4" /> Post a job</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, Icon }) => (
            <Card key={label} className="flex items-center gap-4 p-5">
              <span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand"><Icon aria-hidden className="size-5" /></span>
              <div><p className="text-sm text-ink-soft">{label}</p><p className="text-xl font-bold tabular-nums">{value}</p></div>
            </Card>
          ))}
        </div>
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent payments</h2><Link href="/wallet" className="text-sm font-semibold text-brand hover:underline">Open wallet →</Link></div>
          <PaymentsList items={recent} showJob empty="No payments yet. Every hold, payment and release will show up here with its PayPal ID." />
        </section>
        <JobList title="Jobs I posted" items={posted} ms={ms} who={(j) => `Freelancer ${j.freelancerEmail}`} empty="No jobs yet. Post one and let AI draft the milestones." />
        <JobList title="Jobs I'm working on" items={working} ms={ms} who={() => "You're the freelancer"} empty="When a client hires you with your PayPal email, the job shows up here." />
      </main>
    </>
  );
}
