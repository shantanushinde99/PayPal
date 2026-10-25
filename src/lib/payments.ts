import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, events } from "@/db/schema";
import { transition } from "@/db/transition";
import { env } from "@/lib/env";
import { payoutMinor, formatMoney } from "@/lib/money";
import { canTransition, type MilestoneState } from "@/lib/milestone-state";
import { createOrder, authorizeOrder, captureAuthorization, voidAuthorization, createPayout } from "@/lib/paypal";

async function load(milestoneId: string) {
  const [row] = await db.select({ m: milestones, j: jobs }).from(milestones)
    .innerJoin(jobs, eq(jobs.id, milestones.jobId)).where(eq(milestones.id, milestoneId));
  if (!row) throw new Error("Milestone not found");
  return { ...row, state: row.m.state as MilestoneState };
}

const logPayment = (milestoneId: string, message: string) =>
  db.insert(events).values({ milestoneId, kind: "payment", message });

export async function startFunding(milestoneId: string) {
  const { m, j, state } = await load(milestoneId);
  const { orderId, approveUrl } = await createOrder({
    milestoneId, title: `${j.title} — ${m.title}`, amountMinor: m.amountMinor, currency: j.currency,
    returnUrl: `${env.APP_URL}/api/paypal/return?milestone=${milestoneId}`,
    cancelUrl: `${env.APP_URL}/jobs/${j.id}`,
  });
  await transition(milestoneId, state, "funding", { orderId });
  return approveUrl;
}

export async function completeFunding(milestoneId: string, orderId: string) {
  const { m, j } = await load(milestoneId);
  if (m.orderId !== orderId) throw new Error("Order does not match milestone");
  const authorizationId = await authorizeOrder(orderId, milestoneId);
  await transition(milestoneId, "funding", "funded", { authorizationId });
  await logPayment(milestoneId, `${formatMoney(m.amountMinor, j.currency)} on hold (authorization ${authorizationId})`);
  return j.id;
}

export async function cancel(milestoneId: string) {
  const { m, state } = await load(milestoneId);
  if (!canTransition(state, "cancelled")) throw new Error(`Can't cancel a milestone that is ${state}`);
  if (m.authorizationId) {
    await voidAuthorization(m.authorizationId);
    await logPayment(milestoneId, "Hold released to client (authorization voided)");
  }
  await transition(milestoneId, state, "cancelled");
}

// Called only after shouldRelease() passed and the milestone is in `passed`.
// ponytail: payout right after capture; review window comes in the Stage 4 plan.
export async function release(milestoneId: string) {
  const { m, j } = await load(milestoneId);
  const captureId = m.captureId ?? await captureAuthorization(m.authorizationId!, milestoneId);
  await db.update(milestones).set({ captureId }).where(eq(milestones.id, milestoneId));
  await logPayment(milestoneId, `Captured ${formatMoney(m.amountMinor, j.currency)} (capture ${captureId})`);

  const amount = payoutMinor(m.amountMinor);
  const payoutBatchId = await createPayout({
    milestoneId, email: j.freelancerEmail, amountMinor: amount, currency: j.currency, note: `${j.title} — ${m.title}`,
  });
  await transition(milestoneId, "passed", "paid_out", { payoutBatchId });
  await logPayment(milestoneId, `Paid ${formatMoney(amount, j.currency)} to ${j.freelancerEmail} (payout ${payoutBatchId})`);
}
