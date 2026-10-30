"use client";
import { useActionState } from "react";
import { CheckCircle2, Gavel, Scale, ShieldAlert, UserRound } from "lucide-react";
import type { DisputeState } from "@/app/jobs/dispute-actions";
import { SubmitButton } from "@/components/submit-button";
import { LocalTime } from "@/components/local-time";
import { btn, field } from "@/components/ui";

type Action = (prev: DisputeState, form: FormData) => Promise<DisputeState>;
type Click = () => Promise<DisputeState>;

export type DisputeView = {
  openedBy: string; status: string; clientStatement: string | null; freelancerStatement: string | null;
  judgeShare: number | null; judgeReasoning: string | null; decideAt: Date | null; clientAccepted: boolean; freelancerAccepted: boolean;
  rejectedBy: string | null; finalShare: number | null; adminNote: string | null;
};

function Err({ s }: { s: DisputeState }) {
  return s.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{s.error}</p> : null;
}

// A form posting a statement (open or respond), with the rule's error shown inline. With `items`, the client
// must pick the checklist item that isn't met.
export function StatementForm({ action, label, cta, placeholder, items }: {
  action: Action; label: string; cta: string; placeholder: string; items?: { id: string; requirement: string }[];
}) {
  const [state, run] = useActionState(action, {});
  return (
    <form action={run} className="space-y-2">
      {items && (
        <label className="block space-y-1 text-sm font-medium">Which checklist item isn&apos;t met?
          <select name="itemId" required defaultValue="" className={field}>
            <option value="" disabled>Choose an item you both agreed on…</option>
            {items.map((c) => <option key={c.id} value={c.id}>{c.requirement}</option>)}
          </select>
          <span className="block text-xs font-normal text-ink-soft">Taste and new ideas outside the checklist can&apos;t be disputed; agree them as a new milestone instead.</span>
        </label>
      )}
      <label className="block space-y-1 text-sm font-medium">{label}
        <textarea name="statement" required minLength={20} maxLength={2000} rows={3} className={field} placeholder={placeholder} />
      </label>
      <Err s={state} />
      <SubmitButton className={btn.secondary} pending="Sending…">{cta}</SubmitButton>
    </form>
  );
}

// Client asks for changes to a submitted design; the server enforces the agreed number of rounds.
export function ChangeRequestForm({ action, left, total }: { action: Action; left: number; total: number }) {
  const [state, run] = useActionState(action, {});
  return (
    <form action={run} className="space-y-2">
      <label className="block space-y-1 text-sm font-medium">What should change? ({left} of {total} rounds left)
        <textarea name="note" required minLength={10} maxLength={500} rows={3} className={field} disabled={left <= 0}
          placeholder={left > 0 ? "Make the header warmer, and move the menu above the photos." : "No rounds left: approve the design, or dispute a checklist item."} />
      </label>
      <Err s={state} />
      {left > 0 && <SubmitButton className={btn.secondary} pending="Sending…">Request changes</SubmitButton>}
    </form>
  );
}

function ClickButton({ action, className, pending, children }: { action: Click; className: string; pending: string; children: React.ReactNode }) {
  const [state, run] = useActionState(async () => action(), {});
  return (
    <form action={run} className="space-y-2">
      <SubmitButton className={className} pending={pending}>{children}</SubmitButton>
      <Err s={state} />
    </form>
  );
}

export function DisputePanel({ d, role, amountLabel, splitLabels, actions }: {
  d: DisputeView; role: "client" | "freelancer"; amountLabel: string; splitLabels: { freelancer: string; client: string } | null;
  actions: { respond: Action; ask: Click; accept: Click; reject: Click };
}) {
  const other = role === "client" ? "freelancer" : "client";
  const mine = role === "client" ? d.clientStatement : d.freelancerStatement;
  const iAccepted = role === "client" ? d.clientAccepted : d.freelancerAccepted;
  const theyAccepted = role === "client" ? d.freelancerAccepted : d.clientAccepted;
  return (
    <section aria-label="Dispute" className="space-y-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
      <h4 className="flex items-center gap-2 font-semibold text-orange-950"><Scale aria-hidden className="size-5" /> Dispute · {amountLabel} on hold</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["client", "freelancer"] as const).map((who) => {
          const text = who === "client" ? d.clientStatement : d.freelancerStatement;
          return (
            <div key={who} className="rounded-lg bg-white p-3 text-sm">
              <p className="mb-1 inline-flex items-center gap-1.5 font-semibold capitalize"><UserRound aria-hidden className="size-4" />{who}{who === d.openedBy && <span className="rounded bg-orange-100 px-1.5 text-xs font-medium text-orange-900">opened</span>}</p>
              <p className="whitespace-pre-wrap text-ink-soft">{text ?? "No statement yet."}</p>
            </div>
          );
        })}
      </div>

      {d.status === "open" && (
        <div className="space-y-3">
          {!mine && <StatementForm action={actions.respond} label={`Your side (the ${other} disputed this)`} cta="Add my side" placeholder="What was delivered, and where to see it." />}
          <p className="text-sm text-ink-soft">When both sides have explained, either of you can ask the AI Judge. It reads the checklist, the checker&apos;s evidence and both statements.</p>
          <ClickButton action={actions.ask} className={btn.primary} pending="The AI Judge is deciding…"><Gavel aria-hidden className="size-4" /> Ask the AI Judge</ClickButton>
        </div>
      )}

      {(d.status === "judged" || d.status === "escalated" || d.status === "resolved") && d.judgeShare !== null && (
        <div className="space-y-3 rounded-lg bg-white p-4">
          <p className="flex items-center gap-2 font-semibold"><Gavel aria-hidden className="size-4" /> AI Judge: {d.judgeShare}% to the freelancer</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-sky-100" aria-hidden><div className="bg-emerald-500" style={{ width: `${d.judgeShare}%` }} /></div>
          {splitLabels && <p className="text-sm text-ink-soft">Freelancer receives <b>{splitLabels.freelancer}</b> · client gets back <b>{splitLabels.client}</b></p>}
          <p className="whitespace-pre-wrap text-sm">{d.judgeReasoning}</p>
        </div>
      )}

      {d.status === "judged" && (
        <div className="space-y-2">
          <p className="text-sm">
            {iAccepted ? "You accepted." : "Accept, or reject to send it to a human reviewer."}{theyAccepted ? ` The ${other} accepted.` : ""}
            {d.decideAt && <> It settles automatically on <b><LocalTime date={d.decideAt} /></b> unless someone rejects it.</>}
          </p>
          {!iAccepted && (
            <div className="flex flex-wrap gap-2">
              <ClickButton action={actions.accept} className={btn.primary} pending="Accepting…"><CheckCircle2 aria-hidden className="size-4" /> Accept decision</ClickButton>
              <ClickButton action={actions.reject} className={btn.danger} pending="Rejecting…"><ShieldAlert aria-hidden className="size-4" /> Reject, ask a human</ClickButton>
            </div>
          )}
        </div>
      )}
      {d.status === "escalated" && <p className="text-sm font-medium text-orange-950">The {d.rejectedBy} rejected the AI decision. A human reviewer will decide; the money stays on hold until then.</p>}
      {d.status === "resolved" && <p className="text-sm font-medium text-emerald-800">Resolved: {d.finalShare}% to the freelancer.{d.adminNote && <> Reviewer&apos;s note: “{d.adminNote}”</>}</p>}
    </section>
  );
}
