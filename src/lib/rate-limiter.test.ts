import { describe, it, expect } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  it("allows up to the per-minute cap, then reports the wait", () => {
    const l = new RateLimiter(2, 100);
    l.record("m", 0);
    l.record("m", 1000);
    expect(l.waitMs("m", 2000)).toBe(58_000);
    expect(l.waitMs("m", 60_001)).toBe(0);
  });
  it("tracks keys separately", () => {
    const l = new RateLimiter(1, 100);
    l.record("a", 0);
    expect(l.waitMs("b", 0)).toBe(0);
  });
  it("returns Infinity once the daily cap is hit", () => {
    const l = new RateLimiter(100, 2);
    l.record("m", 0);
    l.record("m", 1);
    expect(l.waitMs("m", 120_000)).toBe(Infinity);
    expect(l.waitMs("m", 24 * 3600_000 + 2)).toBe(0);
  });
});
