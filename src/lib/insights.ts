import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, jobs, milestones, payments, submissions, users, verdictItems, type User } from "@/db/schema";
import { myFreelanceWhere } from "@/lib/job-access";
import { toPayPalValue } from "@/lib/money";

// Which side the numbers are for: the dashboard's client/freelancer view, or the whole platform for admins.
export type InsightsSide = "client" | "freelancer" | "platform";

const day = (d: Date) => d.toISOString().slice(0, 10);
const money = (minor: number, currency: string) => Number(toPayPalValue(minor, currency));

const STAGE: Record<string, string> = {
  draft: "Draft", funding: "Awaiting payment", funded: "On hold", verifying: "AI checking", failed: "Changes needed",
  passed: "Verified · review window", disputed: "In dispute", paid_out: "Paid", cancelled: "Cancelled",
};
const HELD = new Set(["funded", "verifying", "failed", "passed", "disputed"]); // money PayPal is holding right now

// Each payment as the viewer sees it; null = not a movement of their money (e.g. the platform's capture before a payout).
const MOVEMENT: Record<InsightsSide, Record<string, string | null>> = {
  client: { hold: "Funded (on hold)", paid: "Paid", captured: "Paid", payout: null, void: "Returned to you" },
  freelancer: { hold: "Held for you", paid: "Received", captured: null, payout: "Received", void: "Released to client" },
  platform: { hold: "Held", paid: "Paid to freelancer", captured: "Captured", payout: "Paid out", void: "Returned to client" },
};

const SETTLED = new Set(["Paid", "Received", "Paid to freelancer", "Paid out"]);

// Rows for the Insights dashboard, for one side only, so totals never mix what someone paid with what they earned.
export async function loadInsights(user: Pick<User, "id" | "email" | "isAdmin">, side: InsightsSide) {
  if (side === "platform" && !user.isAdmin) side = "client";
  const where = side === "platform" ? undefined : side === "client" ? eq(jobs.clientId, user.id) : myFreelanceWhere(user);
  const js = await db.select({ j: jobs, client: users.displayName }).from(jobs).innerJoin(users, eq(users.id, jobs.clientId)).where(where);
  const jobIds = js.map((x) => x.j.id);
  if (!jobIds.length) return { side, milestones: [], verdicts: [], payments: [], checks: [] };

  const freeIds = [...new Set(js.flatMap((x) => (x.j.freelancerId ? [x.j.freelancerId] : [])))];
  const [named, ms] = await Promise.all([
    freeIds.length ? db.select({ id: users.id, n: users.displayName }).from(users).where(inArray(users.id, freeIds)) : [],
    db.select().from(milestones).where(inArray(milestones.jobId, jobIds)),
  ]);
  const free = new Map(named.map((u) => [u.id, u.n]));
  const jobOf = new Map(js.map((x) => [x.j.id, x]));
  const msIds = ms.map((m) => m.id);
  const msOf = new Map(ms.map((m) => [m.id, m]));
  const [pays, subs] = msIds.length ? await Promise.all([
    db.select().from(payments).where(inArray(payments.milestoneId, msIds)),
    // Only the counts from the audit report: its screenshots are large.
    db.select({
      id: submissions.id, milestoneId: submissions.milestoneId, createdAt: submissions.createdAt,
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
    const client = x.client ?? "Client", freelancer = (x.j.freelancerId && free.get(x.j.freelancerId)) || x.j.freelancerEmail;
    // "counterpart" = the other party from the viewer's side; the platform sees both.
    return { job: x.j.title, currency: x.j.currency, client, freelancer, counterpart: side === "freelancer" ? client : freelancer };
  };
  const firstOf = (milestoneId: string, kinds: string[]) =>
    pays.filter((p) => p.milestoneId === milestoneId && kinds.includes(p.kind)).sort((a, b) => +a.createdAt - +b.createdAt)[0];

  return {
    side,
    milestones: ms.map((m) => {
      const w = who(m.jobId);
      const held = firstOf(m.id, ["hold"]);
      const paid = firstOf(m.id, ["paid", "captured"]);
      return {
        milestone: m.title, ...w, state: m.state, stage: STAGE[m.state] ?? m.state, proof: m.proofType,
        amount: money(m.amountMinor, w.currency),
        onHold: HELD.has(m.state) ? money(m.amountMinor, w.currency) : 0,
        paid: m.state === "paid_out" ? money(m.capturedMinor ?? m.amountMinor, w.currency) : 0,
        completed: m.state === "paid_out" ? 1 : 0,
        created: day(m.createdAt),
        daysToPaid: held && paid ? Math.round(((+paid.createdAt - +held.createdAt) / 86_400_000) * 10) / 10 : null,
      };
    }),
    verdicts: vs.map(({ v, requirement }) => {
      const s = subOf.get(v.submissionId)!;
      const m = msOf.get(s.milestoneId)!;
      return { requirement, status: v.status, reason: v.reason, milestone: m.title, job: who(m.jobId).job, checked: day(s.createdAt) };
    }),
    payments: pays.flatMap((p) => {
      const movement = MOVEMENT[side][p.kind];
      if (!movement) return [];
      const m = msOf.get(p.milestoneId)!;
      const { job, counterpart } = who(m.jobId);
      const amount = money(p.amountMinor, p.currency);
      // "settled": money that actually reached the freelancer (spent by the client, earned by the freelancer); holds and refunds aren't.
      return [{ movement, amount, settled: SETTLED.has(movement) ? amount : 0, currency: p.currency, date: day(p.createdAt), milestone: m.title, job, counterpart }];
    }),
    checks: subs.map((s) => {
      const m = msOf.get(s.milestoneId)!;
      return { milestone: m.title, job: who(m.jobId).job, proof: m.proofType, pages: s.pages ?? 0, brokenLinks: s.broken ?? 0, date: day(s.createdAt) };
    }),
  };
}

export type Insights = Awaited<ReturnType<typeof loadInsights>>;
