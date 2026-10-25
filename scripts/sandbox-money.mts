// Run: npx tsx --env-file=.env scripts/sandbox-money.mts
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { createOrder, authorizeOrder, captureAuthorization, createPayout } from "@/lib/paypal";

const id = randomUUID();
const { orderId, approveUrl } = await createOrder({
  milestoneId: id, title: "Sandbox test", amountMinor: 100, currency: "USD",
  returnUrl: "https://example.com/ok", cancelUrl: "https://example.com/cancel",
});
console.log(`Approve as the CLIENT sandbox account (mt6505094@gmail.com):\n${approveUrl}`);
await createInterface({ input: process.stdin, output: process.stdout }).question("Press Enter after approving… ");
const authId = await authorizeOrder(orderId, id);
console.log("authorized", authId);
console.log("captured", await captureAuthorization(authId, id));
console.log("payout batch", await createPayout({ milestoneId: id, email: "shantanushinde2433@gmail.com", amountMinor: 95, currency: "USD", note: "Sandbox test" }));
process.exit(0);
