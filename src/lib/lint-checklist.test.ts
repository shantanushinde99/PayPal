import { describe, it, expect, vi } from "vitest";
const gen = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/gemini", () => gen);
import { lintChecklist, toLintNotes } from "./lint-checklist";

describe("toLintNotes", () => {
  it("maps vague and unverifiable items to friendly hints, ok to null", () => {
    const notes = toLintNotes(3, [
      { index: 0, verdict: "ok" },
      { index: 1, verdict: "vague", suggestion: "Uses the brand colour #7C4A1E" },
      { index: 2, verdict: "unverifiable" },
      { index: 9, verdict: "vague" },
    ], "website");
    expect(notes[0]).toBeNull();
    expect(notes[1]).toBe('Too vague to check. Try: "Uses the brand colour #7C4A1E"');
    expect(notes[2]).toBe("Can't be verified from the website.");
  });
});

describe("lintChecklist", () => {
  it("returns no notes when the AI fails, so saving still works", async () => {
    gen.generate.mockRejectedValue(new Error("503"));
    expect(await lintChecklist("photo", ["a", "b"])).toEqual([null, null]);
  });
});
