import { describe, it, expect } from "vitest";
import { verifiedEmail } from "./paypal-identity";

describe("verifiedEmail", () => {
  it("returns the primary confirmed email", () => {
    expect(verifiedEmail({ verified_account: "true", emails: [{ value: "A@x.com", primary: true, confirmed: true }] })).toBe("a@x.com");
  });
  it("accepts a confirmed email when PayPal omits verified_account (default scopes)", () => {
    expect(verifiedEmail({ emails: [{ value: "a@x.com", primary: true, confirmed: true }] })).toBe("a@x.com");
  });
  it("rejects unconfirmed emails and explicitly unverified accounts", () => {
    expect(verifiedEmail({ verified_account: "true", emails: [{ value: "a@x.com", primary: true, confirmed: false }] })).toBeNull();
    expect(verifiedEmail({ verified_account: "false", emails: [{ value: "a@x.com", primary: true, confirmed: true }] })).toBeNull();
    expect(verifiedEmail({})).toBeNull();
  });
});
