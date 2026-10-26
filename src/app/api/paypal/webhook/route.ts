import { verifyWebhookSignature } from "@/lib/paypal";
import { handlePayPalEvent, type PayPalEvent } from "@/lib/webhooks";

// PayPal's webhook: only signature-verified events are stored and applied. A non-2xx answer makes PayPal retry.
export async function POST(req: Request) {
  let event: PayPalEvent;
  try {
    event = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (typeof event?.id !== "string" || typeof event.event_type !== "string") return new Response("Bad request", { status: 400 });
  if (!(await verifyWebhookSignature(req.headers, event).catch(() => false))) return new Response("Invalid signature", { status: 401 });
  await handlePayPalEvent(event);
  return new Response("ok");
}
