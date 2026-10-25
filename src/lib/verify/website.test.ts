import { describe, it, expect, vi, beforeEach } from "vitest";

const page = vi.hoisted(() => ({
  setViewportSize: vi.fn(), goto: vi.fn(), title: vi.fn(async () => "T"), url: vi.fn(() => "https://site.test/"),
  locator: vi.fn(() => ({ innerText: async () => "text" })), evaluate: vi.fn(async () => ""),
  screenshot: vi.fn(async () => Buffer.from("img")),
}));
const gen = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { KERNEL_API_KEY: "k" } }));
vi.mock("@/lib/gemini", () => gen);
vi.mock("@onkernel/sdk", () => ({ default: class { browsers = { create: async () => ({ cdp_ws_url: "ws", session_id: "s" }), deleteByID: async () => {} }; } }));
vi.mock("playwright-core", () => ({ chromium: { connectOverCDP: async () => ({ contexts: () => [{ pages: () => [page] }], close: async () => {} }) } }));
import { checkWebsite } from "./website";

const call = (name: string, args: object) => ({ functionCalls: [{ name, args }], candidates: [{ content: { role: "model", parts: [] } }] });
const allPass = call("submit_verdict", { items: [{ checklistItemId: "c1", status: "pass", reason: "ok" }] });
const opts = { url: "https://site.test/", checklist: [{ id: "c1", requirement: "has a form" }], log: async () => {} };

beforeEach(() => { gen.generate.mockReset(); page.goto.mockReset(); });

describe("checkWebsite", () => {
  it("ignores a pass verdict if the agent never actually opened the site", async () => {
    gen.generate.mockResolvedValueOnce(allPass);
    expect((await checkWebsite(opts))[0].status).toBe("unsure");
  });
  it("refuses to open pages on another site", async () => {
    gen.generate
      .mockResolvedValueOnce(call("open_page", { url: "https://someone-elses-site.test/" }))
      .mockResolvedValueOnce(allPass);
    const v = await checkWebsite(opts);
    expect(page.goto).not.toHaveBeenCalled();
    expect(v[0].status).toBe("unsure");
  });
  it("accepts the verdict after the submitted site was opened", async () => {
    gen.generate.mockResolvedValueOnce(call("open_page", { url: "https://site.test/menu" })).mockResolvedValueOnce(allPass);
    expect((await checkWebsite(opts))[0].status).toBe("pass");
  });
});
