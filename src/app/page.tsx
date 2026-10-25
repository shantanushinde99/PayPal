import Link from "next/link";
import { eq, inArray, or } from "drizzle-orm";
import { Bot, Briefcase, ChevronRight, FileCheck2, Lock, Plus, ShieldCheck, Wallet } from "lucide-react";
import { auth, signIn } from "@/auth";
import { db } from "@/db";
import { jobs, milestones, type Job, type Milestone } from "@/db/schema";
import { Header, Logo } from "@/components/header";
import { Card, StatusBadge, btn } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/money";

const HELD = new Set(["funded", "verifying", "failed", "passed"]);

function sumByCurrency(rows: { amountMinor: number; currency: string }[]) {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amountMinor);
  return totals.size ? [...totals].map(([c, v]) => formatMoney(v, c)).join(" · ") : formatMoney(0, "USD");
}

function Landing() {
  const steps = [
    { Icon: FileCheck2, title: "Agree on “done”", text: "Describe the job. AI turns it into a clear checklist both sides sign off on." },
    { Icon: Lock, title: "Funds held by PayPal", text: "The client funds each milestone. PayPal holds the money, nobody can touch it." },
    { Icon: Bot, title: "AI verifies the proof", text: "The freelancer submits a live site or photos. An AI agent checks every item." },
    { Icon: Wallet, title: "Paid automatically", text: "All items pass? Money is released instantly. Missing something? It says exactly what." },
  ];
  return (
    <>
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4"><Logo /></header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        <section className="grid gap-10 py-12 md:grid-cols-[1.2fr_1fr] md:items-center md:py-20">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-strong">
              <ShieldCheck aria-hidden className="size-4" /> AI escrow on PayPal
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">Pay when the work is <span className="text-brand">proven</span> done.</h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
              Clients stop paying for unfinished work. Freelancers stop chasing invoices. An AI agent checks the delivery against the agreed checklist and releases the PayPal payment the moment it passes.
            </p>
            <form action={async () => { "use server"; await signIn("paypal", { redirectTo: "/" }); }}>
              <SubmitButton className={`${btn.paypal} px-7 text-base`} pending="Opening PayPal…">Log in with PayPal</SubmitButton>
            </form>
            <p className="text-sm text-ink-soft">Sandbox demo · no real money moves.</p>
          </div>
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between"><span className="font-semibold">Bakery landing page</span><StatusBadge state="verifying" /></div>
            {["Menu with prices", "Opening hours", "Contact form"].map((t, i) => (
              <div key={t} className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2.5 text-sm">
                <span className={`size-2.5 rounded-full ${i < 2 ? "bg-emerald-500" : "bg-amber-500"}`} />
                {t}
                <span className="ml-auto text-ink-soft">{i < 2 ? "Verified" : "Missing"}</span>
              </div>
            ))}
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">“The contact form is missing. Add it and resubmit — your $200 is safely on hold.”</p>
          </Card>
        </section>
        <section aria-labelledby="how" className="space-y-6">
          <h2 id="how" className="text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ Icon, title, text }, i) => (
              <li key={title}>
                <Card className="h-full space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><Icon aria-hidden className="size-5" /></span>
                    <span className="text-sm font-semibold text-ink-soft">Step {i + 1}</span>
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
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
  const session = await auth();
  if (!session?.user?.id) return <Landing />;
  const { id, email } = session.user;

  const all = await db.select().from(jobs).where(or(eq(jobs.clientId, id), eq(jobs.freelancerEmail, email)));
  const ms = all.length ? await db.select().from(milestones).where(inArray(milestones.jobId, all.map((j) => j.id))) : [];
  const currencyOf = new Map(all.map((j) => [j.id, j.currency]));
  const withCur = (pred: (m: Milestone) => boolean) => ms.filter(pred).map((m) => ({ amountMinor: m.amountMinor, currency: currencyOf.get(m.jobId)! }));
  const posted = all.filter((j) => j.clientId === id);
  const working = all.filter((j) => j.freelancerEmail === email);

  const stats = [
    { label: "On hold in PayPal", value: sumByCurrency(withCur((m) => HELD.has(m.state))), Icon: Lock },
    { label: "Released to freelancers", value: sumByCurrency(withCur((m) => m.state === "paid_out")), Icon: Wallet },
    { label: "Active jobs", value: String(all.filter((j) => ms.some((m) => m.jobId === j.id && !["paid_out", "cancelled"].includes(m.state))).length), Icon: Briefcase },
  ];

  return (
    <>
      <Header email={email} />
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
        <JobList title="Jobs I posted" items={posted} ms={ms} who={(j) => `Freelancer ${j.freelancerEmail}`} empty="No jobs yet. Post one and let AI draft the milestones." />
        <JobList title="Jobs I'm working on" items={working} ms={ms} who={() => "You're the freelancer"} empty="When a client hires you with your PayPal email, the job shows up here." />
      </main>
    </>
  );
}
