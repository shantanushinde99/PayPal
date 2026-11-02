import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, events, jobs, milestones } from "@/db/schema";
import { transition } from "@/db/transition";
import type { VerdictItem } from "@/lib/release";

// "Done" also means the client owns what they paid for. Code checks the site runs on the client's own domain;
// things only the client can see (admin logins, the domain account, a transferred repo) they confirm themselves.

export const DOMAIN_PREFIX = "Live on the client's own domain: ";
export const domainItem = (domain: string) => `${DOMAIN_PREFIX}${domain}`;

// "https://www.SunriseBakery.com/x" → "sunrisebakery.com"; null if it isn't a plausible domain.
export function cleanDomain(raw: string): string | null {
  const host = raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "");
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) ? host : null;
}

// Measured by code, never the AI: the submitted link must be served from the agreed domain (or a subdomain of it).
export function domainVerdict(item: { id: string; requirement: string }, submittedUrl: string): VerdictItem {
  const domain = item.requirement.slice(DOMAIN_PREFIX.length);
  let host = "";
  try { host = new URL(submittedUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch { /* not a URL */ }
  const ok = host === domain || host.endsWith(`.${domain}`);
  return {
    checklistItemId: item.id, status: ok ? "pass" : "fail", pageUrl: submittedUrl,
    reason: ok ? `The site is served from ${domain}.` : `The site is on ${host || "an unknown address"}, not the client's domain ${domain}. Connect the domain, then submit that link.`,
    evidence: `Submitted address: ${host || submittedUrl}`,
  };
}

export async function confirmHandover(itemId: string, user: { id: string }, received: boolean) {
  const [row] = await db.select({ c: checklistItems, m: milestones, j: jobs }).from(checklistItems)
    .innerJoin(milestones, eq(milestones.id, checklistItems.milestoneId)).innerJoin(jobs, eq(jobs.id, milestones.jobId))
    .where(eq(checklistItems.id, itemId));
  if (!row || row.j.clientId !== user.id || row.c.kind !== "handover") throw new Error("Not allowed");
  if (row.m.state !== "passed") throw new Error("This can only be answered while the work is waiting for your approval.");
  if (row.c.confirmed !== null) throw new Error("You already answered this.");
  await db.update(checklistItems).set({ confirmed: received }).where(and(eq(checklistItems.id, itemId)));
  if (received) {
    await db.insert(events).values({ milestoneId: row.m.id, kind: "state", message: `The client confirmed the handover: ${row.c.requirement}.` });
    return;
  }
  await transition(row.m.id, "passed", "failed", { releaseAt: null, failReason: `Handover missing: the client hasn't received "${row.c.requirement}". Hand it over, then resubmit.` });
  await db.insert(events).values({ milestoneId: row.m.id, kind: "state", message: `The client says they haven't received: ${row.c.requirement}.` });
}
