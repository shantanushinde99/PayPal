import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { PAYPAL_API_BASE: "https://pp.test", PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: "s" } }));
import { requestId, createPayout, captureStatus } from "./paypal";

describe("requestId", () => {
  it("is the same for the same milestone + action, so retries are idempotent", () => {
    expect(requestId("m1", "capture")).toBe(requestId("m1", "capture"));
    expect(requestId("m1", "capture")).not.toBe(requestId("m1", "payout"));
  });
});

describe("createPayout", () => {
  it("sends an idempotency key so a retried payout returns the original batch", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "t", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ batch_header: { payout_batch_id: "B1" } })));
    vi.stubGlobal("fetch", fetch);
    await createPayout({ milestoneId: "m1", email: "a@x.com", amountMinor: 100, currency: "USD", note: "n" });
    expect(fetch.mock.calls[1][1].headers["PayPal-Request-Id"]).toBe(requestId("m1", "payout"));
  });
});

describe("captureStatus", () => {
  it("asks PayPal for a capture's live status once, then serves it from cache", async () => {
    const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.includes("oauth2") ? { access_token: "t", expires_in: 3600 } : { id: "CAP9", status: "COMPLETED" })));
    vi.stubGlobal("fetch", fetch);
    expect(await captureStatus("CAP9")).toBe("COMPLETED");
    expect(await captureStatus("CAP9")).toBe("COMPLETED");
    expect(fetch.mock.calls.filter((c) => String(c[0]).includes("/v2/payments/captures/CAP9"))).toHaveLength(1);
  });
  it("returns null instead of throwing when PayPal can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await captureStatus("CAP-X")).toBeNull();
  });
});
