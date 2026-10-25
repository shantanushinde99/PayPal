import { describe, it, expect } from "vitest";
import { describePayment } from "./payment-view";

const who = { client: "client@x.test", freelancer: "free@x.test" };

describe("describePayment", () => {
  it("shows a hold as money leaving the client and funding the freelancer", () => {
    expect(describePayment("hold", "client", who)).toMatchObject({ sign: "-", status: "Held", tone: "held", title: "Held by PayPal" });
    expect(describePayment("hold", "freelancer", who)).toMatchObject({ sign: "", status: "Held", title: "Funded · awaiting verification" });
  });
  it("shows a direct payment as paid by the client and received by the freelancer", () => {
    expect(describePayment("paid", "client", who)).toMatchObject({ sign: "-", status: "Completed", tone: "done", title: "Paid to free@x.test" });
    expect(describePayment("paid", "freelancer", who)).toMatchObject({ sign: "+", status: "Completed", tone: "done", title: "Received from client@x.test" });
  });
  it("shows a released hold as money back to the client", () => {
    expect(describePayment("void", "client", who)).toMatchObject({ sign: "+", status: "Released", tone: "returned", title: "Hold released back to you" });
    expect(describePayment("void", "freelancer", who)).toMatchObject({ sign: "", title: "Client cancelled · hold released" });
  });
  it("in payouts mode shows each side one row, not two", () => {
    expect(describePayment("captured", "client", who)).toMatchObject({ sign: "-", title: "Paid to free@x.test" });
    expect(describePayment("captured", "freelancer", who)).toBeNull();
    expect(describePayment("payout", "freelancer", who)).toMatchObject({ sign: "+", title: "Received from client@x.test" });
    expect(describePayment("payout", "client", who)).toBeNull();
  });
});
