import { describe, it, expect } from "vitest";
import { friendlyError } from "./friendly-error";

describe("friendlyError", () => {
  it("turns AI overload/quota errors into a calm 'busy' message", () => {
    for (const raw of ['{"error":{"code":503,"status":"UNAVAILABLE"}}', '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}', "The AI is busy right now (limit reached or overloaded)."]) {
      const m = friendlyError(new Error(raw));
      expect(m).toMatch(/AI reviewer is busy/);
      expect(m).toMatch(/money is safe/);
      expect(m).not.toMatch(/503|429|error|UNAVAILABLE/);
    }
  });
  it("explains browser/network problems and PayPal problems without internals", () => {
    expect(friendlyError(new Error("browserType.connectOverCDP: WebSocket error"))).toMatch(/couldn't open the website checker/);
    expect(friendlyError(new Error('PayPal /v2/payments/authorizations/X/capture failed: 422 {"name":"UNPROCESSABLE_ENTITY"}'))).toMatch(/PayPal didn't confirm/);
  });
  it("never leaks raw text for unknown errors", () => {
    const m = friendlyError(new Error("TypeError: Cannot read properties of undefined (reading 'x')"));
    expect(m).not.toMatch(/TypeError|undefined/);
    expect(m).toMatch(/money is safe/);
  });
});
