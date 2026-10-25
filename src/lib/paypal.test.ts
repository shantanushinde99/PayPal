import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: {} }));
import { requestId } from "./paypal";

describe("requestId", () => {
  it("is the same for the same milestone + action, so retries are idempotent", () => {
    expect(requestId("m1", "capture")).toBe(requestId("m1", "capture"));
    expect(requestId("m1", "capture")).not.toBe(requestId("m1", "payout"));
  });
});
