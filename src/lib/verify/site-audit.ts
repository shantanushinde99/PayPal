import type { BrowserContext, Page } from "playwright-core";
import {
  classifyLink, extractContacts, isPageUrl, linkOutcome, normalizeUrl, sameSite,
  type LinkResult, type PageFacts, type SiteReport,
} from "./site-facts";

const MAX_PAGES = 60;
const MAX_DEPTH = 4;
const CRAWL_WORKERS = 3;   // pages are crawled in parallel tabs
const MAX_LINKS = 80;
const LINK_WORKERS = 6;
const CRAWL_MS = 180_000;  // bounded so the whole check fits in one KERNEL session
const LINKS_MS = 60_000;

// One crawl slot per page: ?tour=a and ?tour=b (or / and /index.html) are the same page. Query variants are still
// link-checked, they just don't use up the page budget.
export const pageKey = (u: string) => { const x = new URL(u); return x.origin + x.pathname.replace(/\/index\.html?$/, "/"); };

const STOP = new Set(["page", "pages", "site", "website", "shows", "show", "with", "that", "have", "there", "every", "each", "should",
  "their", "your", "from", "this", "when", "works", "working", "least", "link", "links", "phone", "screen", "fits", "without"]);
// Words from the checklist ("contact", "tours", "pricing"…), so the pages it's about are crawled before the rest.
export const focusWords = (requirements: string[]) =>
  [...new Set(requirements.flatMap((r) => r.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)))];

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
  { now = Date.now, focus = [] }: { now?: () => number; focus?: string[] } = {},
): Promise<SiteReport> {
  const crawlUntil = now() + CRAWL_MS;
  // Only crawl the folder the site lives in: on shared hosts (GitHub Pages, /~user/) the rest is someone else's.
  const scope = new URL(start).pathname.replace(/[^/]*$/, "");
  const inScope = (u: string) => sameSite(u, start) && new URL(u).pathname.startsWith(scope);
  const words = focusWords(focus);
  const score = (url: string, text: string) => { const hay = (decodeURIComponent(new URL(url).pathname) + " " + text).toLowerCase(); return words.filter((w) => hay.includes(w)).length; };

  type Job = { url: string; depth: number; score: number; order: number };
  const crawledPages: (PageFacts & { order: number })[] = [];
  const queue: Job[] = [{ url: start, depth: 0, score: 0, order: 0 }];
  const seen = new Set([pageKey(start)]);
  const linkSource = new Map<string, { foundOn: string; text: string }>();
  let phoneScreenshot: string | undefined, order = 0, active = 0;
  // Checklist-related pages first, then shallow before deep, then in the order they were found.
  const take = () => {
    if (!queue.length) return undefined;
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i], b = queue[best];
      if (a.score > b.score || (a.score === b.score && (a.depth < b.depth || (a.depth === b.depth && a.order < b.order)))) best = i;
    }
    return queue.splice(best, 1)[0];
  };

  async function crawl(tab: Page, { url, depth, order: o }: Job, errors: string[]) {
    errors.length = 0;
    let status = 0;
    try {
      const res = await tab.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      status = res?.status() ?? 0;
      await tab.waitForTimeout(800); // let client-side rendering settle
    } catch (e) {
      crawledPages.push({ ...empty(url, 0, false, `Page failed to load: ${(e as Error).message.split("\n")[0]}`), order: o });
      return;
    }
    if (!sameSite(tab.url(), start)) { crawledPages.push({ ...empty(url, status, true), order: o }); return; }

    const facts = await collect(tab).catch(() => null);
    if (!facts) { crawledPages.push({ ...empty(url, status, false, "Page could not be read"), order: o }); return; }
    const screenshot = await shot(tab).catch(() => undefined);
    await tab.setViewportSize({ width: 390, height: 844 });
    const phoneOverflow = await tab.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1").catch(() => false) as boolean;
    if (o === 0) phoneScreenshot = await shot(tab).catch(() => undefined);
    await tab.setViewportSize({ width: 1280, height: 800 });

    const here = tab.url(); // after same-site redirects (e.g. /about → /about/) relative links resolve from here
    seen.add(pageKey(here));
    crawledPages.push({ url, status, offsite: false, ...facts, consoleErrors: [...errors], phoneOverflow, screenshot, order: o });
    await log(`Checked ${new URL(url).pathname} (HTTP ${status})`, o === 0 ? screenshot : undefined);

    if (status >= 400) return; // an error page's links (e.g. a host's 404 page) aren't the site's links
    for (const l of facts.links) {
      const kind = classifyLink(l.href, here);
      const n = kind === "internal" || kind === "external" ? normalizeUrl(l.href, here) : null;
      if (!n) continue;
      if (!linkSource.has(n)) linkSource.set(n, { foundOn: url, text: l.text });
      if (kind === "internal" && inScope(n) && depth < MAX_DEPTH && isPageUrl(n) && !seen.has(pageKey(n))) {
        seen.add(pageKey(n));
        queue.push({ url: n, depth: depth + 1, score: score(n, l.text), order: ++order });
      }
    }
  }

  await log(`Crawling ${start} (up to ${MAX_PAGES} pages${words.length ? ", checklist pages first" : ""})`);
  const listen = (tab: Page) => { const errors: string[] = []; tab.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); }); return errors; };
  const mainErrors = listen(page);
  await crawl(page, take()!, mainErrors); // the start page first: its links fill the queue
  const extra = await Promise.all(Array.from({ length: CRAWL_WORKERS - 1 }, async () => {
    const tab = await context.newPage().catch(() => null);
    if (tab) await tab.setViewportSize({ width: 1280, height: 800 }).catch(() => {});
    return tab;
  }));
  const tabs = [page, ...extra.filter((t): t is Page => !!t)];
  await Promise.all(tabs.map(async (tab) => {
    const errors = tab === page ? mainErrors : listen(tab);
    while (now() < crawlUntil && crawledPages.length + active < MAX_PAGES) {
      const job = take();
      if (!job) { if (!active) break; await new Promise((r) => setTimeout(r, 50)); continue; } // others may still add links
      active++;
      try { await crawl(tab, job, errors); } finally { active--; }
    }
  }));
  await Promise.all(extra.map((t) => t?.close().catch(() => {})));
  const pages: PageFacts[] = crawledPages.sort((a, b) => a.order - b.order).map((p) => { const { order, ...facts } = p; void order; return facts; });

  // Crawled pages already have a status; check every other link in parallel tabs.
  const crawled = new Map(pages.map((p) => [p.url, p.status]));
  const links: LinkResult[] = [];
  for (const [url, src] of linkSource) {
    if (crawled.has(url)) links.push({ url, ...linkOutcome(crawled.get(url)!), ...src });
  }
  const todo = [...linkSource].filter(([url]) => !crawled.has(url)).slice(0, MAX_LINKS);
  if (todo.length) await log(`Testing ${todo.length} link(s)`);
  const linksUntil = now() + LINKS_MS;
  await Promise.all(Array.from({ length: Math.min(LINK_WORKERS, todo.length) }, async () => {
    const tab = await context.newPage();
    try {
      for (let next = todo.shift(); next && now() < linksUntil; next = todo.shift()) {
        const [url, src] = next;
        let status = 0, error: string | undefined;
        try { status = (await tab.goto(url, { waitUntil: "commit", timeout: 10_000 }))?.status() ?? 0; } catch (e) { error = (e as Error).message; }
        links.push({ url, ...linkOutcome(status, error), ...src });
      }
    } finally {
      await tab.close().catch(() => {});
    }
  }));

  const contacts = extractContacts(pages.filter((p) => !p.offsite));
  const broken = links.filter((l) => !l.ok).length;
  await log(`Audit done: ${pages.length} page(s), ${links.length} link(s), ${broken} broken`);
  return { start, pages, links, contacts, phoneScreenshot, truncated: queue.length > 0 || todo.length > 0 };
}
