import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, jobs, milestones, payments, submissions, users, verdictItems, type User } from "@/db/schema";
import { jobRole, myJobsWhere } from "@/lib/job-access";
import { toPayPalValue } from "@/lib/money";

const day = (d: Date) => d.toISOString().slice(0, 10);
const money = (minor: number, currency: string) => Number(toPayPalValue(minor, currency));

// Rows for the Insights dashboard: only the user's own jobs (admins: everything). Plain JSON, no PII beyond names.
export async function loadInsights(user: Pick<User, "id" | "email" | "isAdmin">) {
  const js = await db.select({ j: jobs, client: users.displayName }).from(jobs).innerJoin(users, eq(users.id, jobs.clientId))
    .where(user.isAdmin ? undefined : myJobsWhere(user));
  const jobIds = js.map((x) => x.j.id);
  if (!jobIds.length) return { milestones: [], verdicts: [], payments: [], checks: [] };

  const free = new Map((await db.select({ id: users.id, n: users.displayName }).from(users)
    .where(inArray(users.id, js.flatMap((x) => (x.j.freelancerId ? [x.j.freelancerId] : []))))).map((u) => [u.id, u.n]));
  const jobOf = new Map(js.map((x) => [x.j.id, x]));
  const ms = await db.select().from(milestones).where(inArray(milestones.jobId, jobIds));
  const msIds = ms.map((m) => m.id);
  const msOf = new Map(ms.map((m) => [m.id, m]));
  const [pays, subs] = msIds.length ? await Promise.all([
    db.select().from(payments).where(inArray(payments.milestoneId, msIds)),
    // Only the counts from the audit report: its screenshots are large.
    db.select({
      id: submissions.id, milestoneId: submissions.milestoneId, createdAt: submissions.createdAt, url: submissions.url,
      pages: sql<number | null>`jsonb_array_length(${submissions.report}->'pages')`,
      broken: sql<number | null>`(select count(*)::int from jsonb_array_elements(${submissions.report}->'links') l where (l->>'ok')::boolean is false)`,
    }).from(submissions).where(inArray(submissions.milestoneId, msIds)),
  ]) : [[], []];
  const subOf = new Map(subs.map((s) => [s.id, s]));
  const vs = subs.length ? await db.select({ v: verdictItems, requirement: checklistItems.requirement }).from(verdictItems)
    .innerJoin(checklistItems, eq(checklistItems.id, verdictItems.checklistItemId))
    .where(inArray(verdictItems.submissionId, subs.map((s) => s.id))) : [];

  const who = (jobId: string) => {
    const x = jobOf.get(jobId)!;
    return {
      job: x.j.title, currency: x.j.currency, client: x.client ?? "Client",
      freelancer: (x.j.freelancerId && free.get(x.j.freelancerId)) || x.j.freelancerEmail,
      myRole: user.isAdmin && !jobRole(x.j, user) ? "admin" : jobRole(x.j, user)!,
    };
  };
  const firstOf = (milestoneId: string, kinds: string[]) =>
    pays.filter((p) => p.milestoneId === milestoneId && kinds.includes(p.kind)).sort((a, b) => +a.createdAt - +b.createdAt)[0];

  return {
    milestones: ms.map((m) => {
      const w = who(m.jobId);
      const held = firstOf(m.id, ["hold"]);
      const paid = firstOf(m.id, ["paid", "captured"]);
      return {
        milestone: m.title, ...w, state: m.state, proof: m.proofType,
        amount: money(m.amountMinor, w.currency),
        paid: m.state === "paid_out" ? money(m.capturedMinor ?? m.amountMinor, w.currency) : 0,
        created: day(m.createdAt),
        daysToPaid: held && paid ? Math.round(((+paid.createdAt - +held.createdAt) / 86_400_000) * 10) / 10 : null,
      };
    }),
    verdicts: vs.map(({ v, requirement }) => {
      const s = subOf.get(v.submissionId)!;
      const m = msOf.get(s.milestoneId)!;
      return { requirement, status: v.status, reason: v.reason, milestone: m.title, job: who(m.jobId).job, checked: day(s.createdAt) };
    }),
    payments: pays.map((p) => {
      const m = msOf.get(p.milestoneId)!;
      return { kind: p.kind, amount: money(p.amountMinor, p.currency), currency: p.currency, date: day(p.createdAt), milestone: m.title, job: who(m.jobId).job };
    }),
    checks: subs.map((s) => {
      const m = msOf.get(s.milestoneId)!;
      return { milestone: m.title, job: who(m.jobId).job, proof: m.proofType, pages: s.pages ?? 0, brokenLinks: s.broken ?? 0, date: day(s.createdAt) };
    }),
  };
}

export type Insights = Awaited<ReturnType<typeof loadInsights>>;
