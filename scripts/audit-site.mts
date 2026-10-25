// Run: npx tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-site.mts https://quotes.toscrape.com/
import Kernel from "@onkernel/sdk";
import { chromium } from "playwright-core";
import { auditSite } from "@/lib/verify/site-audit";
import { summarizeReport } from "@/lib/verify/site-facts";

const url = process.argv[2] ?? "https://quotes.toscrape.com/";
const kernel = new Kernel();
const kb = await kernel.browsers.create({ stealth: true, timeout_seconds: 300 });
const browser = await chromium.connectOverCDP(kb.cdp_ws_url);
try {
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 800 });
  const r = await auditSite(context, page, url, async (m) => console.log("•", m));
  console.log(summarizeReport(r).slice(0, 3000));
} finally {
  await browser.close().catch(() => {});
  await kernel.browsers.deleteByID(kb.session_id).catch(() => {});
}
process.exit(0);
