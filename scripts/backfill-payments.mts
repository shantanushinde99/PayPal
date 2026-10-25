// One-off: build payment records for jobs funded before the payments table existed.
// Run: npx tsx --env-file=.env --tsconfig tsconfig.json scripts/backfill-payments.mts
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { events, jobs, milestones, payments } from "@/db/schema";
import { payoutMinor } from "@/lib/money";

const done = new Set((await db.select({ id: payments.milestoneId }).from(payments)).map((r) => r.id));
const evs = await db.select({ e: events, m: milestones, j: jobs }).from(events)
  .innerJoin(milestones, eq(milestones.id, events.milestoneId)).innerJoin(jobs, eq(jobs.id, milestones.jobId))
  .where(eq(events.kind, "payment"));
const rows = evs.filter(({ m }) => !done.has(m.id)).flatMap(({ e, m, j }) => {
  const base = { milestoneId: m.id, currency: j.currency, createdAt: e.createdAt };
  let x: RegExpMatchArray | null;
  if ((x = e.message.match(/on hold \(authorization (\S+)\)/))) return [{ ...base, kind: "hold", amountMinor: m.amountMinor, paypalId: x[1] }];
  if ((x = e.message.match(/^Paid .* directly to .* \(capture (\S+)\)/))) return [{ ...base, kind: "paid", amountMinor: m.amountMinor, paypalId: x[1] }];
  if ((x = e.message.match(/^Captured .* \(capture (\S+)\)/))) return [{ ...base, kind: "captured", amountMinor: m.amountMinor, paypalId: x[1] }];
  if ((x = e.message.match(/^Paid .* \(payout (\S+)\)/))) return [{ ...base, kind: "payout", amountMinor: payoutMinor(m.amountMinor), paypalId: x[1] }];
  if (/Hold released to client/.test(e.message) && m.authorizationId) return [{ ...base, kind: "void", amountMinor: m.amountMinor, paypalId: m.authorizationId }];
  return [];
});
if (rows.length) await db.insert(payments).values(rows);
const ids = [...new Set(rows.map((r) => r.milestoneId))];
const titles = ids.length ? await db.select({ t: milestones.title }).from(milestones).where(inArray(milestones.id, ids)) : [];
console.log(`backfilled ${rows.length} payment(s):`, rows.map((r) => `${r.kind} ${r.paypalId}`).join(", "), "| milestones:", titles.map((t) => t.t).join(", "));
process.exit(0);
