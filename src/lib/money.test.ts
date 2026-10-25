import { describe, it, expect } from "vitest";
import { toMinor, toPayPalValue, payoutMinor, formatMoney } from "./money";

describe("money", () => {
  it("converts major to minor units", () => {
    expect(toMinor(12.34, "USD")).toBe(1234);
    expect(toMinor(500, "JPY")).toBe(500);
  });
  it("formats PayPal value strings", () => {
    expect(toPayPalValue(1234, "USD")).toBe("12.34");
    expect(toPayPalValue(5, "EUR")).toBe("0.05");
    expect(toPayPalValue(500, "JPY")).toBe("500");
  });
  it("deducts a 5% platform fee from payouts", () => {
    expect(payoutMinor(10000)).toBe(9500);
    expect(payoutMinor(333)).toBe(316); // fee 16.65 -> 17
  });
  it("formats for display", () => {
    expect(formatMoney(1234, "USD")).toBe("$12.34");
  });
});
