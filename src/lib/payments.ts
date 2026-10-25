import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, events, payments } from "@/db/schema";
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

const record = (milestoneId: string, kind: string, amountMinor: number, currency: string, paypalId: string) =>
  db.insert(payments).values({ milestoneId, kind, amountMinor, currency, paypalId });

export async function startFunding(milestoneId: string) {
  const { m, j, state } = await load(milestoneId);
  if (j.status !== "accepted") throw new Error("The freelancer hasn't accepted this job yet.");
  const direct = m.state === "draft" ? env.PAYOUT_MODE === "direct" : m.direct; // mode is fixed at first funding
  const { orderId, approveUrl } = await createOrder({
    milestoneId, title: `${j.title} — ${m.title}`, amountMinor: m.amountMinor, currency: j.currency,
    returnUrl: `${env.APP_URL}/api/paypal/return?milestone=${milestoneId}`,
    cancelUrl: `${env.APP_URL}/jobs/${j.id}`,
    payeeEmail: direct ? j.freelancerEmail : undefined,
  });
  await transition(milestoneId, state, "funding", { orderId, direct });
  return approveUrl;
}

export async function completeFunding(milestoneId: string, orderId: string) {
  const { m, j, state } = await load(milestoneId);
  if (m.orderId !== orderId) throw new Error("Order does not match milestone");
  if (state === "funded" && m.authorizationId) return j.id; // return URL reloaded
  if (state !== "funding") throw new Error(`Milestone is ${state}, not awaiting payment`);
  const authorizationId = await authorizeOrder(orderId, milestoneId);
  try {
    await transition(milestoneId, "funding", "funded", { authorizationId });
  } catch (e) {
    await voidAuthorization(authorizationId); // cancelled meanwhile: don't leave money held
    throw e;
  }
  await record(milestoneId, "hold", m.amountMinor, j.currency, authorizationId);
  await logPayment(milestoneId, `${formatMoney(m.amountMinor, j.currency)} on hold (authorization ${authorizationId})`);
  return j.id;
}

export async function cancel(milestoneId: string) {
  const { m, j, state } = await load(milestoneId);
  if (!canTransition(state, "cancelled")) throw new Error(`Can't cancel a milestone that is ${state}`);
  await transition(milestoneId, state, "cancelled"); // first, so a racing resubmit can't run on a voided hold
  if (m.authorizationId) {
    await voidAuthorization(m.authorizationId);
    await record(milestoneId, "void", m.amountMinor, j.currency, m.authorizationId);
    await logPayment(milestoneId, "Hold released to client (authorization voided)");
  }
}

// Called only after shouldRelease() passed and the milestone is in `passed`.
// ponytail: payout right after capture; review window comes in the Stage 4 plan.
export async function release(milestoneId: string) {
  const { m, j, state } = await load(milestoneId);
  if (state !== "passed") throw new Error(`Only verified milestones can be paid (this one is ${state})`);
  const captureId = m.captureId ?? await captureAuthorization(m.authorizationId!, milestoneId);
  await db.update(milestones).set({ captureId }).where(eq(milestones.id, milestoneId));
  if (m.direct) {
    await transition(milestoneId, "passed", "paid_out");
    await record(milestoneId, "paid", m.amountMinor, j.currency, captureId);
    await logPayment(milestoneId, `Paid ${formatMoney(m.amountMinor, j.currency)} directly to ${j.freelancerEmail} (capture ${captureId})`);
    return;
  }
  if (!m.captureId) { // first attempt only: a retried payout must not list the capture twice
    await record(milestoneId, "captured", m.amountMinor, j.currency, captureId);
    await logPayment(milestoneId, `Captured ${formatMoney(m.amountMinor, j.currency)} (capture ${captureId})`);
  }

  const amount = payoutMinor(m.amountMinor);
  const payoutBatchId = await createPayout({
    milestoneId, email: j.freelancerEmail, amountMinor: amount, currency: j.currency, note: `${j.title} — ${m.title}`,
  });
  await transition(milestoneId, "passed", "paid_out", { payoutBatchId });
  await record(milestoneId, "payout", amount, j.currency, payoutBatchId);
  await logPayment(milestoneId, `Paid ${formatMoney(amount, j.currency)} to ${j.freelancerEmail} (payout ${payoutBatchId})`);
}
