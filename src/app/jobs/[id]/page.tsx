import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, Bot, Camera, CheckCircle2, CircleHelp, ExternalLink, FileText, Globe, Lightbulb, Loader2, Lock,
  Hourglass, MailOpen, ReceiptText, Send, Wallet, XCircle,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { formatMoney, toPayPalValue } from "@/lib/money";
import { Header } from "@/components/header";
import { Card, StatusBadge, btn, field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveMilestone, fundMilestone, cancelMilestone, submitProof, retryRelease, acceptInvitation, declineInvitation } from "../actions";
import { loadJobForUser } from "../load";
import { loadPaymentsForUser } from "@/lib/payment-history";
import { PaymentsList } from "@/components/payments-list";
import { LocalTime } from "@/components/local-time";
import { AutoRefresh } from "./auto-refresh";
import { PhotoProofForm, PhotoPicker } from "./photo-proof-form";

type Loaded = Awaited<ReturnType<typeof loadJobForUser>>;
type M = Loaded["milestones"][number];

function Banner({ tone, icon, children }: { tone: string; icon: ReactNode; children: ReactNode }) {
  return <div className={`flex items-start gap-3 rounded-lg p-3 text-sm ${tone}`}>{icon}<div className="space-y-0.5">{children}</div></div>;
}

const VERDICT = {
  pass: { Icon: CheckCircle2, cls: "text-emerald-600", label: "Verified" },
  fail: { Icon: XCircle, cls: "text-red-600", label: "Not met" },
  unsure: { Icon: CircleHelp, cls: "text-amber-600", label: "Unclear" },
};

function Checklist({ m }: { m: M }) {
  return (
    <ul className="space-y-2">
      {m.checklist.map((c) => {
        const v = m.verdict.find((x) => x.checklistItemId === c.id);
        const meta = v ? VERDICT[v.status as keyof typeof VERDICT] ?? VERDICT.unsure : null;
        return (
          <li key={c.id} className="flex gap-3 rounded-lg bg-canvas px-3 py-2.5">
            {meta
              ? <meta.Icon aria-label={meta.label} className={`mt-0.5 size-5 shrink-0 ${meta.cls}`} />
              : <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-300" />}
            <div className="min-w-0">
              <p className="font-medium">{c.requirement}</p>
              {v?.reason && <p className="text-sm text-ink-soft">{v.reason}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StateBanner({ m, currency, freelancer, blocked }: { m: M; currency: string; freelancer: string; blocked: boolean }) {
  const amount = formatMoney(m.amountMinor, currency);
  switch (m.state) {
    case "funding": return <Banner tone="bg-sky-50 text-sky-900" icon={<Wallet aria-hidden className="size-5 shrink-0" />}><p>Waiting for the client to approve the payment on PayPal.</p></Banner>;
    case "funded": return <Banner tone="bg-sky-50 text-sky-900" icon={<Lock aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">{amount} is held by PayPal.</p><p>{blocked ? "Starts once the previous milestone is paid." : "It is released automatically when the AI verifies every checklist item."}</p></Banner>;
    case "verifying": return <Banner tone="bg-violet-50 text-violet-900" icon={<Loader2 aria-hidden className="size-5 shrink-0 animate-spin" />}><p className="font-semibold">The AI agent is checking the proof…</p><p>Live steps appear in the activity log below.</p></Banner>;
    case "failed": {
      const workMissing = !m.failReason || /checklist item/.test(m.failReason); // otherwise it was our side (AI busy, browser down)
      return <Banner tone="bg-amber-50 text-amber-900" icon={<AlertTriangle aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">{m.failReason ?? "Some items aren't met yet."}</p><p>{workMissing ? "The money stays on hold. Fix the items marked below and resubmit." : "Nothing for you to fix: just resubmit the same proof."}</p></Banner>;
    }
    case "passed": return <Banner tone="bg-emerald-50 text-emerald-900" icon={<Loader2 aria-hidden className="size-5 shrink-0 animate-spin" />}><p className="font-semibold">All items verified. Releasing {amount}…</p></Banner>;
    case "paid_out": return <Banner tone="bg-emerald-50 text-emerald-900" icon={<CheckCircle2 aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">{amount} paid to {freelancer}.</p></Banner>;
    default: return null;
  }
}

function Proof({ m }: { m: M }) {
  const s = m.submission;
  if (!s) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Submitted proof</p>
      {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-brand underline"><Globe aria-hidden className="size-4 shrink-0" />{s.url}<ExternalLink aria-hidden className="size-3.5 shrink-0" /></a>}
      {s.beforePhoto && s.afterPhoto && (
        <div className="grid grid-cols-2 gap-3">
          {[["Before", s.beforePhoto], ["After", s.afterPhoto]].map(([label, src]) => (
            <figure key={label} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${label} photo`} className="aspect-[4/3] w-full rounded-lg border border-line object-cover" />
              <figcaption className="text-xs text-ink-soft">{label}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <Link href={`/jobs/${m.jobId}/report/${s.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><FileText aria-hidden className="size-4" /> View proof report</Link>
    </div>
  );
}

const EVENT_ICON = { agent: Bot, payment: Wallet, error: AlertTriangle, state: ReceiptText };

function Activity({ m }: { m: M }) {
  if (!m.events.length) return null;
  return (
    <details open={m.state === "verifying"} className="group rounded-lg border border-line">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-ink-soft">Activity log ({m.events.length})</summary>
      <ol className="space-y-3 border-t border-line p-3">
        {m.events.map((e) => {
          const Icon = EVENT_ICON[e.kind as keyof typeof EVENT_ICON] ?? ReceiptText;
          const tone = e.kind === "error" ? "text-red-700" : e.kind === "payment" ? "text-emerald-700 font-medium" : "text-ink";
          return (
            <li key={e.id} className="flex gap-3 text-sm">
              <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${tone}`} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className={`break-words ${tone}`}>{e.message}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {e.image && <img src={`data:image/jpeg;base64,${e.image}`} alt="What the AI saw" className="max-h-56 rounded-md border border-line" />}
              </div>
              <span className="shrink-0 tabular-nums text-xs text-ink-soft"><LocalTime date={e.createdAt} mode="time" /></span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function MilestoneCard({ m, data, blocked }: { m: M; data: Loaded; blocked: boolean }) {
  const { job, role } = data;
  const isClient = role === "client";
  const ProofIcon = m.proofType === "photo" ? Camera : Globe;
  return (
    <li className="relative pl-12">
      <span className={`absolute left-0 top-5 grid size-8 place-items-center rounded-full text-sm font-bold ${m.state === "paid_out" ? "bg-emerald-600 text-white" : "border-2 border-brand bg-white text-brand"}`}>{m.position + 1}</span>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{m.title}</h3>
            <p className="inline-flex items-center gap-1.5 text-sm text-ink-soft"><ProofIcon aria-hidden className="size-4" />{m.proofType === "photo" ? "Proof: before/after photos" : "Proof: live website"}</p>
          </div>
          <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
            <span className="text-lg font-bold tabular-nums">{formatMoney(m.amountMinor, job.currency)}</span>
            <StatusBadge state={m.state} />
          </div>
        </div>

        <StateBanner m={m} currency={job.currency} freelancer={job.freelancerEmail} blocked={blocked} />

        {isClient && m.state === "draft" ? (
          <form action={saveMilestone.bind(null, m.id)} className="space-y-3 rounded-lg border border-line p-4">
            <p className="text-sm font-semibold">Review before funding: the AI checks against exactly this list.</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_10rem]">
              <label className="space-y-1 text-sm font-medium">Title<input name="title" defaultValue={m.title} className={field} /></label>
              <label className="space-y-1 text-sm font-medium">Amount<input name="amount" type="number" step="0.01" min="0.01" defaultValue={toPayPalValue(m.amountMinor, job.currency)} className={field} /></label>
              <label className="space-y-1 text-sm font-medium">Proof type
                <select name="proofType" defaultValue={m.proofType} className={field}><option value="website">Website</option><option value="photo">Photos</option></select>
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">Checklist (one requirement per line)
              <textarea name="checklist" rows={Math.max(3, m.checklist.length + 1)} className={field} defaultValue={m.checklist.map((c) => c.requirement).join("\n")} />
            </label>
            {m.checklist.some((c) => c.lintNote) && (
              <ul className="space-y-1.5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {m.checklist.filter((c) => c.lintNote).map((c) => (
                  <li key={c.id} className="flex gap-2"><Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0" /><span><b>{c.requirement}</b>: {c.lintNote}</span></li>
                ))}
              </ul>
            )}
            {m.proofType === "website" && (
              <div className="max-w-xs">
                <PhotoPicker name="referenceImage" label="Reference design (optional)" initial={m.referenceImage ?? ""} />
                <p className="mt-1 text-xs text-ink-soft">A mockup or screenshot. The AI compares the live homepage with it.</p>
              </div>
            )}
            <SubmitButton className={btn.secondary} pending="Saving…">Save checklist</SubmitButton>
          </form>
        ) : (
          <Checklist m={m} />
        )}

        {m.state !== "draft" && m.referenceImage && (
          <figure className="max-w-xs space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.referenceImage} alt="Reference design" className="rounded-lg border border-line" />
            <figcaption className="text-xs text-ink-soft">Reference design</figcaption>
          </figure>
        )}

        <Proof m={m} />

        <div className="flex flex-wrap items-center gap-3">
          {isClient && job.status === "accepted" && ["draft", "funding"].includes(m.state) && (
            <form action={fundMilestone.bind(null, m.id)}>
              <SubmitButton className={btn.paypal} pending="Opening PayPal…"><Lock aria-hidden className="size-4" /> Fund {formatMoney(m.amountMinor, job.currency)} with PayPal</SubmitButton>
            </form>
          )}
          {isClient && m.state === "passed" && (
            <form action={retryRelease.bind(null, m.id)}><SubmitButton className={btn.secondary} pending="Retrying…">Retry payment</SubmitButton></form>
          )}
          {isClient && ["draft", "funding", "funded", "failed"].includes(m.state) && (
            <form action={cancelMilestone.bind(null, m.id)}>
              <SubmitButton className={btn.danger} pending="Cancelling…"><XCircle aria-hidden className="size-4" /> Cancel{m.authorizationId ? " & release hold" : ""}</SubmitButton>
            </form>
          )}
        </div>

        {role === "freelancer" && ["funded", "failed"].includes(m.state) && !blocked && (
          <div className="space-y-3 rounded-lg border border-brand/30 bg-brand-soft/40 p-4">
            <p className="font-semibold">{m.state === "failed" ? "Resubmit your proof" : "Submit your proof"}</p>
            {m.proofType === "photo" ? (
              <PhotoProofForm action={submitProof.bind(null, m.id)} />
            ) : (
              <form action={submitProof.bind(null, m.id)} className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor={`url-${m.id}`} className="sr-only">Website URL</label>
                <input id={`url-${m.id}`} name="url" type="url" required placeholder="https://your-site.com" defaultValue={m.submission?.url ?? undefined} className={field} />
                <SubmitButton className={`${btn.primary} shrink-0`} pending="Submitting…"><Send aria-hidden className="size-4" /> Submit for AI check</SubmitButton>
              </form>
            )}
          </div>
        )}

        <Activity m={m} />
      </Card>
    </li>
  );
}

// Consent before money: the freelancer accepts the exact milestones and checklists first.
function Invitation({ data }: { data: Loaded }) {
  const { job, role, client, freelancer, milestones } = data;
  const total = formatMoney(milestones.reduce((s, m) => s + m.amountMinor, 0), job.currency);
  if (job.status === "declined") {
    return (
      <Banner tone="bg-slate-100 text-slate-800" icon={<XCircle aria-hidden className="size-5 shrink-0" />}>
        <p className="font-semibold">{role === "client" ? `${freelancer.name} declined this job.` : "You declined this job."}</p>
        {job.declineNote && <p>“{job.declineNote}”</p>}
        {role === "client" && <p><Link href="/freelancers" className="font-semibold underline">Find another freelancer</Link></p>}
      </Banner>
    );
  }
  if (job.status !== "invited") return null;
  if (role === "client") {
    return (
      <Banner tone="bg-sky-50 text-sky-900" icon={<Hourglass aria-hidden className="size-5 shrink-0" />}>
        <p className="font-semibold">Waiting for {freelancer.name} to accept.</p>
        <p>They&apos;re reviewing the milestones and checklists below. You can fund once they accept; editing a milestone asks them to accept again.</p>
      </Banner>
    );
  }
  return (
    <Card className="space-y-4 border-brand/40 p-5 shadow-[0_12px_32px_-16px_rgba(3,105,161,0.35)]">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><MailOpen aria-hidden className="size-5" /></span>
        <div>
          <h2 className="font-display text-xl font-semibold">{client.name} invited you · {total}</h2>
          <p className="text-sm text-ink-soft">Check the milestones and checklists below. The AI verifies your work against exactly these items, and the money is held by PayPal before you start.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <form action={acceptInvitation.bind(null, job.id)}>
          <SubmitButton className={btn.primary} pending="Accepting…"><CheckCircle2 aria-hidden className="size-4" /> Accept job</SubmitButton>
        </form>
        <details className="group">
          <summary className={`${btn.secondary} list-none`}>Decline</summary>
          <form action={declineInvitation.bind(null, job.id)} className="mt-3 space-y-2">
            <label className="block space-y-1 text-sm font-medium">Note for {client.name} (optional)<textarea name="note" rows={2} maxLength={300} className={field} placeholder="Thanks, but I'm fully booked this month." /></label>
            <SubmitButton className={btn.danger} pending="Declining…">Decline invitation</SubmitButton>
          </form>
        </details>
      </div>
    </Card>
  );
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const data = await loadJobForUser((await params).id, user);
  const payments = await loadPaymentsForUser(user, { jobId: data.job.id });
  const { job, role, milestones, client, freelancer } = data;
  const total = milestones.reduce((s, m) => s + m.amountMinor, 0);
  const paid = milestones.filter((m) => m.state === "paid_out").reduce((s, m) => s + m.amountMinor, 0);
  const held = milestones.filter((m) => ["funded", "verifying", "failed", "passed"].includes(m.state)).reduce((s, m) => s + m.amountMinor, 0);

  return (
    <>
      <Header user={user} />
      <AutoRefresh active={milestones.some((m) => m.state === "verifying" || m.state === "passed")} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"><ArrowLeft aria-hidden className="size-4" /> Dashboard</Link>
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">You are the {role}</span>
          <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
          <p className="whitespace-pre-wrap leading-relaxed text-ink-soft">{job.description}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[["Client", client], ["Freelancer", freelancer]].map(([label, p]) => {
              const person = p as typeof client;
              return (
                <div key={label as string}><dt className="text-ink-soft">{label as string}</dt>
                  <dd className="font-medium break-all">{person.name}{person.detail && <span className="font-normal text-ink-soft"> · {person.detail}</span>}</dd>
                  {person.name !== person.email && <dd className="text-xs text-ink-soft break-all">{person.email}</dd>}
                </div>
              );
            })}
          </dl>
        </div>

        <Invitation data={data} />
        <div className="grid grid-cols-3 gap-3">
          {[["Total", total], ["On hold", held], ["Paid", paid]].map(([label, v]) => (
            <Card key={label as string} className="p-4"><p className="text-sm text-ink-soft">{label}</p><p className="text-lg font-bold tabular-nums">{formatMoney(v as number, job.currency)}</p></Card>
          ))}
        </div>
        <section aria-labelledby="pay" className="space-y-3">
          <h2 id="pay" className="text-lg font-semibold">Payments</h2>
          <PaymentsList items={payments} empty={role === "client" ? "No payments yet. Fund a milestone to hold the money with PayPal." : "No payments yet. You'll see the money here as soon as the client funds a milestone."} />
        </section>

        <section aria-labelledby="ms" className="space-y-4">
          <h2 id="ms" className="text-lg font-semibold">Milestones</h2>
          <ol className="relative space-y-6 before:absolute before:bottom-6 before:left-[15px] before:top-6 before:w-0.5 before:bg-line">
            {milestones.map((m, i) => {
              const prev = milestones[i - 1];
              const blocked = !!prev && !["paid_out", "cancelled"].includes(prev.state);
              return <MilestoneCard key={m.id} m={m} data={data} blocked={blocked} />;
            })}
          </ol>
        </section>
      </main>
    </>
  );
}
