import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SiteReport } from "./site-facts";

const page = vi.hoisted(() => ({
  setViewportSize: vi.fn(), goto: vi.fn(), title: vi.fn(async () => "T"), url: vi.fn(() => "https://site.test/"),
  locator: vi.fn(() => ({ innerText: async () => "text" })), evaluate: vi.fn(async () => ""),
  screenshot: vi.fn(async () => Buffer.from("img")),
}));
const gen = vi.hoisted(() => ({ generate: vi.fn() }));
const audit = vi.hoisted(() => ({ auditSite: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { KERNEL_API_KEY: "k" } }));
vi.mock("@/lib/gemini", () => gen);
vi.mock("./site-audit", () => audit);
vi.mock("@onkernel/sdk", () => ({ default: class { browsers = { create: async () => ({ cdp_ws_url: "ws", session_id: "s" }), deleteByID: async () => {} }; } }));
vi.mock("playwright-core", () => ({ chromium: { connectOverCDP: async () => ({ contexts: () => [{ pages: () => [page] }], close: async () => {} }) } }));
import { checkWebsite } from "./website";

const report = (status: number, offsite = false): SiteReport => ({
  start: "https://site.test/", truncated: false, links: [],
  contacts: { emails: [], phones: [], whatsapp: [], social: [] },
  pages: [{ url: "https://site.test/", status, offsite, title: "Home", headings: [], text: "", links: [], forms: [], brokenImages: 0, consoleErrors: [], phoneOverflow: false, screenshot: "SHOT" }],
});
const call = (name: string, args: object) => ({ functionCalls: [{ name, args }], candidates: [{ content: { role: "model", parts: [] } }] });
const allPass = call("submit_verdict", { items: [{ checklistItemId: "c1", status: "pass", reason: "ok", evidence: "form #0", pageUrl: "https://site.test/" }] });
const opts = { url: "https://site.test/", checklist: [{ id: "c1", requirement: "has a form" }], log: async () => {} };

beforeEach(() => { gen.generate.mockReset(); page.goto.mockReset(); audit.auditSite.mockReset(); });

describe("checkWebsite", () => {
  it("fails every item without asking the AI when the site is unreachable", async () => {
    audit.auditSite.mockResolvedValue(report(0));
    const { verdict } = await checkWebsite(opts);
    expect(verdict[0].status).toBe("fail");
    expect(gen.generate).not.toHaveBeenCalled();
  });
  it("fails when the homepage redirects to another website", async () => {
    audit.auditSite.mockResolvedValue(report(200, true));
    expect((await checkWebsite(opts)).verdict[0].status).toBe("fail");
    expect(gen.generate).not.toHaveBeenCalled();
  });
  it("returns the AI verdict with evidence and the audit report", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    gen.generate.mockResolvedValueOnce(allPass);
    const { verdict, report: r } = await checkWebsite(opts);
    expect(verdict[0]).toMatchObject({ status: "pass", evidence: "form #0" });
    expect(r.pages).toHaveLength(1);
  });
  it("refuses to open pages on another site", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    gen.generate.mockResolvedValueOnce(call("open_page", { url: "https://evil.test/" })).mockResolvedValueOnce(allPass);
    await checkWebsite(opts);
    expect(page.goto).not.toHaveBeenCalled();
  });
  it("shows the AI the client's reference design", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    gen.generate.mockResolvedValueOnce(allPass);
    await checkWebsite({ ...opts, reference: { mimeType: "image/png", data: "REF" } });
    const parts = gen.generate.mock.calls[0][0].contents[0].parts;
    expect(parts.some((p: { inlineData?: { data: string } }) => p.inlineData?.data === "REF")).toBe(true);
  });
});
