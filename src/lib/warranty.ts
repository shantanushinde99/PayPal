import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { events, jobs, milestones, submissions, users } from "@/db/schema";
import { jobRole } from "@/lib/job-access";
import { settleWarranty } from "@/lib/payments";
import type { SiteReport } from "@/lib/verify/site-facts";

// After release, part of the money stays held while the site is checked every day. Only this monitor can keep it
// back (not the client): if a page that worked at delivery stops loading and isn't fixed by the end, it returns
// to the client; otherwise it's paid automatically.

const CHECK_EVERY = 24 * 3600_000;
const DEMO_CHECK_EVERY = 60_000;
const MAX_PAGES = 20;

// Every page that loaded when the work was verified must still load. Plain requests: cheap enough to run daily.
export async function checkPages(urls: string[], fetcher: typeof fetch = fetch): Promise<string | null> {
  const broken: string[] = [];
  for (const url of urls.slice(0, MAX_PAGES)) {
    const status = await fetcher(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Verifund warranty monitor" } })
      .then((r) => r.status).catch(() => 0);
    if (status < 200 || status >= 400) broken.push(`${new URL(url).pathname} ${status ? `returns ${status}` : "doesn't respond"}`);
  }
  return broken.length ? broken.slice(0, 3).join(", ") + (broken.length > 3 ? ` (+${broken.length - 3} more)` : "") : null;
}

async function pagesOf(milestoneId: string) {
  const [sub] = await db.select({ url: submissions.url, report: submissions.report }).from(submissions)
    .where(and(eq(submissions.milestoneId, milestoneId), eq(submissions.preview, false))).orderBy(desc(submissions.createdAt)).limit(1);
  const report = sub?.report as SiteReport | null;
  const pages = report?.pages?.filter((p) => !p.offsite && p.status >= 200 && p.status < 400).map((p) => p.url) ?? [];
  return pages.length ? pages : sub?.url ? [sub.url] : [];
}

export async function monitorOne(milestoneId: string, fetcher: typeof fetch = fetch) {
  const [m] = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
  if (!m || m.warrantyStatus !== "holding") return;
  const issue = await checkPages(await pagesOf(milestoneId), fetcher);
  await db.update(milestones).set({ warrantyIssue: issue, warrantyCheckedAt: new Date() }).where(and(eq(milestones.id, milestoneId), eq(milestones.warrantyStatus, "holding")));
  if (issue && !m.warrantyIssue) await db.insert(events).values({ milestoneId, kind: "error", message: `Warranty check: ${issue}. Fix it before the warranty ends, or the held amount goes back to the client.` });
  if (!issue && m.warrantyIssue) await db.insert(events).values({ milestoneId, kind: "state", message: "Warranty check: the site works again." });
}

// Runs with the release sweeper: daily checks (every minute in demo workspaces), then settles warranties that ended.
// The last check always happens right before settling, so a fix made on the final day counts.
export async function sweepWarranties(fetcher: typeof fetch = fetch) {
  const now = Date.now();
  const holding = await db.select({ id: milestones.id, checked: milestones.warrantyCheckedAt, until: milestones.warrantyUntil, demo: users.isDemo })
    .from(milestones).innerJoin(jobs, eq(jobs.id, milestones.jobId)).innerJoin(users, eq(users.id, jobs.clientId))
    .where(and(eq(milestones.warrantyStatus, "holding"), or(isNull(milestones.warrantyCheckedAt), lte(milestones.warrantyCheckedAt, new Date(now - DEMO_CHECK_EVERY)))));
  for (const h of holding) {
    const ended = !!h.until && h.until.getTime() <= now;
    const due = ended || !h.checked || now - h.checked.getTime() >= (h.demo ? DEMO_CHECK_EVERY : CHECK_EVERY);
    if (!due) continue;
    await monitorOne(h.id, fetcher).catch((e) => console.error("warranty check failed", h.id, e));
    if (ended) await settleWarranty(h.id).catch((e) => console.error("warranty settle failed", h.id, e));
  }
}

// The freelancer fixed something: check again now instead of waiting a day.
export async function recheckWarranty(milestoneId: string, user: { id: string; email: string }) {
  const [row] = await db.select({ m: milestones, j: jobs }).from(milestones).innerJoin(jobs, eq(jobs.id, milestones.jobId)).where(eq(milestones.id, milestoneId));
  if (!row || !jobRole(row.j, user)) throw new Error("Not allowed");
  if (row.m.warrantyStatus !== "holding") throw new Error("This warranty has ended.");
  if (row.m.warrantyCheckedAt && Date.now() - row.m.warrantyCheckedAt.getTime() < 30_000) return; // just checked
  await monitorOne(milestoneId);
}
