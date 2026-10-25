// What users see when something fails. Raw details go to the server log, never the UI.
const SAFE = "Your money is safe on hold.";

export function friendlyError(e: unknown): string {
  const raw = String(e instanceof Error ? e.message : e);
  if (/429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|quota|AI is busy|high demand/i.test(raw)) {
    return `Our AI reviewer is busy right now. ${SAFE} Please resubmit in a minute.`;
  }
  if (/PayPal/i.test(raw)) {
    return "PayPal didn't confirm the payment step. Nothing was paid twice. The client can retry the payment from this page.";
  }
  if (/CDP|WebSocket|browser|kernel|ECONN|ETIMEDOUT|socket hang up|fetch failed/i.test(raw)) {
    return `We couldn't open the website checker right now. ${SAFE} Please resubmit in a minute.`;
  }
  return `Something went wrong while checking the work. ${SAFE} Please resubmit, and contact support if it keeps happening.`;
}
