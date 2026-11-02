import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, Bot, Camera, CheckCircle2, CircleHelp, ExternalLink, FileText, Globe, Lightbulb, Loader2, Lock,
  Eye, Hourglass, MailOpen, Palette, PlayCircle, ShieldCheck, ReceiptText, Scale, Wallet, XCircle,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { formatMoney, toPayPalValue } from "@/lib/money";
import { Header } from "@/components/header";
import { Card, StatusBadge, btn, field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { confirmHandoverAction, recheckWarrantyAction, answerProposalAction, applyExpectationsAction, askScopeAction, confirmInboxAction, proposeMilestoneAction, findExpectationsAction, saveMilestone, fundMilestone, createFundingOrder, approveFunding, cancelMilestone, submitProof, acceptInvitation, declineInvitation, approveRelease, requestDesignChanges } from "../actions";
import { loadJobForUser } from "../load";
import { loadPaymentsForUser } from "@/lib/payment-history";
import { PaymentsList } from "@/components/payments-list";
import { LocalTime } from "@/components/local-time";
import { AutoRefresh } from "./auto-refresh";
import { ChangeRequestForm, DisputePanel, StatementForm } from "./dispute-panel";
import { acceptDecisionAction, askJudgeAction, openDisputeAction, rejectDecisionAction, respondDisputeAction } from "../dispute-actions";
import { shareMinor } from "@/lib/money";
import { DesignProofForm, PhotoProofForm, PhotoPicker } from "./photo-proof-form";
import { ProofLinkForm } from "./proof-link-form";
import { ExpectationFinder } from "./expectation-finder";
import { ScopeAsk } from "./scope-ask";
import { PayPalButtons } from "./paypal-buttons";
import { env } from "@/lib/env";

// JS SDK for authorize-intent buttons. In direct mode the freelancer is the payee, so the SDK must know them.
const sdkSrc = (currency: string, payee?: string) => `${env.PAYPAL_WEB_BASE}/sdk/js?${new URLSearchParams({
  "client-id": env.PAYPAL_CLIENT_ID, intent: "authorize", currency, components: "buttons,messages", "enable-funding": "venmo,paylater",
  ...(payee && { "merchant-id": payee }),
  ...(env.PAYPAL_API_BASE.includes("sandbox") && { "buyer-country": "US" }), // sandbox only: show US funding options
})}`;
import { ownershipCode } from "@/lib/ownership";

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

const KIND: Record<string, { label: string; cls: string }> = {
  journey: { label: "Journey", cls: "bg-violet-100 text-violet-900" },
  domain: { label: "Domain", cls: "bg-sky-100 text-sky-900" },
  handover: { label: "Handover", cls: "bg-amber-100 text-amber-900" },
};

function Checklist({ m }: { m: M }) {
  return (
    <ul className="space-y-2">
      {m.checklist.map((c) => {
        const v = m.verdict.find((x) => x.checklistItemId === c.id);
        // Handover items aren't judged by the AI: their tick is the client's own confirmation.
        const status = c.kind === "handover" ? (c.confirmed === null ? null : c.confirmed ? "pass" : "fail") : v?.status;
        const meta = status ? VERDICT[status as keyof typeof VERDICT] ?? VERDICT.unsure : null;
        return (
          <li key={c.id} className="flex gap-3 rounded-lg bg-canvas px-3 py-2.5">
            {meta
              ? <meta.Icon aria-label={meta.label} className={`mt-0.5 size-5 shrink-0 ${meta.cls}`} />
              : <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-300" />}
            <div className="min-w-0">
              <p className="font-medium">{c.kind !== "item" && <span className={`mr-2 rounded px-1.5 py-0.5 align-middle text-xs font-semibold ${KIND[c.kind]?.cls ?? ""}`}>{KIND[c.kind]?.label}</span>}{c.requirement}</p>
              {c.kind === "handover" && <p className="text-sm text-ink-soft">{c.confirmed === true ? "Confirmed by the client." : c.confirmed === false ? "The client says this wasn't handed over." : "The client confirms this before paying."}</p>}
              {v?.reason && <p className="text-sm text-ink-soft">{v.reason}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StateBanner({ m, currency, freelancer, blocked, rounds }: { m: M; currency: string; freelancer: string; blocked: boolean; rounds: number }) {
  const amount = formatMoney(m.amountMinor, currency);
  if (m.proofType === "design" && m.state === "passed") {
    return <Banner tone="bg-violet-50 text-violet-900" icon={<Palette aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">Design submitted: waiting for the client. {rounds - m.changeRequests} of {rounds} change rounds left.</p><p>The client approves it or asks for changes. If they don&apos;t answer, it&apos;s approved{m.releaseAt ? <> on <LocalTime date={m.releaseAt} /></> : ""} and {amount} is paid.</p></Banner>;
  }
  if (m.proofType === "design" && m.state === "failed") {
    return <Banner tone="bg-amber-50 text-amber-900" icon={<Palette aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">{m.failReason}</p><p>The money stays on hold. Update the design and send it again.</p></Banner>;
  }
  switch (m.state) {
    case "funding": return <Banner tone="bg-sky-50 text-sky-900" icon={<Wallet aria-hidden className="size-5 shrink-0" />}><p>Waiting for the client to approve the payment on PayPal.</p></Banner>;
    case "funded": return <Banner tone="bg-sky-50 text-sky-900" icon={<Lock aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">{amount} is held by PayPal.</p><p>{blocked ? "Starts once the previous milestone is paid." : "It is released automatically when the AI verifies every checklist item."}</p></Banner>;
    case "verifying": return <Banner tone="bg-violet-50 text-violet-900" icon={<Loader2 aria-hidden className="size-5 shrink-0 animate-spin" />}><p className="font-semibold">The AI agent is checking the proof…</p><p>Live steps appear in the activity log below.</p></Banner>;
    case "failed": {
      const workMissing = !m.failReason || /checklist item|test message/.test(m.failReason); // otherwise it was our side (AI busy, browser down)
      return <Banner tone="bg-amber-50 text-amber-900" icon={<AlertTriangle aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">{m.failReason ?? "Some items aren't met yet."}</p><p>{workMissing ? "The money stays on hold. Fix the items marked below and resubmit." : "Nothing for you to fix: just resubmit the same proof."}</p></Banner>;
    }
    case "passed": return <Banner tone="bg-emerald-50 text-emerald-900" icon={<Hourglass aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">All items verified. {amount} releases automatically{m.releaseAt ? <> on <LocalTime date={m.releaseAt} /></> : " shortly"}.</p><p>The client can approve now or dispute until then. The money stays on hold meanwhile.</p></Banner>;
    case "disputed": return <Banner tone="bg-orange-50 text-orange-950" icon={<Scale aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">In dispute. {amount} stays on hold until it is resolved.</p></Banner>;
    case "paid_out": return <Banner tone="bg-emerald-50 text-emerald-900" icon={<CheckCircle2 aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">{formatMoney(m.capturedMinor ?? m.amountMinor, currency)} paid to {freelancer}.{m.capturedMinor !== null && m.capturedMinor < m.amountMinor && !["holding", "settling"].includes(m.warrantyStatus ?? "") && <> {formatMoney(m.amountMinor - m.capturedMinor, currency)} returned to the client.</>}</p></Banner>;
    default: return null;
  }
}

// The share still held after release while the site is checked every day.
function WarrantyPanel({ m, currency, recheck }: { m: M; currency: string; recheck: () => Promise<void> }) {
  const amount = formatMoney(m.warrantyMinor!, currency);
  if (m.warrantyStatus === "released") return <Banner tone="bg-emerald-50 text-emerald-900" icon={<ShieldCheck aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">Warranty ended with the site working: {amount} paid.</p></Banner>;
  if (m.warrantyStatus === "returned") return <Banner tone="bg-slate-100 text-slate-800" icon={<ShieldCheck aria-hidden className="size-5 shrink-0" />}><p className="font-semibold">Warranty: the site was still broken at the end, so {amount} went back to the client.</p></Banner>;
  const broken = !!m.warrantyIssue;
  return (
    <Banner tone={broken ? "bg-amber-50 text-amber-900" : "bg-sky-50 text-sky-900"} icon={<ShieldCheck aria-hidden className="size-5 shrink-0" />}>
      <p className="font-semibold">{broken ? `Warranty problem: ${m.warrantyIssue}.` : `Warranty: ${amount} still held while the site is checked daily.`}</p>
      <p>{broken
        ? <>Fix it before <LocalTime date={m.warrantyUntil!} />, or {amount} goes back to the client.</>
        : <>Paid automatically on <LocalTime date={m.warrantyUntil!} /> if the site keeps working.</>}
        {m.warrantyCheckedAt && <> Last checked <LocalTime date={m.warrantyCheckedAt} mode="time" />.</>}</p>
      {m.warrantyStatus === "holding" && (
        <form action={recheck} className="pt-1"><SubmitButton className={btn.secondary} pending="Checking…">Check the site now</SubmitButton></form>
      )}
    </Banner>
  );
}

// A progress check on work in progress: both sides see how far along it is. It never moves money.
function PreviewPanel({ p, checklist }: { p: NonNullable<M["preview"]>; checklist: M["checklist"] }) {
  const { running } = p;
  const done = p.verdict.filter((v) => v.status === "pass").length;
  return (
    <details className="rounded-lg border border-line bg-canvas/60 p-3" open={running}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-semibold">
        <Eye aria-hidden className="size-4" />
        {running ? <>Preview check running… <Loader2 aria-hidden className="size-4 animate-spin" /></> : p.verdict.length ? <>Preview: {done} of {p.verdict.length} items done</> : <>The preview check didn&apos;t finish. Try again.</>}
        <span className="font-normal text-ink-soft">· <LocalTime date={p.createdAt} mode="time" /> · no payment involved</span>
      </summary>
      {p.verdict.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {checklist.map((c) => {
            const v = p.verdict.find((x) => x.checklistItemId === c.id);
            const meta = VERDICT[(v?.status ?? "unsure") as keyof typeof VERDICT] ?? VERDICT.unsure;
            return <li key={c.id} className="flex gap-2"><meta.Icon aria-label={meta.label} className={`mt-0.5 size-4 shrink-0 ${meta.cls}`} /><span>{c.requirement}{v?.status !== "pass" && v?.reason && <span className="text-ink-soft">: {v.reason}</span>}</span></li>;
          })}
        </ul>
      )}
      {p.url && <p className="mt-2 break-all text-xs text-ink-soft">Checked: {p.url}</p>}
    </details>
  );
}

// "Is this included, or new work?" Answers stay on the job page so both sides can point to them later.
function ScopeSection({ data }: { data: Loaded }) {
  const { job, role, scope } = data;
  return (
    <section aria-labelledby="scope" className="space-y-3">
      <h2 id="scope" className="text-lg font-semibold">Included, or new work?</h2>
      <Card className="space-y-4 p-5">
        <p className="text-sm text-ink-soft">New idea or request mid-job? The AI compares it with what you both agreed. If it&apos;s already on a checklist, the freelancer does it. If it&apos;s new, the client can add it as a paid milestone.</p>
        <ScopeAsk action={askScopeAction.bind(null, job.id)} role={role} />
        {scope.length > 0 && (
          <ul className="space-y-3">
            {scope.map((r) => (
              <li key={r.id} className="space-y-1.5 rounded-lg bg-canvas px-3 py-2.5 text-sm">
                <p><span className="capitalize text-ink-soft">{r.askedBy}:</span> &ldquo;{r.request}&rdquo;</p>
                <p className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${r.verdict === "included" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{r.verdict === "included" ? "Already included" : "New work"}</span>
                  <span>{r.reason}</span>
                </p>
                {r.item && <p className="text-xs text-ink-soft">Covered by: &ldquo;{r.item}&rdquo;</p>}
                {r.verdict === "new" && r.priceMinor && <p className="text-xs text-ink-soft">Suggested as a separate milestone: {r.title} · {formatMoney(r.priceMinor, job.currency)}</p>}
                {r.verdict === "new" && r.milestoneId && <p className="text-xs font-medium text-emerald-800">Added as a milestone below.</p>}
                {r.verdict === "new" && !r.milestoneId && role === "client" && (
                  <form action={proposeMilestoneAction.bind(null, r.id, job.id)}>
                    <SubmitButton className={btn.secondary} pending="Adding…">Add as a paid milestone{r.priceMinor ? ` (${formatMoney(r.priceMinor, job.currency)})` : ""}</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

// The AI's test message carried a code; only the client can see whether it reached their inbox.
function InboxCheck({ code, confirmed, ask, yes, no }: { code: string; confirmed: boolean | null; ask: boolean; yes: () => Promise<void>; no: () => Promise<void> }) {
  if (confirmed !== null || !ask) {
    const text = confirmed === true ? `The client confirmed the test message ${code} reached their inbox.`
      : confirmed === false ? `The client said the test message ${code} never arrived.`
      : `A test message with code ${code} was sent through the contact form. Waiting for the client to confirm it arrived.`;
    return <Banner tone={confirmed === false ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-800"} icon={<MailOpen aria-hidden className="size-5 shrink-0" />}><p>{text}</p></Banner>;
  }
  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/60 p-4">
      <p className="flex items-center gap-2 font-semibold text-sky-950"><MailOpen aria-hidden className="size-5" /> Did the test message reach your inbox?</p>
      <p className="text-sm text-sky-900">The AI sent a message through your contact form, saying <b>&ldquo;Verifund test - please ignore (code {code})&rdquo;</b>. A form can say &ldquo;thanks&rdquo; and still send nowhere, so check the inbox it should reach (and the spam folder).</p>
      <div className="flex flex-wrap gap-2">
        <form action={yes}><SubmitButton className={btn.primary} pending="Saving…"><CheckCircle2 aria-hidden className="size-4" /> Yes, it arrived</SubmitButton></form>
        <form action={no}><SubmitButton className={btn.secondary} pending="Saving…"><XCircle aria-hidden className="size-4" /> No, nothing arrived</SubmitButton></form>
      </div>
      <p className="text-xs text-sky-900">&ldquo;No&rdquo; sends the work back to the freelancer to fix the form (they can dispute it). If you don&apos;t answer, payment releases as usual.</p>
    </div>
  );
}

function Proof({ m }: { m: M }) {
  const s = m.submission;
  if (!s) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Submitted proof</p>
      {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-brand underline"><Globe aria-hidden className="size-4 shrink-0" />{s.url}<ExternalLink aria-hidden className="size-3.5 shrink-0" /></a>}
      {m.proofType === "design" && s.afterPhoto && (
        <figure className="max-w-md space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.afterPhoto} alt="Design mockup" className="rounded-lg border border-line" />
          <figcaption className="text-xs text-ink-soft">Design mockup{m.state === "paid_out" ? ": approved. The build is checked against it." : ""}</figcaption>
        </figure>
      )}
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
      {m.hasReplay && (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><PlayCircle aria-hidden className="size-4" /> Watch the AI check this site</summary>
          <video controls preload="metadata" src={`/api/replays/${s.id}`} className="mt-2 w-full rounded-lg border border-line bg-black">Your browser can&apos;t play this recording.</video>
        </details>
      )}
      {m.proofType !== "design" && <Link href={`/jobs/${m.jobId}/report/${s.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><FileText aria-hidden className="size-4" /> View proof report</Link>}
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
  const ProofIcon = m.proofType === "photo" ? Camera : m.proofType === "design" ? Palette : Globe;
  const proofLabel = m.proofType === "photo" ? "Proof: before/after photos" : m.proofType === "design" ? `Proof: a design mockup the client approves · ${job.revisionRounds} change rounds included` : "Proof: website or GitHub repo";
  return (
    <li className="relative pl-12">
      <span className={`absolute left-0 top-5 grid size-8 place-items-center rounded-full text-sm font-bold ${m.state === "paid_out" ? "bg-emerald-600 text-white" : "border-2 border-brand bg-white text-brand"}`}>{m.position + 1}</span>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{m.title}</h3>
            <p className="inline-flex items-center gap-1.5 text-sm text-ink-soft"><ProofIcon aria-hidden className="size-4" />{proofLabel}</p>
          </div>
          <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
            <span className="text-lg font-bold tabular-nums">{formatMoney(m.amountMinor, job.currency)}</span>
            <StatusBadge state={m.state} label={m.proofType === "design" ? { passed: "Waiting for approval", failed: "Changes requested" }[m.state as string] : undefined} />
          </div>
        </div>

        <StateBanner m={m} currency={job.currency} freelancer={data.freelancer.name} blocked={blocked} rounds={job.revisionRounds} />
        {m.warrantyStatus && m.warrantyMinor && <WarrantyPanel m={m} currency={job.currency} recheck={recheckWarrantyAction.bind(null, m.id)} />}
        {m.pendingAcceptance && m.state === "draft" && (
          <Banner tone="bg-sky-50 text-sky-900" icon={<Hourglass aria-hidden className="size-5 shrink-0" />}>
            <p className="font-semibold">{isClient ? "Waiting for the freelancer to accept this milestone." : "The client added this milestone. Accept it to start."}</p>
            <p>It was added after the job started, so it can only be funded once the freelancer agrees to it.</p>
            {!isClient && (
              <div className="flex flex-wrap gap-2 pt-2">
                <form action={answerProposalAction.bind(null, m.id, true)}><SubmitButton className={btn.primary} pending="Accepting…"><CheckCircle2 aria-hidden className="size-4" /> Accept milestone</SubmitButton></form>
                <form action={answerProposalAction.bind(null, m.id, false)}><SubmitButton className={btn.secondary} pending="Declining…">Decline</SubmitButton></form>
              </div>
            )}
          </Banner>
        )}
        {m.preview && ["funded", "failed", "verifying"].includes(m.state) && <PreviewPanel p={m.preview} checklist={m.checklist} />}
        {m.paypalDisputeId && (
          <Banner tone="bg-red-50 text-red-900" icon={<Scale aria-hidden className="size-5 shrink-0" />}>
            <p className="font-semibold">PayPal dispute {m.paypalDisputeId}: {m.paypalDisputeStatus?.replaceAll("_", " ").toLowerCase()}</p>
            <p>The client opened a dispute on PayPal. {role === "freelancer" ? "Answer it in PayPal's Resolution Center and attach the proof report (open it, then Print → Save as PDF)." : "PayPal reviews it with the proof report Verifund recorded."}</p>
            {m.submission && <Link href={`/jobs/${m.jobId}/report/${m.submission.id}`} className="font-semibold underline">Open the proof report</Link>}
          </Banner>
        )}

        {isClient && m.state === "draft" ? (
          <form action={saveMilestone.bind(null, m.id)} className="space-y-3 rounded-lg border border-line p-4">
            <p className="text-sm font-semibold">Review before funding: the AI checks against exactly this list.</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_14rem]">
              <label className="space-y-1 text-sm font-medium">Title<input name="title" defaultValue={m.title} className={field} /></label>
              <label className="space-y-1 text-sm font-medium">Amount<input name="amount" type="number" step="0.01" min="0.01" defaultValue={toPayPalValue(m.amountMinor, job.currency)} className={field} /></label>
              <label className="space-y-1 text-sm font-medium">Proof type
                <select name="proofType" defaultValue={m.proofType} className={field}><option value="website">Website or GitHub repo</option><option value="photo">Before/after photos</option><option value="design">Design mockup</option></select>
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">Checklist (one requirement per line)
              <textarea name="checklist" rows={Math.max(3, m.checklist.length + 1)} className={field} defaultValue={m.checklist.filter((c) => c.kind === "item").map((c) => c.requirement).join("\n")} />
            </label>
            {m.proofType === "website" && (
              <label className="block space-y-1 text-sm font-medium">Customer journeys (optional, one per line)
                <textarea name="journeys" rows={2} className={field} defaultValue={m.checklist.filter((c) => c.kind === "journey").map((c) => c.requirement).join("\n")}
                  placeholder="A customer can book a table for 4 on Friday evening and sees a confirmation" />
                <span className="block text-xs font-normal text-ink-soft">Things a customer must be able to do from start to finish. The AI does each one in a real browser, like a customer, and only passes it if it works.</span>
              </label>
            )}
            {m.proofType !== "design" && (
              <fieldset className="space-y-2 rounded-lg bg-canvas p-3">
                <legend className="px-1 text-sm font-semibold">Handover: make sure you own what you pay for (optional)</legend>
                {m.proofType === "website" && (
                  <label className="block space-y-1 text-sm font-medium">Your domain
                    <input name="domain" className={field} placeholder="sunrisebakery.com" defaultValue={m.checklist.find((c) => c.kind === "domain")?.requirement.split(": ")[1] ?? ""} />
                    <span className="block text-xs font-normal text-ink-soft">The site must be delivered on this domain. Checked by code, not the AI.</span>
                  </label>
                )}
                <label className="block space-y-1 text-sm font-medium">What you must receive (one per line)
                  <textarea name="handover" rows={2} className={field} defaultValue={m.checklist.filter((c) => c.kind === "handover").map((c) => c.requirement).join("\n")}
                    placeholder={"Admin login for the website\nGitHub repository transferred to my account"} />
                  <span className="block text-xs font-normal text-ink-soft">Only you can see these, so you confirm each one before paying. A &ldquo;no&rdquo; sends the work back to the freelancer.</span>
                </label>
              </fieldset>
            )}
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
                <p className="mt-1 text-xs text-ink-soft">{data.milestones.some((x) => x.proofType === "design" && x.position < m.position) ? "Leave empty to use the design you approve in the design milestone." : "A mockup or screenshot. The AI compares the live homepage with it."}</p>
              </div>
            )}
            <SubmitButton className={btn.secondary} pending="Saving…">Save checklist</SubmitButton>
          </form>
        ) : (
          <Checklist m={m} />
        )}
        {isClient && m.state === "draft" && (
          <ExpectationFinder find={findExpectationsAction.bind(null, m.id)} apply={applyExpectationsAction.bind(null, m.id)} />
        )}
        {m.excluded.length > 0 && (
          <div className="rounded-lg border border-line p-3 text-sm">
            <p className="font-semibold">Not included (agreed)</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">{m.excluded.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
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
          {isClient && job.status === "accepted" && !m.pendingAcceptance && ["draft", "funding"].includes(m.state) && (
            <div className="w-full space-y-2">
              <p className="inline-flex items-center gap-1.5 font-semibold"><Lock aria-hidden className="size-4" /> Fund {formatMoney(m.amountMinor, job.currency)}: it stays on hold until the work is verified</p>
              <PayPalButtons
                src={sdkSrc(job.currency, (m.state === "draft" ? env.PAYOUT_MODE === "direct" : m.direct) ? job.freelancerEmail : undefined)}
                amount={toPayPalValue(m.amountMinor, job.currency)}
                showMessage={job.currency === "USD"}
                createOrder={createFundingOrder.bind(null, m.id)}
                onApprove={approveFunding.bind(null, m.id)}
              />
              <form action={fundMilestone.bind(null, m.id)}>
                <button className="cursor-pointer text-xs text-ink-soft underline hover:text-ink">Or pay on PayPal&apos;s website</button>
              </form>
            </div>
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
            {m.proofType === "design" ? (
              <DesignProofForm action={submitProof.bind(null, m.id)} />
            ) : m.proofType === "photo" ? (
              <PhotoProofForm action={submitProof.bind(null, m.id)} />
            ) : (
              <ProofLinkForm action={submitProof.bind(null, m.id)} id={m.id} defaultUrl={m.submission?.url ?? undefined} demo={data.demo} code={ownershipCode(job.freelancerId ?? "none")} preview={m.proofType === "website"} />
            )}
          </div>
        )}

        {m.submission?.inboxCode && m.state !== "draft" && (
          <InboxCheck code={m.submission.inboxCode} confirmed={m.submission.inboxConfirmed} ask={isClient && m.state === "passed"}
            yes={confirmInboxAction.bind(null, m.id, true)} no={confirmInboxAction.bind(null, m.id, false)} />
        )}
        {isClient && m.state === "passed" && m.checklist.some((c) => c.kind === "handover" && c.confirmed === null) && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <p className="font-semibold text-amber-950">Before you pay: did you receive these?</p>
            <ul className="space-y-2">
              {m.checklist.filter((c) => c.kind === "handover" && c.confirmed === null).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                  <span className="font-medium">{c.requirement}</span>
                  <span className="flex gap-2">
                    <form action={confirmHandoverAction.bind(null, c.id, job.id, true)}><SubmitButton className={btn.primary} pending="…">Yes</SubmitButton></form>
                    <form action={confirmHandoverAction.bind(null, c.id, job.id, false)}><SubmitButton className={btn.secondary} pending="…">No</SubmitButton></form>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-900">&ldquo;No&rdquo; sends the work back to the freelancer to hand it over (they can dispute it). If you don&apos;t answer, payment releases as usual.</p>
          </div>
        )}
        {isClient && m.state === "passed" && (
          <div className="space-y-3 rounded-lg border border-emerald-200 p-4">
            <form action={approveRelease.bind(null, m.id)}>
              <SubmitButton className={btn.primary} pending="Paying…"><CheckCircle2 aria-hidden className="size-4" /> {m.proofType === "design" ? "Approve design & pay" : "Approve & pay now"}</SubmitButton>
            </form>
            {m.proofType === "design" && (
              <details open={m.changeRequests < job.revisionRounds}>
                <summary className={`${btn.secondary} list-none`}><Palette aria-hidden className="size-4" /> Ask for changes</summary>
                <div className="mt-3"><ChangeRequestForm action={requestDesignChanges.bind(null, m.id)} left={job.revisionRounds - m.changeRequests} total={job.revisionRounds} /></div>
              </details>
            )}
            <details>
              <summary className={`${btn.secondary} list-none`}><Scale aria-hidden className="size-4" /> Dispute the result</summary>
              <div className="mt-3"><StatementForm action={openDisputeAction.bind(null, m.id)} items={m.checklist} label={m.proofType === "design" ? "Why the design misses that item" : "What is not done, despite the AI's pass?"} cta="Open dispute" placeholder={m.proofType === "design" ? "The mockup has no menu section, which the checklist asks for…" : "The contact form submits but no email arrives…"} /></div>
            </details>
          </div>
        )}
        {role === "freelancer" && m.state === "failed" && (m.verdict.length > 0 || m.proofType === "design") && (
          <details className="rounded-lg border border-line p-4">
            <summary className="cursor-pointer text-sm font-semibold">{m.proofType === "design" ? "Is the change outside what you agreed? Dispute it" : "Think the AI got it wrong? Dispute it"}</summary>
            <div className="mt-3"><StatementForm action={openDisputeAction.bind(null, m.id)} label="Why the work meets the checklist" cta="Open dispute" placeholder="The opening hours are in the footer of every page…" /></div>
          </details>
        )}
        {m.dispute && (
          <DisputePanel
            d={m.dispute}
            role={role}
            amountLabel={formatMoney(m.amountMinor, job.currency)}
            splitLabels={m.dispute.judgeShare === null ? null : {
              freelancer: formatMoney(shareMinor(m.amountMinor, m.dispute.judgeShare), job.currency),
              client: formatMoney(m.amountMinor - shareMinor(m.amountMinor, m.dispute.judgeShare), job.currency),
            }}
            actions={{
              respond: respondDisputeAction.bind(null, m.id),
              ask: askJudgeAction.bind(null, m.id),
              accept: acceptDecisionAction.bind(null, m.id),
              reject: rejectDecisionAction.bind(null, m.id),
            }}
          />
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
  const { id } = await params;
  const [data, payments] = await Promise.all([loadJobForUser(id, user), loadPaymentsForUser(user, { jobId: id })]);
  const { job, role, milestones, client, freelancer } = data;
  const total = milestones.reduce((s, m) => s + m.amountMinor, 0);
  const paid = milestones.filter((m) => m.state === "paid_out").reduce((s, m) => s + m.amountMinor, 0);
  const held = milestones.filter((m) => ["funded", "verifying", "failed", "passed"].includes(m.state)).reduce((s, m) => s + m.amountMinor, 0)
    + milestones.filter((m) => m.warrantyStatus === "holding" || m.warrantyStatus === "settling").reduce((s, m) => s + (m.warrantyMinor ?? 0), 0);

  return (
    <>
      <Header user={user} />
      <AutoRefresh
        active={milestones.some((m) => m.state === "verifying" || !!m.preview?.running)}
        refreshAt={[...milestones.filter((m) => m.state === "passed" && m.releaseAt).map((m) => m.releaseAt!.toISOString()),
          ...milestones.filter((m) => m.warrantyStatus === "holding" && m.warrantyUntil).map((m) => m.warrantyUntil!.toISOString())].sort()[0]}
      />
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
                  {person.email && person.name !== person.email && <dd className="text-xs text-ink-soft break-all">{person.email}</dd>}
                </div>
              );
            })}
          </dl>
        </div>

        {job.warrantyPercent > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-sm text-sky-900"><ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span><b>Warranty: {job.warrantyPercent}% for {job.warrantyDays} days.</b> When a live website is approved, {job.warrantyPercent}% stays held by PayPal while Verifund checks the site daily. It&apos;s paid automatically if the site keeps working, and goes back to the client only if a page breaks and isn&apos;t fixed in time.</span></p>
        )}
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

        {job.status === "accepted" && <ScopeSection data={data} />}
      </main>
    </>
  );
}
