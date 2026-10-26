import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, milestones, payments, paypalEvents } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";

const pp = vi.hoisted(() => ({
  createOrder: vi.fn(), authorizeOrder: vi.fn(), captureAuthorization: vi.fn(), voidAuthorization: vi.fn(), createPayout: vi.fn(),
  provideDisputeEvidence: vi.fn(), verifyWebhookSignature: vi.fn(),
}));
vi.mock("@/lib/paypal", () => pp);
import { handlePayPalEvent } from "./webhooks";
import { POST } from "@/app/api/paypal/webhook/route";

const ev = (event_type: string, resource: object) => ({ id: "WH-" + randomUUID(), event_type, resource });
const get = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0];
beforeEach(() => { Object.values(pp).forEach((f) => f.mockReset()); pp.authorizeOrder.mockResolvedValue("AUTH-W"); });

describe("PayPal webhooks", () => {
  it("rejects events whose signature PayPal doesn't confirm, and stores nothing", async () => {
    pp.verifyWebhookSignature.mockResolvedValue(false);
    const e = ev("PAYMENT.CAPTURE.COMPLETED", { id: "X" });
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify(e) }));
    expect(res.status).toBe(401);
    expect(await db.select().from(paypalEvents).where(eq(paypalEvents.id, e.id))).toEqual([]);
  });

  it("finishes funding when the client closed the tab, once even if PayPal retries", async () => {
    const m = await seedMilestone({ state: "funding", orderId: "ORD-W" });
    const e = ev("CHECKOUT.ORDER.APPROVED", { id: "ORD-W", purchase_units: [{ reference_id: m.id }] });
    expect(await handlePayPalEvent(e)).toBe(true);
    expect(await handlePayPalEvent(e)).toBe(false); // repeat delivery
    expect((await get(m.id)).state).toBe("funded");
    expect(pp.authorizeOrder).toHaveBeenCalledTimes(1);
    expect((await db.select().from(paypalEvents).where(eq(paypalEvents.id, e.id)))[0].milestoneId).toBe(m.id);
  });

  it("ignores an approval for an unknown milestone", async () => {
    expect(await handlePayPalEvent(ev("CHECKOUT.ORDER.APPROVED", { id: "O", purchase_units: [{ reference_id: randomUUID() }] }))).toBe(true);
  });

  it("marks a capture as confirmed by PayPal", async () => {
    const m = await seedMilestone({ state: "paid_out" });
    const cap = "CAP-" + randomUUID();
    await db.insert(payments).values({ milestoneId: m.id, kind: "paid", amountMinor: 1000, currency: "USD", paypalId: cap });
    await handlePayPalEvent(ev("PAYMENT.CAPTURE.COMPLETED", { id: cap }));
    const [p] = await db.select().from(payments).where(eq(payments.paypalId, cap));
    expect(p.confirmedAt).toBeInstanceOf(Date);
  });

  it("links a PayPal buyer dispute to the milestone and falls back to guidance when evidence can't be sent", async () => {
    const m = await seedMilestone({ state: "paid_out" });
    const cap = "CAP-" + randomUUID();
    await db.insert(payments).values({ milestoneId: m.id, kind: "paid", amountMinor: 1000, currency: "USD", paypalId: cap });
    pp.provideDisputeEvidence.mockRejectedValue(new Error("PayPal 403"));
    await handlePayPalEvent(ev("CUSTOMER.DISPUTE.CREATED", { dispute_id: "PP-D-1", status: "WAITING_FOR_SELLER_RESPONSE", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED", disputed_transactions: [{ seller_transaction_id: cap }] }));
    const after = await get(m.id);
    expect([after.paypalDisputeId, after.paypalDisputeStatus]).toEqual(["PP-D-1", "WAITING_FOR_SELLER_RESPONSE"]);
    expect(pp.provideDisputeEvidence.mock.calls[0][1]).toContain("has a form");
    const log = (await db.select().from(events).where(eq(events.milestoneId, m.id))).map((x) => x.message).join("\n");
    expect(log).toContain("Resolution Center");
  });
});
