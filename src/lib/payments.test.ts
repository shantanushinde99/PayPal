import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, payments } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";

const pp = vi.hoisted(() => ({
  createOrder: vi.fn(), authorizeOrder: vi.fn(), captureAuthorization: vi.fn(), voidAuthorization: vi.fn(), createPayout: vi.fn(),
}));
vi.mock("@/lib/paypal", () => pp);
import { release, cancel, completeFunding, startFunding } from "./payments";

const stateOf = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0].state;

beforeEach(() => {
  Object.values(pp).forEach((f) => f.mockReset());
  pp.captureAuthorization.mockResolvedValue("CAP");
  pp.createPayout.mockResolvedValue("BATCH");
  pp.authorizeOrder.mockResolvedValue("AUTH");
});

describe("release", () => {
  it("refuses to move money for a milestone that has not passed verification", async () => {
    const m = await seedMilestone({ state: "failed", authorizationId: "A1" });
    await expect(release(m.id)).rejects.toThrow();
    expect(pp.captureAuthorization).not.toHaveBeenCalled();
    expect(pp.createPayout).not.toHaveBeenCalled();
  });
  it("pays out a passed milestone", async () => {
    const m = await seedMilestone({ state: "passed", authorizationId: "A1" });
    await release(m.id);
    expect(await stateOf(m.id)).toBe("paid_out");
  });
});

describe("cancel", () => {
  it("marks the milestone cancelled before voiding the hold", async () => {
    const m = await seedMilestone({ state: "funded", authorizationId: "A1" });
    pp.voidAuthorization.mockImplementation(async () => { expect(await stateOf(m.id)).toBe("cancelled"); });
    await cancel(m.id);
    expect(pp.voidAuthorization).toHaveBeenCalledWith("A1");
  });
});

describe("completeFunding", () => {
  it("does not authorize a cancelled milestone", async () => {
    const m = await seedMilestone({ state: "cancelled", orderId: "O1" });
    await expect(completeFunding(m.id, "O1")).rejects.toThrow();
    expect(pp.authorizeOrder).not.toHaveBeenCalled();
  });
  it("is a no-op when the return URL is reloaded after funding", async () => {
    const m = await seedMilestone({ state: "funded", orderId: "O1", authorizationId: "AUTH" });
    await expect(completeFunding(m.id, "O1")).resolves.toBe(m.jobId);
    expect(pp.authorizeOrder).not.toHaveBeenCalled();
  });
});

describe("direct mode (milestone funded straight to the freelancer)", () => {
  it("funds with the freelancer as payee", async () => {
    pp.createOrder.mockResolvedValue({ orderId: "O9", approveUrl: "https://pp/approve" });
    const m = await seedMilestone({ state: "draft", direct: true });
    await startFunding(m.id);
    expect(pp.createOrder.mock.calls[0][0].payeeEmail).toBe("free@example.com");
  });
  it("releases with a capture only, no payout", async () => {
    const m = await seedMilestone({ state: "passed", authorizationId: "A1", direct: true });
    await release(m.id);
    expect(pp.captureAuthorization).toHaveBeenCalledWith("A1", m.id);
    expect(pp.createPayout).not.toHaveBeenCalled();
    expect(await stateOf(m.id)).toBe("paid_out");
  });
  it("keeps using payouts for milestones funded in payouts mode", async () => {
    const m = await seedMilestone({ state: "passed", authorizationId: "A1", direct: false });
    await release(m.id);
    expect(pp.createPayout).toHaveBeenCalled();
  });
});

describe("payment records", () => {
  const kinds = async (id: string) => (await db.select().from(payments).where(eq(payments.milestoneId, id))).map((p) => [p.kind, p.amountMinor, p.paypalId]);
  it("records the hold when funding completes", async () => {
    const m = await seedMilestone({ state: "funding", orderId: "O7" });
    await completeFunding(m.id, "O7");
    expect(await kinds(m.id)).toEqual([["hold", 1000, "AUTH"]]);
  });
  it("records a direct payment on release", async () => {
    const m = await seedMilestone({ state: "passed", authorizationId: "A1", direct: true });
    await release(m.id);
    expect(await kinds(m.id)).toEqual([["paid", 1000, "CAP"]]);
  });
  it("records capture and payout in payouts mode", async () => {
    const m = await seedMilestone({ state: "passed", authorizationId: "A1", direct: false });
    await release(m.id);
    expect(await kinds(m.id)).toEqual([["captured", 1000, "CAP"], ["payout", 950, "BATCH"]]);
  });
  it("records the released hold on cancel", async () => {
    const m = await seedMilestone({ state: "funded", authorizationId: "A9" });
    await cancel(m.id);
    expect(await kinds(m.id)).toEqual([["void", 1000, "A9"]]);
  });
  it("records the capture once even when the payout is retried", async () => {
    const m = await seedMilestone({ state: "passed", authorizationId: "A1", direct: false });
    pp.createPayout.mockRejectedValueOnce(new Error("PayPal down"));
    await expect(release(m.id)).rejects.toThrow();
    await release(m.id);
    expect((await kinds(m.id)).map((k) => k[0])).toEqual(["captured", "payout"]);
  });
});
