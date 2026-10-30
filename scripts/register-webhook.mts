// Registers the deployed app's PayPal webhook (once per PayPal app) and prints PAYPAL_WEBHOOK_ID.
//   npx tsx --env-file=.env scripts/register-webhook.mts https://verifund-ckg3gxbeg0a7bzbp.indiasouthcentral-01.azurewebsites.net
// Then set PAYPAL_WEBHOOK_ID in .env and in the Azure app settings. Idempotent: reuses an existing webhook for the same URL.
const base = process.argv[2]?.replace(/\/$/, "");
if (!base?.startsWith("https://")) { console.error("Pass the public https URL of the app."); process.exit(1); }
const url = `${base}/api/paypal/webhook`;
const api = process.env.PAYPAL_API_BASE!;

const auth = await fetch(`${api}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
}).then((r) => r.json());
const headers = { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };

const { webhooks = [] } = await fetch(`${api}/v1/notifications/webhooks`, { headers }).then((r) => r.json());
const existing = webhooks.find((w: { url: string }) => w.url === url);
if (existing) {
  console.log(`Already registered.\nPAYPAL_WEBHOOK_ID=${existing.id}`);
  process.exit(0);
}

const types = [
  "CHECKOUT.ORDER.APPROVED", "PAYMENT.AUTHORIZATION.VOIDED", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED", "CUSTOMER.DISPUTE.CREATED", "CUSTOMER.DISPUTE.UPDATED", "CUSTOMER.DISPUTE.RESOLVED",
];
const res = await fetch(`${api}/v1/notifications/webhooks`, { method: "POST", headers, body: JSON.stringify({ url, event_types: types.map((name) => ({ name })) }) });
const body = await res.json();
if (!res.ok) { console.error("PayPal refused:", JSON.stringify(body)); process.exit(1); }
console.log(`Registered ${url}\nPAYPAL_WEBHOOK_ID=${body.id}`);
