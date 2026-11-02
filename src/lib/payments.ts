import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, events, payments, submissions, users, type Job, type Milestone } from "@/db/schema";
import { transition } from "@/db/transition";
import { env } from "@/lib/env";
import { payoutMinor, formatMoney, shareMinor } from "@/lib/money";
import { canTransition, type MilestoneState } from "@/lib/milestone-state";
import { createOrder, authorizeOrder, captureAuthorization, voidAuthorization, createPayout } from "@/lib/paypal";
import { isCodeHostUrl } from "@/lib/proof-link";

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

export async function startFunding(milestoneId: string, { sdk = false } = {}) {
  const { m, j, state } = await load(milestoneId);
  if (j.status !== "accepted") throw new Error("The freelancer hasn't accepted this job yet.");
  const direct = m.state === "draft" ? env.PAYOUT_MODE === "direct" : m.direct; // mode is fixed at first funding
  const { orderId, approveUrl } = await createOrder({
    milestoneId, title: `${j.title} — ${m.title}`, amountMinor: m.amountMinor, currency: j.currency,
    returnUrl: `${env.APP_URL}/api/paypal/return?milestone=${milestoneId}`,
    cancelUrl: `${env.APP_URL}/jobs/${j.id}`,
    payeeEmail: direct ? j.freelancerEmail : undefined, sdk,
  });
  await transition(milestoneId, state, "funding", { orderId, direct });
  return { orderId, approveUrl };
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
    // The webhook and the browser can both complete the same order; the PayPal request id makes them
    // share one authorization, so the loser must not void the winner's hold.
    const [now] = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
    if (now?.authorizationId === authorizationId) return j.id;
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

export const WARRANTY_DEMO_MINUTES = 10;

// A live website released in full keeps part of the hold authorized while the site is monitored (the warranty).
// PayPal keeps an authorization for 29 days, so the warranty ends well inside that.
async function warrantyPlan(m: Milestone, j: Job): Promise<{ minor: number; until: Date; days: number } | null> {
  if (j.warrantyPercent <= 0 || m.proofType !== "website") return null;
  const [sub] = await db.select({ url: submissions.url }).from(submissions)
    .where(and(eq(submissions.milestoneId, m.id), eq(submissions.preview, false))).orderBy(desc(submissions.createdAt)).limit(1);
  if (!sub?.url || isCodeHostUrl(sub.url)) return null; // only a live site can be monitored
  const minor = Math.round((m.amountMinor * Math.min(30, j.warrantyPercent)) / 100);
  if (minor <= 0 || minor >= m.amountMinor) return null;
  const [client] = await db.select({ isDemo: users.isDemo }).from(users).where(eq(users.id, j.clientId));
  const days = Math.min(14, Math.max(1, j.warrantyDays));
  const ms = client?.isDemo ? WARRANTY_DEMO_MINUTES * 60_000 : days * 24 * 3600_000;
  return { minor, until: new Date(Date.now() + ms), days };
}

// Pays the freelancer `share`% of the hold (100 = all, 0 = nothing) and returns the rest to the client.
// The only way money leaves a hold: release after the review window, and dispute decisions.
export async function settle(milestoneId: string, from: "passed" | "disputed", share: number) {
  const { m, j, state } = await load(milestoneId);
  const due = shareMinor(m.amountMinor, share); // throws on a bad share before any money moves
  if (state !== from) throw new Error(`Milestone is ${state}, not ${from}`);
  const rest = m.amountMinor - due;
  // Decided once, at the first capture; a retried payout reuses it.
  const warranty = from === "passed" && share === 100
    ? (m.captureId ? (m.warrantyMinor ? { minor: m.warrantyMinor, until: m.warrantyUntil ?? new Date(), days: j.warrantyDays } : null) : await warrantyPlan(m, j))
    : null;
  const paid = due - (warranty?.minor ?? 0);

  if (paid === 0) {
    await transition(milestoneId, from, "cancelled", { capturedMinor: 0 }); // state first, then void
    if (m.authorizationId) {
      await voidAuthorization(m.authorizationId);
      await record(milestoneId, "void", m.amountMinor, j.currency, m.authorizationId);
    }
    await logPayment(milestoneId, `${formatMoney(m.amountMinor, j.currency)} returned to the client (hold released)`);
    return;
  }

  const captureId = m.captureId ?? await (
    warranty ? captureAuthorization(m.authorizationId!, milestoneId, { amountMinor: paid, currency: j.currency, final: false, tag: "main" })
    : rest > 0 ? captureAuthorization(m.authorizationId!, milestoneId, { amountMinor: paid, currency: j.currency })
    : captureAuthorization(m.authorizationId!, milestoneId));
  await db.update(milestones).set({ captureId, ...(warranty && { warrantyMinor: warranty.minor, warrantyUntil: warranty.until }) }).where(eq(milestones.id, milestoneId));
  const held = warranty ? { warrantyStatus: "holding", warrantyCheckedAt: new Date() } : {};
  const firstAttempt = !m.captureId; // a retried payout must not list the capture twice
  if (firstAttempt && rest > 0) {
    await record(milestoneId, "void", rest, j.currency, m.authorizationId!);
    await logPayment(milestoneId, `${formatMoney(rest, j.currency)} returned to the client`);
  }
  if (firstAttempt && warranty) {
    await logPayment(milestoneId, `${formatMoney(warranty.minor, j.currency)} kept as a warranty: still held by PayPal while the site is checked every day. It's paid automatically if the site keeps working.`);
  }
  if (m.direct) {
    await transition(milestoneId, from, "paid_out", { capturedMinor: paid, ...held });
    await record(milestoneId, "paid", paid, j.currency, captureId);
    await logPayment(milestoneId, `Paid ${formatMoney(paid, j.currency)} directly to ${j.freelancerEmail} (capture ${captureId})`);
    return;
  }
  if (firstAttempt) {
    await record(milestoneId, "captured", paid, j.currency, captureId);
    await logPayment(milestoneId, `Captured ${formatMoney(paid, j.currency)} (capture ${captureId})`);
  }
  const amount = payoutMinor(paid);
  const payoutBatchId = await createPayout({
    milestoneId, email: j.freelancerEmail, amountMinor: amount, currency: j.currency, note: `${j.title} — ${m.title}`,
  });
  await transition(milestoneId, from, "paid_out", { payoutBatchId, capturedMinor: paid, ...held });
  await record(milestoneId, "payout", amount, j.currency, payoutBatchId);
  await logPayment(milestoneId, `Paid ${formatMoney(amount, j.currency)} to ${j.freelancerEmail} (payout ${payoutBatchId})`);
}

// The end of a warranty: the rest of the hold goes to the freelancer if the site kept working, back to the client
// if the monitor still sees it broken. Claimed first, so two sweeps can't both settle it; PayPal calls are idempotent,
// so a failed attempt is retried on the next sweep.
export async function settleWarranty(milestoneId: string) {
  const { m, j } = await load(milestoneId);
  const w = m.warrantyMinor;
  if (m.warrantyStatus !== "holding" || !w || !m.authorizationId) return;
  const [claimed] = await db.update(milestones).set({ warrantyStatus: "settling" })
    .where(and(eq(milestones.id, milestoneId), eq(milestones.warrantyStatus, "holding"))).returning();
  if (!claimed) return;
  try {
    if (m.warrantyIssue) {
      await voidAuthorization(m.authorizationId);
      await record(milestoneId, "void", w, j.currency, m.authorizationId);
      await db.update(milestones).set({ warrantyStatus: "returned" }).where(eq(milestones.id, milestoneId));
      await logPayment(milestoneId, `Warranty: the site was still broken (${m.warrantyIssue}), so ${formatMoney(w, j.currency)} went back to the client.`);
      return;
    }
    const captureId = await captureAuthorization(m.authorizationId, milestoneId, { amountMinor: w, currency: j.currency, final: true, tag: "warranty" });
    if (m.direct) {
      await record(milestoneId, "paid", w, j.currency, captureId);
    } else {
      const amount = payoutMinor(w);
      const batch = await createPayout({ milestoneId, email: j.freelancerEmail, amountMinor: amount, currency: j.currency, note: `${j.title} — ${m.title} (warranty)`, tag: "warranty" });
      await record(milestoneId, "captured", w, j.currency, captureId);
      await record(milestoneId, "payout", amount, j.currency, batch);
    }
    await db.update(milestones).set({ warrantyStatus: "released", capturedMinor: (m.capturedMinor ?? 0) + w }).where(eq(milestones.id, milestoneId));
    await logPayment(milestoneId, `Warranty ended with the site working: ${formatMoney(w, j.currency)} paid to ${j.freelancerEmail} (capture ${captureId}).`);
  } catch (e) {
    await db.update(milestones).set({ warrantyStatus: "holding" }).where(eq(milestones.id, milestoneId)); // retried next sweep
    throw e;
  }
}

// Full release of a verified milestone (review window ended or client approved).
export const release = (milestoneId: string) => settle(milestoneId, "passed", 100);
