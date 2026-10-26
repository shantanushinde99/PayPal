import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleHelp, ExternalLink, XCircle } from "lucide-react";
import { db } from "@/db";
import { checklistItems, replays, submissions, verdictItems } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import type { SiteReport } from "@/lib/verify/site-facts";
import { Header } from "@/components/header";
import { Card, StatusBadge } from "@/components/ui";
import { loadJobForUser } from "../../../load";
import { PrintButton } from "./print-button";
import { LocalTime } from "@/components/local-time";

const ICON = {
  pass: { Icon: CheckCircle2, cls: "text-emerald-600", label: "Verified" },
  fail: { Icon: XCircle, cls: "text-red-600", label: "Not met" },
  unsure: { Icon: CircleHelp, cls: "text-amber-600", label: "Unclear" },
};

export default async function ProofReport({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const user = await requireUser();
  const { id, sid } = await params;
  const { job, milestones } = await loadJobForUser(id, user);
  const [sub] = await db.select().from(submissions).where(eq(submissions.id, sid));
  const m = milestones.find((x) => x.id === sub?.milestoneId);
  if (!sub || !m) notFound();
  const items = await db.select().from(checklistItems).where(eq(checklistItems.milestoneId, m.id)).orderBy(asc(checklistItems.position));
  const verdict = await db.select().from(verdictItems).where(eq(verdictItems.submissionId, sid));
  const [recording] = await db.select({ id: replays.submissionId }).from(replays).where(eq(replays.submissionId, sid));
  const report = sub.report as SiteReport | null;
  const passed = verdict.filter((v) => v.status === "pass").length;
  const path = (u: string) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };
  const shotFor = (u?: string | null) => report?.pages.find((p) => p.url === u)?.screenshot;
  const broken = report?.links.filter((l) => !l.ok) ?? [];

  return (
    <>
      <div className="print:hidden"><Header user={user} /></div>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 print:py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/jobs/${job.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"><ArrowLeft aria-hidden className="size-4" /> Back to job</Link>
          <PrintButton />
        </div>

        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Proof report</p>
          <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
          <p className="text-ink-soft">Milestone {m.position + 1}: {m.title} · {formatMoney(m.amountMinor, job.currency)}</p>
          <div className="flex flex-wrap items-center gap-3"><StatusBadge state={m.state} /><span className="text-sm text-ink-soft">Checked <LocalTime date={sub.createdAt} mode="full" /></span></div>
        </header>

        <Card className="grid gap-4 p-5 sm:grid-cols-3">
          <div><p className="text-sm text-ink-soft">Result</p><p className="text-xl font-bold">{passed}/{items.length} verified</p></div>
          <div><p className="text-sm text-ink-soft">Decision</p><p className="font-semibold">{passed === items.length && items.length > 0 ? "Payment released" : "Payment held"}</p></div>
          <div className="space-y-0.5 text-xs text-ink-soft break-all">
            {m.authorizationId && <p>PayPal authorization: <span className="font-mono text-ink">{m.authorizationId}</span></p>}
            {m.captureId && <p>PayPal capture: <span className="font-mono text-ink">{m.captureId}</span></p>}
            {m.payoutBatchId && <p>PayPal payout: <span className="font-mono text-ink">{m.payoutBatchId}</span></p>}
          </div>
        </Card>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Proof submitted</h2>
          {sub.url && <a href={sub.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all font-medium text-brand underline">{sub.url}<ExternalLink aria-hidden className="size-3.5" /></a>}
          {recording && (
            <figure className="space-y-1 print:hidden">
              <video controls preload="metadata" src={`/api/replays/${sid}`} className="w-full rounded-lg border border-line bg-black">Your browser can&apos;t play this recording.</video>
              <figcaption className="text-xs text-ink-soft">Recording of the AI checking the site (KERNEL cloud browser).</figcaption>
            </figure>
          )}
          {sub.beforePhoto && sub.afterPhoto && (
            <div className="grid grid-cols-2 gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sub.beforePhoto} alt="Before photo" className="rounded-lg border border-line" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sub.afterPhoto} alt="After photo" className="rounded-lg border border-line" />
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Checklist</h2>
          {items.map((c) => {
            const v = verdict.find((x) => x.checklistItemId === c.id);
            const meta = ICON[(v?.status ?? "unsure") as keyof typeof ICON] ?? ICON.unsure;
            const img = shotFor(v?.pageUrl);
            return (
              <Card key={c.id} className="break-inside-avoid space-y-2 p-4">
                <div className="flex gap-3"><meta.Icon aria-label={meta.label} className={`mt-0.5 size-5 shrink-0 ${meta.cls}`} /><p className="font-semibold">{c.requirement}</p></div>
                {v?.reason && <p className="text-sm">{v.reason}</p>}
                {v?.evidence && <p className="rounded-md bg-canvas px-3 py-2 font-mono text-xs text-ink-soft">{v.evidence}</p>}
                {v?.pageUrl && <a href={v.pageUrl} target="_blank" rel="noreferrer" className="text-sm text-brand underline break-all">{path(v.pageUrl)}</a>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img && <img src={`data:image/jpeg;base64,${img}`} alt={`Screenshot of ${path(v!.pageUrl!)}`} className="max-h-64 rounded-md border border-line" />}
              </Card>
            );
          })}
        </section>

        {report && (
          <>
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Site map ({report.pages.length} page{report.pages.length === 1 ? "" : "s"}{report.truncated ? ", page limit reached" : ""})</h2>
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-ink-soft"><tr><th className="p-3">Page</th><th className="p-3">Status</th><th className="p-3">Forms</th><th className="p-3">Phone</th><th className="p-3">Issues</th></tr></thead>
                  <tbody>
                    {report.pages.map((p) => (
                      <tr key={p.url} className="border-t border-line">
                        <td className="p-3 break-all">{path(p.url)}</td>
                        <td className="p-3 tabular-nums">{p.offsite ? "off-site" : p.status || "—"}</td>
                        <td className="p-3">{p.forms.length}</td>
                        <td className="p-3">{p.phoneOverflow ? "Overflows" : "OK"}</td>
                        <td className="p-3">{[p.brokenImages && `${p.brokenImages} broken image(s)`, p.consoleErrors.length && `${p.consoleErrors.length} script error(s)`].filter(Boolean).join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Links ({report.links.length} checked, {broken.length} broken)</h2>
              {broken.length > 0 && (
                <ul className="space-y-1 text-sm">{broken.map((l) => (
                  <li key={l.url} className="flex gap-2"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600" /><span className="break-all"><b>{l.url}</b> ({l.status || "no response"}) on {path(l.foundOn)} “{l.text}”</span></li>
                ))}</ul>
              )}
            </section>
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Contact details found</h2>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {(["emails", "phones", "whatsapp", "social"] as const).map((k) => (
                  <div key={k}><dt className="capitalize text-ink-soft">{k}</dt><dd className="break-all">{report.contacts[k].map((f) => f.value).join(", ") || "None"}</dd></div>
                ))}
              </dl>
            </section>
          </>
        )}
        <footer className="border-t border-line pt-4 text-xs text-ink-soft">Generated by Verifund. Facts (pages, links, contact details) are measured by code; judgements are made by an AI model (Gemini) and only an all-pass verdict releases payment.</footer>
      </main>
    </>
  );
}
