import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

// Verifund's own sample sites (the public verifund-demo-sites repo on GitHub Pages): they skip the check.
// ponytail: sandbox-only exemption; drop it (or tie it to demo workspaces) before real money.
export const SAMPLE_SITES = "https://shantanushinde99.github.io/verifund-demo-sites/";
export const isSampleSite = (url: string) => URL.canParse(url) && new URL(url).href.startsWith(SAMPLE_SITES);

// Stable per freelancer, unguessable without the server secret.
export const ownershipCode = (userId: string) =>
  "vf-" + createHmac("sha256", env.AUTH_SECRET).update(`ownership:${userId}`).digest("hex").slice(0, 20);

export const ownershipMeta = (code: string) => `<meta name="verifund-verification" content="${code}">`;

// Runs in the checker's browser on the start page (string: see site-audit.ts). Returns where the code
// was found, or "". The .well-known file may sit next to the site (shared hosts) or at the domain root.
export const OWNERSHIP_JS = (code: string) => `(async () => {
  const code = ${JSON.stringify(code)};
  const metas = [...document.querySelectorAll('meta[name="verifund-verification"]')];
  if (metas.some((m) => (m.getAttribute("content") || "").trim() === code)) return "meta tag";
  for (const u of [new URL(".well-known/verifund.txt", location.href).href, location.origin + "/.well-known/verifund.txt"]) {
    try {
      const r = await fetch(u, { redirect: "error", cache: "no-store" });
      if (r.ok && (await r.text()).trim().split(/\\s+/).includes(code)) return u;
    } catch {}
  }
  return "";
})()`;
