import { describe, it, expect } from "vitest";
import { canTransition } from "./milestone-state";

describe("canTransition", () => {
  it("allows the happy path", () => {
    expect(canTransition("draft", "funding")).toBe(true);
    expect(canTransition("funding", "funded")).toBe(true);
    expect(canTransition("funded", "verifying")).toBe(true);
    expect(canTransition("verifying", "passed")).toBe(true);
    expect(canTransition("passed", "paid_out")).toBe(true);
  });
  it("allows resubmission after failure", () => {
    expect(canTransition("verifying", "failed")).toBe(true);
    expect(canTransition("failed", "verifying")).toBe(true);
  });
  it("blocks paying twice or skipping verification", () => {
    expect(canTransition("paid_out", "paid_out")).toBe(false);
    expect(canTransition("funded", "passed")).toBe(false);
    expect(canTransition("verifying", "verifying")).toBe(false);
    expect(canTransition("passed", "cancelled")).toBe(false);
  });
});
