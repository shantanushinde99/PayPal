import { describe, it, expect, vi, beforeEach } from "vitest";
const gen = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/gemini", () => gen);
import { checkPhotos } from "./photo";

const photo = { mimeType: "image/jpeg", data: "AAAA" };
const opts = { before: photo, after: photo, checklist: [{ id: "c1", requirement: "Wall fully painted" }], log: async () => {} };
const reply = (o: object) => ({ text: JSON.stringify(o) });

beforeEach(() => gen.generate.mockReset());

describe("checkPhotos", () => {
  it("sends both photos to the model and maps the verdict", async () => {
    gen.generate.mockResolvedValue(reply({ samePlace: true, looksGenuine: true, items: [{ checklistItemId: "c1", status: "pass", reason: "painted" }] }));
    expect((await checkPhotos(opts))[0].status).toBe("pass");
    const parts = gen.generate.mock.calls[0][0].contents[0].parts;
    expect(parts.filter((p: { inlineData?: unknown }) => p.inlineData)).toHaveLength(2);
  });
  it("holds the money when the photos are not of the same place", async () => {
    gen.generate.mockResolvedValue(reply({ samePlace: false, looksGenuine: true, flagReason: "different rooms", items: [{ checklistItemId: "c1", status: "pass", reason: "?" }] }));
    const v = await checkPhotos(opts);
    expect(v[0].status).toBe("unsure");
    expect(v[0].reason).toMatch(/different rooms/);
  });
  it("holds the money when a photo looks like a stock image", async () => {
    gen.generate.mockResolvedValue(reply({ samePlace: true, looksGenuine: false, flagReason: "stock photo", items: [{ checklistItemId: "c1", status: "pass", reason: "?" }] }));
    expect((await checkPhotos(opts))[0].status).toBe("unsure");
  });
});
