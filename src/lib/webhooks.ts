import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, events, milestones, payments, paypalEvents, submissions, verdictItems } from "@/db/schema";
import { completeFunding } from "@/lib/payments";
import { provideDisputeEvidence } from "@/lib/paypal";
import { env } from "@/lib/env";

type Link = { rel?: string; href?: string };
export type PayPalEvent = {
  id: string;
  event_type: string;
  summary?: string;
  resource?: {
    id?: string; status?: string; reason?: string; dispute_id?: string; links?: Link[];
    purchase_units?: { reference_id?: string }[];
    disputed_transactions?: { seller_transaction_id?: string }[];
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const log = (milestoneId: string, message: string) => db.insert(events).values({ milestoneId, kind: "payment", message });

async function milestoneByPayPalId(ids: (string | undefined)[]) {
  const clean = ids.filter((x): x is string => !!x);
  if (!clean.length) return undefined;
  const [row] = await db.select({ milestoneId: payments.milestoneId }).from(payments).where(inArray(payments.paypalId, clean)).limit(1);
  return row?.milestoneId;
}

// Confirms the matching payment rows (a capture, a void...) as seen by PayPal.
async function confirm(paypalId: string, kinds: string[]) {
  const rows = await db.update(payments).set({ confirmedAt: new Date() })
    .where(and(eq(payments.paypalId, paypalId), inArray(payments.kind, kinds), isNull(payments.confirmedAt))).returning();
  return rows[0]?.milestoneId;
}

async function evidenceNotes(milestoneId: string) {
  const [m] = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
  const items = await db.select().from(checklistItems).where(eq(checklistItems.milestoneId, milestoneId)).orderBy(asc(checklistItems.position));
  const [sub] = await db.select().from(submissions).where(eq(submissions.milestoneId, milestoneId)).orderBy(desc(submissions.createdAt)).limit(1);
  const verdict = sub ? await db.select().from(verdictItems).where(eq(verdictItems.submissionId, sub.id)) : [];
  return [
    `Escrow milestone "${m.title}" released by Verifund after automated verification of the delivered work${sub?.url ? ` (${sub.url})` : ""}.`,
    ...items.map((c) => `- ${c.requirement}: ${verdict.find((v) => v.checklistItemId === c.id)?.status ?? "not checked"}`),
    sub ? `Full proof report: ${env.APP_URL}/jobs/${m.jobId}/report/${sub.id}` : "",
  ].join("\n");
}

async function onDispute(e: PayPalEvent) {
  const r = e.resource ?? {};
  const disputeId = r.dispute_id ?? r.id;
  const milestoneId = await milestoneByPayPalId((r.disputed_transactions ?? []).map((t) => t.seller_transaction_id));
  if (!milestoneId || !disputeId) return undefined;
  await db.update(milestones).set({ paypalDisputeId: disputeId, paypalDisputeStatus: r.status ?? e.event_type }).where(eq(milestones.id, milestoneId));
  await log(milestoneId, `PayPal dispute ${disputeId}: ${r.status ?? e.event_type}${r.reason ? ` (${r.reason})` : ""}.`);
  if (e.event_type === "CUSTOMER.DISPUTE.CREATED") {
    try {
      await provideDisputeEvidence(disputeId, await evidenceNotes(milestoneId));
      await log(milestoneId, "Verifund sent the proof report to PayPal as evidence.");
    } catch (err) {
      console.error("dispute evidence failed", disputeId, err);
      await log(milestoneId, "PayPal didn't accept automatic evidence for this dispute. The freelancer can upload the proof report in PayPal's Resolution Center.");
    }
  }
  return milestoneId;
}

// Stores each event once, then applies it. Returns false for a repeat delivery.
export async function handlePayPalEvent(e: PayPalEvent): Promise<boolean> {
  const [fresh] = await db.insert(paypalEvents).values({ id: e.id, type: e.event_type, payload: e }).onConflictDoNothing().returning();
  if (!fresh) return false;

  const r = e.resource ?? {};
  let milestoneId: string | undefined;
  switch (e.event_type) {
    case "CHECKOUT.ORDER.APPROVED": {
      // The client approved but may have closed the tab before our page could finish: finish here.
      const ref = r.purchase_units?.[0]?.reference_id;
      if (r.id && ref && UUID.test(ref)) {
        milestoneId = await completeFunding(ref, r.id).then(() => ref, (err) => void console.error("webhook funding failed", ref, err));
      }
      break;
    }
    case "PAYMENT.CAPTURE.COMPLETED":
      milestoneId = r.id && await confirm(r.id, ["paid", "captured"]);
      break;
    case "PAYMENT.AUTHORIZATION.VOIDED":
      milestoneId = r.id && await confirm(r.id, ["void"]);
      break;
    case "PAYMENT.CAPTURE.REFUNDED":
    case "PAYMENT.CAPTURE.REVERSED": {
      // A refund's resource is the refund; its "up" link points at the capture.
      const captureId = r.links?.find((l) => l.rel === "up")?.href?.split("/").pop();
      milestoneId = await milestoneByPayPalId([captureId, r.id]);
      if (milestoneId) await log(milestoneId, `PayPal reports the payment was ${e.event_type.endsWith("REFUNDED") ? "refunded" : "reversed"}.`);
      break;
    }
    default:
      if (e.event_type.startsWith("CUSTOMER.DISPUTE.")) milestoneId = await onDispute(e);
  }
  if (milestoneId) await db.update(paypalEvents).set({ milestoneId }).where(eq(paypalEvents.id, e.id));
  return true;
}
