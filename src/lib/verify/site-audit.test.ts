import { describe, it, expect, vi } from "vitest";
import { auditSite } from "./site-audit";

// Minimal fake of a Playwright page/context: each URL maps to a status, final URL and links.
function fakeBrowser(site: Record<string, { status: number; final?: string; links?: string[] }>, clock?: { now: number; step: number }) {
  const tab = () => {
    let current = "";
    return {
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
  };
  const page = tab();
  const context = { newPage: async () => tab() }; // each tab has its own current URL, like a real browser
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

  it("stays inside the folder the site lives in and ignores links on error pages", async () => {
    const { page, context } = fakeBrowser({
      "https://host.test/me/shop/": { status: 200, links: ["about.html", "missing.html", "/", "/other-project/"] },
      "https://host.test/me/shop/about.html": { status: 200 },
      "https://host.test/me/shop/missing.html": { status: 404, links: ["/help"] },
      "https://host.test/": { status: 200 },
      "https://host.test/other-project/": { status: 200 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await auditSite(context as any, page as any, "https://host.test/me/shop/", async () => {});
    expect(r.pages.map((p) => new URL(p.url).pathname)).toEqual(["/me/shop/", "/me/shop/about.html", "/me/shop/missing.html"]);
    expect(r.links.find((l) => l.url.endsWith("/help"))).toBeUndefined();
  });
});

describe("auditSite page budget", () => {
  it("crawls query-string variants and /index.html once, and checklist pages first", async () => {
    const tours = ["/booking/?tour=a", "/booking/?tour=b", "/booking/?tour=c"];
    const filler = Array.from({ length: 8 }, (_, i) => `/blog/post-${i}/`);
    const site: Record<string, { status: number; links?: string[] }> = {
      "https://b.test/": { status: 200, links: ["/index.html", ...filler, "/booking/", ...tours, "/legal/contact-us/"] },
    };
    for (const u of ["/index.html", "/booking/", "/legal/contact-us/", ...tours, ...filler]) site["https://b.test" + u] = { status: 200 };
    const { page, context } = fakeBrowser(site);
    const seen: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await auditSite(context as any, page as any, "https://b.test/", async (m) => { if (m.startsWith("Checked")) seen.push(m); },
      { focus: ["The contact page shows our email"] });
    const paths = r.pages.map((p) => new URL(p.url).pathname + new URL(p.url).search);
    expect(paths.filter((p) => p.startsWith("/booking/"))).toEqual(["/booking/"]);   // one slot for all ?tour= variants
    expect(paths).not.toContain("/index.html");                                       // same page as /
    expect(seen[1]).toContain("/legal/contact-us/");                                   // the checklist page goes first
    expect(r.links.filter((l) => l.url.includes("?tour=")).every((l) => l.ok)).toBe(true); // variants still link-checked
  });
});
