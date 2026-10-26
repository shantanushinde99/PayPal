import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { Gavel } from "lucide-react";
import { db } from "@/db";
import { disputes, jobs, milestones } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { Header } from "@/components/header";
import { Card } from "@/components/ui";
import { AdminDecision } from "./admin-decision";
import { resolveByAdminAction } from "@/app/jobs/dispute-actions";

// Human review for disputes where someone rejected the AI Judge.
export default async function AdminDisputes() {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  const open = await db.select({ d: disputes, m: milestones, j: jobs }).from(disputes)
    .innerJoin(milestones, eq(milestones.id, disputes.milestoneId)).innerJoin(jobs, eq(jobs.id, milestones.jobId))
    .where(inArray(disputes.status, ["escalated"])).orderBy(desc(disputes.createdAt));
  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Escalated disputes</h1>
        {open.length === 0 && <Card className="p-8 text-center text-ink-soft">Nothing waiting for a human decision.</Card>}
        {open.map(({ d, m, j }) => (
          <Card key={d.id} className="space-y-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/jobs/${j.id}`} className="font-semibold underline">{j.title} · {m.title}</Link>
              <span className="font-semibold tabular-nums">{formatMoney(m.amountMinor, j.currency)} on hold</span>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p><b>Client:</b> {d.clientStatement ?? "—"}</p>
              <p><b>Freelancer:</b> {d.freelancerStatement ?? "—"}</p>
            </div>
            <p className="flex gap-2 rounded-lg bg-canvas p-3 text-sm"><Gavel aria-hidden className="size-4 shrink-0" /><span><b>AI Judge {d.judgeShare}%:</b> {d.judgeReasoning} <i>(rejected by the {d.rejectedBy})</i></span></p>
            <AdminDecision action={resolveByAdminAction.bind(null, m.id)} defaultShare={d.judgeShare ?? 50} />
          </Card>
        ))}
      </main>
    </>
  );
}
