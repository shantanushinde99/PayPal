import { describe, it, expect } from "vitest";
import { describePayment } from "./payment-view";
import { walletSummary } from "./wallet";
import type { PaymentItem } from "./payment-history";

const who = { client: "c@x.test", freelancer: "f@x.test" };
const item = (kind: string, role: "client" | "freelancer", amountMinor: number, currency = "USD", settled = false): PaymentItem => {
  let view = describePayment(kind, role, who)!;
  if (settled) view = { ...view, sign: "", status: "Settled", tone: "returned" };
  return { id: Math.random().toString(), kind, amountMinor, currency, paypalId: "X", createdAt: new Date(), jobId: "j", jobTitle: "J", milestoneTitle: "M", role, view };
};

describe("walletSummary", () => {
  it("adds up received, paid, on hold and released per currency", () => {
    const s = walletSummary([
      item("paid", "freelancer", 30000),          // +300 received
      item("hold", "freelancer", 8000),           // 80 incoming, still held
      item("paid", "client", 2000),               // -20 paid
      item("hold", "client", 2000, "USD", true),  // settled: not counted as held
      item("hold", "client", 5000),               // 50 of my money on hold
      item("void", "client", 1000),               // 10 released back
      item("paid", "client", 4000, "EUR"),        // -40 EUR paid
    ]);
    expect(s).toEqual([
      { currency: "EUR", received: 0, paid: 4000, onHoldMine: 0, incoming: 0, released: 0, count: 1 },
      { currency: "USD", received: 30000, paid: 2000, onHoldMine: 5000, incoming: 8000, released: 1000, count: 6 },
    ]);
  });
  it("returns nothing for an empty wallet", () => {
    expect(walletSummary([])).toEqual([]);
  });
});
