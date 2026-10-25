export type PaymentKind = "hold" | "paid" | "captured" | "payout" | "void";
export type Role = "client" | "freelancer";
export type PaymentView = {
  title: string;
  sign: "+" | "-" | "";
  status: "Held" | "Completed" | "Released" | "Settled";
  tone: "held" | "done" | "returned";
};

// One money movement, worded from the viewer's side. null = not shown to that side
// (in payouts mode the capture is the client's row and the payout is the freelancer's).
export function describePayment(kind: string, role: Role, who: { client: string; freelancer: string }): PaymentView | null {
  const client = role === "client";
  switch (kind) {
    case "hold":
      return client
        ? { title: "Held by PayPal", sign: "-", status: "Held", tone: "held" }
        : { title: "Funded · awaiting verification", sign: "", status: "Held", tone: "held" };
    case "paid":
      return client
        ? { title: `Paid to ${who.freelancer}`, sign: "-", status: "Completed", tone: "done" }
        : { title: `Received from ${who.client}`, sign: "+", status: "Completed", tone: "done" };
    case "captured":
      return client ? { title: `Paid to ${who.freelancer}`, sign: "-", status: "Completed", tone: "done" } : null;
    case "payout":
      return client ? null : { title: `Received from ${who.client}`, sign: "+", status: "Completed", tone: "done" };
    case "void":
      return client
        ? { title: "Hold released back to you", sign: "+", status: "Released", tone: "returned" }
        : { title: "Client cancelled · hold released", sign: "", status: "Released", tone: "returned" };
    default:
      return null;
  }
}
