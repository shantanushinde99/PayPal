import type { BrowserContext, Page } from "playwright-core";
import {
  classifyLink, extractContacts, isPageUrl, normalizeUrl, sameSite,
  type LinkResult, type PageFacts, type SiteReport,
} from "./site-facts";

const MAX_PAGES = 20;
const MAX_DEPTH = 3;
const MAX_LINKS = 40;
const LINK_WORKERS = 4;
// Bot walls (LinkedIn 999, Instagram 429…) aren't broken links.
const BOT_BLOCKED = new Set([401, 403, 429, 999]);

const shot = async (page: Page) => (await page.screenshot({ type: "jpeg", quality: 50 })).toString("base64");

// Runs inside the page. Kept as a string: bundlers (tsx/esbuild) inject helpers like __name into
// compiled functions, and those don't exist in the browser.
const COLLECT_JS = `(() => {
  const t = (el) => ((el && el.textContent) || "").trim().replace(/\\s+/g, " ").slice(0, 100);
  return {
    title: document.title,
    headings: [...document.querySelectorAll("h1,h2,h3")].slice(0, 30).map((h) => h.tagName.toLowerCase() + ": " + t(h)),
    text: ((document.body && document.body.innerText) || "").slice(0, 4000),
    links: [...document.querySelectorAll("a[href]")].slice(0, 200).map((a) => ({ href: a.getAttribute("href") || "", text: t(a) })),
    forms: [...document.querySelectorAll("form")].map((f) => ({
      fields: [...f.querySelectorAll("input,textarea,select")]
        .filter((x) => !["hidden", "submit", "button"].includes(x.type))
        .map((x) => (x.getAttribute("name") || x.id || "?") + "[" + (x.tagName === "INPUT" ? x.type : x.tagName.toLowerCase()) + "]"),
      submit: t(f.querySelector("button, [type=submit]")),
    })),
    brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
  };
})()`;

type Collected = Pick<PageFacts, "title" | "headings" | "text" | "links" | "forms" | "brokenImages">;
const collect = (page: Page) => page.evaluate(COLLECT_JS) as Promise<Collected>;

const empty = (url: string, status: number, offsite: boolean, error?: string): PageFacts => ({
  url, status, offsite, title: "", headings: [], text: "", links: [], forms: [], brokenImages: 0,
  consoleErrors: error ? [error] : [], phoneOverflow: false,
});

export async function auditSite(
  context: BrowserContext, page: Page, start: string,
  log: (message: string, image?: string) => Promise<void>,
): Promise<SiteReport> {
  const origin = new URL(start).origin;
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });

  const pages: PageFacts[] = [];
  const queue: [string, number][] = [[start, 0]];
  const seen = new Set([start]);
  const linkSource = new Map<string, { foundOn: string; text: string }>();
  let phoneScreenshot: string | undefined;

  await log(`Crawling ${origin} (up to ${MAX_PAGES} pages)`);
  while (queue.length && pages.length < MAX_PAGES) {
    const [url, depth] = queue.shift()!;
    errors.length = 0;
    let status = 0;
    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      status = res?.status() ?? 0;
      await page.waitForTimeout(800); // let client-side rendering settle
    } catch (e) {
      pages.push(empty(url, 0, false, `Page failed to load: ${(e as Error).message.split("\n")[0]}`));
      continue;
    }
    if (!sameSite(page.url(), start)) { pages.push(empty(url, status, true)); continue; }

    const facts = await collect(page).catch(() => null);
    if (!facts) { pages.push(empty(url, status, false, "Page could not be read")); continue; }
    const screenshot = await shot(page).catch(() => undefined);
    await page.setViewportSize({ width: 390, height: 844 });
    const phoneOverflow = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1").catch(() => false) as boolean;
    if (pages.length === 0) phoneScreenshot = await shot(page).catch(() => undefined);
    await page.setViewportSize({ width: 1280, height: 800 });

    pages.push({ url, status, offsite: false, ...facts, consoleErrors: [...errors], phoneOverflow, screenshot });
    await log(`Checked ${new URL(url).pathname} (HTTP ${status})`, pages.length === 1 ? screenshot : undefined);

    for (const l of facts.links) {
      const kind = classifyLink(l.href, url);
      const n = kind === "internal" || kind === "external" ? normalizeUrl(l.href, url) : null;
      if (!n) continue;
      if (!linkSource.has(n)) linkSource.set(n, { foundOn: url, text: l.text });
      if (kind === "internal" && depth < MAX_DEPTH && !seen.has(n) && isPageUrl(n)) { seen.add(n); queue.push([n, depth + 1]); }
    }
  }

  // Crawled pages already have a status; check every other link in parallel tabs.
  const crawled = new Map(pages.map((p) => [p.url, p.status]));
  const links: LinkResult[] = [];
  for (const [url, src] of linkSource) {
    if (crawled.has(url)) { const s = crawled.get(url)!; links.push({ url, status: s, ok: s > 0 && s < 400, ...src }); }
  }
  const todo = [...linkSource].filter(([url]) => !crawled.has(url)).slice(0, MAX_LINKS);
  if (todo.length) await log(`Testing ${todo.length} link(s)`);
  await Promise.all(Array.from({ length: Math.min(LINK_WORKERS, todo.length) }, async () => {
    const tab = await context.newPage();
    try {
      for (let next = todo.shift(); next; next = todo.shift()) {
        const [url, src] = next;
        let status = 0;
        try { status = (await tab.goto(url, { waitUntil: "commit", timeout: 10_000 }))?.status() ?? 0; } catch { /* unreachable */ }
        links.push({ url, status, ok: (status > 0 && status < 400) || BOT_BLOCKED.has(status), ...src });
      }
    } finally {
      await tab.close().catch(() => {});
    }
  }));

  const contacts = extractContacts(pages.filter((p) => !p.offsite));
  const broken = links.filter((l) => !l.ok).length;
  await log(`Audit done: ${pages.length} page(s), ${links.length} link(s), ${broken} broken`);
  return { start, pages, links, contacts, phoneScreenshot, truncated: queue.length > 0 };
}
