import Link from "next/link";
import { DemoEntryGate } from "@/components/demo-entry-gate";
import { inArray } from "drizzle-orm";
import { Briefcase, ChevronRight, Hourglass, Lock, MailOpen, Plus, Users, Wallet, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { jobRole, myJobsWhere } from "@/lib/job-access";
import { db } from "@/db";
import { jobs, milestones, users, type Job, type Milestone } from "@/db/schema";
import { currentView } from "@/lib/view";
import { demoEnabled } from "@/lib/demo";
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

type Names = Map<string, string>;

function JobBadge({ job, current, view }: { job: Job; current?: Milestone; view: "client" | "freelancer" }) {
  if (job.status === "invited") {
    return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
      {view === "client" ? <><Hourglass aria-hidden className="size-3.5" />Awaiting acceptance</> : <><MailOpen aria-hidden className="size-3.5" />Invitation</>}</span>;
  }
  if (job.status === "declined") return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><XCircle aria-hidden className="size-3.5" />Declined</span>;
  return current ? <StatusBadge state={current.state} /> : null;
}

function JobList({ title, items, ms, empty, who, view }: {
  title: string; items: Job[]; ms: Milestone[]; empty: string; who: (j: Job) => string; view: "client" | "freelancer";
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title} <span className="text-ink-soft">({items.length})</span></h2>
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
                      <JobBadge job={j} current={current} view={view} />
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
  if (!user) return <Landing demo={demoEnabled()} />;
  if (!user.onboardedAt) redirect("/onboarding");
  const view = await currentView(user);

  const all = await db.select().from(jobs).where(myJobsWhere(user));
  const ms = all.length ? await db.select().from(milestones).where(inArray(milestones.jobId, all.map((j) => j.id))) : [];
  const people = [...new Set(all.flatMap((j) => [j.clientId, j.freelancerId ?? ""]).filter(Boolean))];
  const names: Names = new Map((people.length ? await db.select({ id: users.id, n: users.displayName, e: users.email }).from(users).where(inArray(users.id, people)) : []).map((u) => [u.id, u.n ?? u.e]));
  const currencyOf = new Map(all.map((j) => [j.id, j.currency]));
  const sum = (jobIds: Set<string>, pred: (m: Milestone) => boolean) =>
    sumByCurrency(ms.filter((m) => jobIds.has(m.jobId) && pred(m)).map((m) => ({ amountMinor: m.amountMinor, currency: currencyOf.get(m.jobId)! })));
  const recent = await loadPaymentsForUser(user, { limit: 8 });

  const side = all.filter((j) => (view === "client" ? j.clientId === user.id : jobRole(j, user) === "freelancer"));
  const ids = new Set(side.map((j) => j.id));
  const by = (status: string) => side.filter((j) => j.status === status);
  const freelancerName = (j: Job) => (j.freelancerId ? names.get(j.freelancerId) : null) ?? j.freelancerEmail;
  const clientName = (j: Job) => names.get(j.clientId) ?? "Client";
  const active = (j: Job) => ms.some((m) => m.jobId === j.id && !["paid_out", "cancelled"].includes(m.state));

  const stats = view === "client"
    ? [
        { label: "On hold in PayPal", value: sum(ids, (m) => HELD.has(m.state)), Icon: Lock },
        { label: "Paid to freelancers", value: sum(ids, (m) => m.state === "paid_out"), Icon: Wallet },
        { label: "Active jobs", value: String(by("accepted").filter(active).length), Icon: Briefcase },
      ]
    : [
        { label: "Earned", value: sum(ids, (m) => m.state === "paid_out"), Icon: Wallet },
        { label: "Funded, waiting for you", value: sum(ids, (m) => HELD.has(m.state)), Icon: Lock },
        { label: "Open invitations", value: String(by("invited").length), Icon: MailOpen },
      ];

  return (
    <>
      {user.isDemo && <DemoEntryGate />}
      <Header user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Hi {user.displayName?.split(" ")[0] ?? "there"}</h1>
            <p className="text-ink-soft">{view === "client" ? "Your jobs, holds and payments." : "Your invitations, work and earnings."}</p>
          </div>
          {view === "client" && (
            <div className="flex flex-wrap gap-2">
              <Link href="/freelancers" className={btn.secondary}><Users aria-hidden className="size-4" /> Find freelancers</Link>
              <Link href="/jobs/new" className={btn.primary}><Plus aria-hidden className="size-4" /> Post a job</Link>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, Icon }) => (
            <Card key={label} className="flex items-center gap-4 p-5">
              <span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand"><Icon aria-hidden className="size-5" /></span>
              <div><p className="text-sm text-ink-soft">{label}</p><p className="text-xl font-bold tabular-nums">{value}</p></div>
            </Card>
          ))}
        </div>

        {view === "client" ? (
          <>
            <JobList view={view} title="Active jobs" items={by("accepted")} ms={ms} who={(j) => freelancerName(j)} empty="No active jobs yet. Hire a freelancer to get started." />
            <JobList view={view} title="Awaiting acceptance" items={by("invited")} ms={ms} who={(j) => `Invited ${freelancerName(j)}`} empty="No pending invitations." />
            {by("declined").length > 0 && <JobList view={view} title="Declined" items={by("declined")} ms={ms} who={(j) => freelancerName(j)} empty="" />}
          </>
        ) : (
          <>
            <JobList view={view} title="Invitations" items={by("invited")} ms={ms} who={(j) => `From ${clientName(j)}`} empty="No invitations right now. Complete your profile so clients find you in the directory." />
            <JobList view={view} title="Active work" items={by("accepted")} ms={ms} who={(j) => clientName(j)} empty="Accepted jobs show up here." />
          </>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent payments</h2><Link href="/wallet" className="text-sm font-semibold text-brand hover:underline">Open wallet →</Link></div>
          <PaymentsList items={recent} showJob empty="No payments yet. Every hold, payment and release will show up here with its PayPal ID." />
        </section>
      </main>
    </>
  );
}
