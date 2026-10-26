import { describe, it, expect } from "vitest";
import { toMinor, toPayPalValue, payoutMinor, formatMoney, shareMinor } from "./money";

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

describe("shareMinor", () => {
  it("turns a 0-100 share into minor units, rounding to the nearest unit", () => {
    expect(shareMinor(1000, 60)).toBe(600);
    expect(shareMinor(333, 50)).toBe(167);
    expect(shareMinor(500, 33)).toBe(165);
    expect(shareMinor(1000, 0)).toBe(0);
    expect(shareMinor(1000, 100)).toBe(1000);
  });
  it("refuses anything that isn't a whole number from 0 to 100", () => {
    for (const bad of [-5, 150, 50.5, NaN]) expect(() => shareMinor(1000, bad)).toThrow();
  });
});
