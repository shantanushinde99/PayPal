import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SiteReport } from "./site-facts";

const page = vi.hoisted(() => ({
  setViewportSize: vi.fn(), goto: vi.fn(), title: vi.fn(async () => "T"), url: vi.fn(() => "https://site.test/"),
  locator: vi.fn(() => ({ innerText: async () => "text" })), evaluate: vi.fn(async () => ""),
  screenshot: vi.fn(async () => Buffer.from("img")),
  getByText: vi.fn(() => ({ first: () => ({ click: vi.fn() }) })), waitForLoadState: vi.fn(),
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

beforeEach(() => {
  gen.generate.mockReset(); page.goto.mockReset(); page.goto.mockResolvedValue(null); audit.auditSite.mockReset(); page.locator.mockClear();
  page.url.mockReset(); page.url.mockReturnValue("https://site.test/");
});

const unsure = call("submit_verdict", { items: [{ checklistItemId: "c1", status: "unsure", reason: "can't tell", evidence: "-" }] });

describe("checkWebsite", () => {
  it("sends an 'unsure' verdict back once so the AI checks with its tools", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    gen.generate.mockResolvedValueOnce(unsure).mockResolvedValueOnce(allPass);
    const { verdict } = await checkWebsite(opts);
    expect(gen.generate).toHaveBeenCalledTimes(2);
    const retry = JSON.stringify(gen.generate.mock.calls[1][0].contents.filter((c: { role: string }) => c.role === "user").at(-1));
    expect(retry).toContain("c1");
    expect(retry).toContain("test_form");
    expect(verdict[0].status).toBe("pass");
  });
  it("tests forms in code when the checklist is about a form, and gives the AI the result", async () => {
    const r = report(200); r.pages[0].forms = [{ fields: ["email[email]"], submit: "Send" }];
    audit.auditSite.mockResolvedValue(r);
    gen.generate.mockResolvedValueOnce(allPass);
    await checkWebsite(opts); // requirement: "has a form"
    const prompt = JSON.stringify(gen.generate.mock.calls[0][0].contents[0]);
    expect(prompt).toContain("FORM TESTS (performed by code");
    expect(prompt).toContain("form #0");
  });
  it("doesn't touch forms when no checklist item is about one", async () => {
    const r = report(200); r.pages[0].forms = [{ fields: ["q[text]"], submit: "Search" }];
    audit.auditSite.mockResolvedValue(r);
    gen.generate.mockResolvedValueOnce(allPass);
    await checkWebsite({ ...opts, checklist: [{ id: "c1", requirement: "Menu page lists prices" }] });
    expect(JSON.stringify(gen.generate.mock.calls[0][0].contents[0])).not.toContain("FORM TESTS");
  });
  it("sends a 'fail' given without looking at anything back once", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    const fail = call("submit_verdict", { items: [{ checklistItemId: "c1", status: "fail", reason: "no", evidence: "-" }] });
    gen.generate.mockResolvedValueOnce(fail).mockResolvedValueOnce(fail);
    const { verdict } = await checkWebsite(opts);
    expect(gen.generate).toHaveBeenCalledTimes(2);
    expect(verdict[0].status).toBe("fail"); // a second, considered fail stands
  });
  it("accepts a second 'unsure' instead of looping", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    gen.generate.mockResolvedValueOnce(unsure).mockResolvedValueOnce(unsure);
    const { verdict } = await checkWebsite(opts);
    expect(gen.generate).toHaveBeenCalledTimes(2);
    expect(verdict[0].status).toBe("unsure");
  });
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

  it("refuses an on-site page that redirects to another website, and goes back", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    page.goto.mockImplementation(async (u: string) => { page.url.mockReturnValue(u.includes("/go") ? "https://elsewhere.test/" : u); });
    gen.generate.mockResolvedValueOnce(call("open_page", { url: "https://site.test/go" })).mockResolvedValueOnce(allPass);
    await checkWebsite(opts);
    const reply = gen.generate.mock.calls[1][0].contents.at(-2).parts[0].functionResponse.response.result; // -1 is the model turn appended afterwards
    expect(reply).toMatch(/left the site/i);
    expect(page.goto).toHaveBeenLastCalledWith("https://site.test/", expect.anything());
  });
  it("never fills a form after being redirected off-site", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    page.goto.mockImplementation(async (u: string) => { page.url.mockReturnValue(u.includes("/go") ? "https://elsewhere.test/contact" : u); });
    gen.generate.mockResolvedValueOnce(call("test_form", { pageUrl: "https://site.test/go" })).mockResolvedValueOnce(allPass);
    await checkWebsite(opts);
    expect(page.locator).not.toHaveBeenCalledWith("form");
  });
  it("refuses a click that leads to another website", async () => {
    audit.auditSite.mockResolvedValue(report(200));
    page.getByText.mockImplementation(() => ({ first: () => ({ click: vi.fn(async () => page.url.mockReturnValue("https://elsewhere.test/")) }) }));
    gen.generate.mockResolvedValueOnce(call("click", { text: "Partner" })).mockResolvedValueOnce(allPass);
    await checkWebsite(opts);
    const reply = gen.generate.mock.calls[1][0].contents.at(-2).parts[0].functionResponse.response.result; // -1 is the model turn appended afterwards
    expect(reply).toMatch(/left the site/i);
  });
});
