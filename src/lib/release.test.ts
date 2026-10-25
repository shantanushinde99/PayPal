import { describe, it, expect } from "vitest";
import { normalizeVerdict, shouldRelease } from "./release";

describe("normalizeVerdict", () => {
  it("keeps valid items in checklist order", () => {
    const v = normalizeVerdict(["a", "b"], [
      { checklistItemId: "b", status: "fail", reason: "no form" },
      { checklistItemId: "a", status: "pass", reason: "ok" },
    ]);
    expect(v.map((i) => [i.checklistItemId, i.status])).toEqual([["a", "pass"], ["b", "fail"]]);
  });
  it("marks missing items unsure and drops unknown ids", () => {
    const v = normalizeVerdict(["a", "b"], [
      { checklistItemId: "a", status: "pass", reason: "ok" },
      { checklistItemId: "zzz", status: "pass", reason: "?" },
    ]);
    expect(v).toHaveLength(2);
    expect(v[1]).toMatchObject({ checklistItemId: "b", status: "unsure" });
  });
  it("treats an invalid status or junk as unsure", () => {
    const v = normalizeVerdict(["a", "b"], [{ checklistItemId: "a", status: "PASSED", reason: "x" }, null]);
    expect(v[0].status).toBe("unsure");
  });
});

describe("shouldRelease", () => {
  const item = (status: "pass" | "fail" | "unsure") => ({ checklistItemId: "x", status, reason: "" });
  it("releases only when every item passes", () => {
    expect(shouldRelease([item("pass"), item("pass")])).toBe(true);
    expect(shouldRelease([item("pass"), item("fail")])).toBe(false);
    expect(shouldRelease([item("pass"), item("unsure")])).toBe(false);
  });
  it("never releases on an empty verdict", () => {
    expect(shouldRelease([])).toBe(false);
  });
});

describe("normalizeVerdict duplicates", () => {
  it("keeps the worst status when the AI repeats an item", () => {
    const v = normalizeVerdict(["a"], [
      { checklistItemId: "a", status: "fail", reason: "missing" },
      { checklistItemId: "a", status: "pass", reason: "ok" },
    ]);
    expect(v[0].status).toBe("fail");
  });
});
