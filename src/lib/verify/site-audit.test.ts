import { describe, it, expect, vi } from "vitest";
import { auditSite } from "./site-audit";

// Minimal fake of a Playwright page/context: each URL maps to a status, final URL and links.
function fakeBrowser(site: Record<string, { status: number; final?: string; links?: string[] }>, clock?: { now: number; step: number }) {
  let current = "";
  const page = {
    on: vi.fn(),
    url: () => current,
    goto: vi.fn(async (url: string) => {
      if (clock) clock.now += clock.step;
      const p = site[url] ?? { status: 404 };
      current = p.final ?? url;
      return { status: () => p.status };
    }),
    waitForTimeout: async () => {},
    evaluate: vi.fn(async (js: string) => js.includes("scrollWidth") ? false : ({
      title: "T", headings: [], text: "", forms: [], brokenImages: 0,
      links: (site[Object.keys(site).find((k) => (site[k].final ?? k) === current) ?? ""]?.links ?? []).map((href) => ({ href, text: href })),
    })),
    screenshot: async () => Buffer.from("x"),
    setViewportSize: async () => {},
    close: async () => {},
  };
  const context = { newPage: async () => page };
  return { page, context };
}

describe("auditSite", () => {
  it("resolves relative links against the page's final URL after a same-site redirect", async () => {
    const { page, context } = fakeBrowser({
      "https://b.test/": { status: 200, links: ["about"] },
      "https://b.test/about": { status: 200, final: "https://b.test/about/", links: ["team.html"] },
      "https://b.test/about/team.html": { status: 200 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await auditSite(context as any, page as any, "https://b.test/", async () => {});
    expect(r.links.filter((l) => !l.ok)).toEqual([]);
    expect(r.pages.map((p) => p.url)).toContain("https://b.test/about/team.html");
  });
  it("stops crawling at the deadline and marks the report truncated", async () => {
    const links = Array.from({ length: 30 }, (_, i) => `/p${i}`);
    const site: Record<string, { status: number; links?: string[] }> = { "https://b.test/": { status: 200, links } };
    for (const l of links) site["https://b.test" + l] = { status: 200 };
    const clock = { now: 0, step: 40_000 };
    const { page, context } = fakeBrowser(site, clock);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await auditSite(context as any, page as any, "https://b.test/", async () => {}, { now: () => clock.now });
    expect(r.truncated).toBe(true);
    expect(r.pages.length).toBeLessThan(6);
  });
});
