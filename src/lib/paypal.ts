import { env } from "@/lib/env";
import { toPayPalValue } from "@/lib/money";

export const requestId = (milestoneId: string, action: string) => `pod-${milestoneId}-${action}`;

let token: { value: string; expiresAt: number } | undefined;

async function accessToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const res = await fetch(`${env.PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return token.value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pp(path: string, body?: unknown, reqId?: string): Promise<any> {
  const res = await fetch(`${env.PAYPAL_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...(reqId && { "PayPal-Request-Id": reqId }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PayPal ${path} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function createOrder(o: {
  milestoneId: string; title: string; amountMinor: number; currency: string; returnUrl: string; cancelUrl: string; payeeEmail?: string;
  sdk?: boolean; // approved in the JS SDK popup (PayPal, Pay Later, Venmo) instead of a redirect
}) {
  const experience = { brand_name: "Verifund", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" };
  const order = await pp("/v2/checkout/orders", {
    intent: "AUTHORIZE",
    purchase_units: [{
      reference_id: o.milestoneId,
      description: o.title.slice(0, 127),
      amount: { currency_code: o.currency, value: toPayPalValue(o.amountMinor, o.currency) },
      ...(o.payeeEmail && { payee: { email_address: o.payeeEmail } }),
    }],
    // The SDK picks the funding source, so it gets a source-neutral context.
    ...(o.sdk
      ? { application_context: experience }
      : { payment_source: { paypal: { experience_context: { ...experience, return_url: o.returnUrl, cancel_url: o.cancelUrl } } } }),
  });
  const approveUrl = order.links.find((l: { rel: string }) => l.rel === "payer-action" || l.rel === "approve")?.href;
  return { orderId: order.id as string, approveUrl: approveUrl as string };
}

export async function authorizeOrder(orderId: string, milestoneId: string): Promise<string> {
  const order = await pp(`/v2/checkout/orders/${orderId}/authorize`, undefined, requestId(milestoneId, `authorize-${orderId}`));
  return order.purchase_units[0].payments.authorizations[0].id;
}

// Full capture, or a partial one: with final_capture the rest of the hold goes back to the buyer.
export async function captureAuthorization(authorizationId: string, milestoneId: string, part?: { amountMinor: number; currency: string }): Promise<string> {
  const body = { final_capture: true, ...(part && { amount: { currency_code: part.currency, value: toPayPalValue(part.amountMinor, part.currency) } }) };
  const cap = await pp(`/v2/payments/authorizations/${authorizationId}/capture`, body, requestId(milestoneId, part ? `capture-${part.amountMinor}` : "capture"));
  return cap.id;
}

export async function voidAuthorization(authorizationId: string) {
  await pp(`/v2/payments/authorizations/${authorizationId}/void`);
}

export async function createPayout(p: { milestoneId: string; email: string; amountMinor: number; currency: string; note: string }) {
  const res = await pp("/v1/payments/payouts", {
    sender_batch_header: { sender_batch_id: requestId(p.milestoneId, "payout"), email_subject: "You've been paid via Verifund" },
    items: [{
      recipient_type: "EMAIL",
      receiver: p.email,
      amount: { value: toPayPalValue(p.amountMinor, p.currency), currency: p.currency },
      note: p.note,
      sender_item_id: p.milestoneId,
    }],
  }, requestId(p.milestoneId, "payout"));
  return res.batch_header.payout_batch_id as string;
}

// Live status straight from PayPal, so the UI can show "Confirmed by PayPal".
// ponytail: in-memory 5-minute cache; the job page polls every 2s while a check runs.
const statusCache = new Map<string, { status: string; at: number }>();
const STATUS_TTL = 5 * 60_000;

export async function captureStatus(captureId: string): Promise<string | null> {
  const hit = statusCache.get(captureId);
  if (hit && Date.now() - hit.at < STATUS_TTL) return hit.status;
  try {
    const res = await fetch(`${env.PAYPAL_API_BASE}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const status = String((await res.json()).status ?? "");
    if (status) statusCache.set(captureId, { status, at: Date.now() });
    return status || null;
  } catch {
    return null; // a confirmation badge is optional; never break the page
  }
}
