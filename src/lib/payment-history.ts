import { and, eq, inArray } from "drizzle-orm";
import { jobRole, myJobsWhere } from "@/lib/job-access";
import { db } from "@/db";
import { jobs, milestones, payments, users } from "@/db/schema";
import { describePayment, type PaymentView, type Role } from "@/lib/payment-view";

export type PaymentItem = {
  id: string; kind: string; amountMinor: number; currency: string; paypalId: string; createdAt: Date;
  jobId: string; jobTitle: string; milestoneTitle: string; role: Role; view: PaymentView;
};

// Later stages first when two movements share a timestamp (hold + capture in one request).
const STAGE: Record<string, number> = { hold: 0, captured: 1, payout: 2, paid: 2, void: 2 };

export async function loadPaymentsForUser(user: { id: string; email: string }, opts: { jobId?: string; limit?: number } = {}): Promise<PaymentItem[]> {
  const mine = myJobsWhere(user);
  const rows = await db
    .select({ p: payments, milestoneTitle: milestones.title, job: jobs, clientEmail: users.email, clientName: users.displayName })
    .from(payments)
    .innerJoin(milestones, eq(milestones.id, payments.milestoneId))
    .innerJoin(jobs, eq(jobs.id, milestones.jobId))
    .innerJoin(users, eq(users.id, jobs.clientId))
    .where(opts.jobId ? and(mine, eq(jobs.id, opts.jobId)) : mine);

  // Show people by name (demo login emails are internal). Freelancer = linked account, else payout email.
  const freeIds = [...new Set(rows.flatMap(({ job }) => (job.freelancerId ? [job.freelancerId] : [])))];
  const freeNames = new Map((freeIds.length ? await db.select({ id: users.id, n: users.displayName }).from(users).where(inArray(users.id, freeIds)) : []).map((u) => [u.id, u.n]));

  // A hold that was later paid out or released is history, not money still waiting.
  const closed = new Set(rows.filter(({ p }) => p.kind !== "hold").map(({ p }) => p.milestoneId));

  return rows
    .sort((a, b) => b.p.createdAt.getTime() - a.p.createdAt.getTime() || (STAGE[b.p.kind] ?? 0) - (STAGE[a.p.kind] ?? 0))
    .flatMap(({ p, milestoneTitle, job, clientEmail, clientName }) => {
      const role = jobRole(job, user) as Role; // non-null: rows are filtered by the same rule
      const freelancer = (job.freelancerId && freeNames.get(job.freelancerId)) || job.freelancerEmail;
      let view = describePayment(p.kind, role, { client: clientName ?? clientEmail, freelancer });
      if (view && p.kind === "hold" && closed.has(p.milestoneId)) view = { ...view, sign: "", status: "Settled", tone: "returned" };
      return view ? [{ ...p, jobId: job.id, jobTitle: job.title, milestoneTitle, role, view }] : [];
    })
    .slice(0, opts.limit ?? Infinity);
}
