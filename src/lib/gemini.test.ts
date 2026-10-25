import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: { GEMINI_API_KEY: "k", GEMINI_MODEL_PRIMARY: "a", GEMINI_MODEL_FALLBACK: "b" } }));
import { shouldTryOtherModel } from "./gemini";

describe("shouldTryOtherModel", () => {
  it("falls back on quota limits and on overloaded models", () => {
    expect(shouldTryOtherModel(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toBe(true);
    expect(shouldTryOtherModel(new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'))).toBe(true);
  });
  it("does not hide real errors", () => {
    expect(shouldTryOtherModel(new Error('{"error":{"code":400,"status":"INVALID_ARGUMENT"}}'))).toBe(false);
  });
});
