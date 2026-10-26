import { describe, it, expect } from "vitest";
import { isSampleSite, ownershipCode, OWNERSHIP_JS } from "./ownership";

describe("ownership", () => {
  it("gives each freelancer a stable, distinct code", () => {
    expect(ownershipCode("a")).toBe(ownershipCode("a"));
    expect(ownershipCode("a")).not.toBe(ownershipCode("b"));
    expect(ownershipCode("a")).toMatch(/^vf-[0-9a-f]{20}$/);
  });

  it("exempts only Verifund's own sample sites", () => {
    expect(isSampleSite("https://shantanushinde99.github.io/PayPal/demo-sites/bakery-v2/")).toBe(true);
    expect(isSampleSite("https://shantanushinde99.github.io/PayPal/other/")).toBe(false);
    expect(isSampleSite("https://evil.example/?https://shantanushinde99.github.io/PayPal/demo-sites/")).toBe(false);
  });

  it("builds a browser script that parses", () => {
    expect(() => new Function(`return ${OWNERSHIP_JS("vf-123")}`)).not.toThrow();
  });
});
