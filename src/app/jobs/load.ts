import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobRole } from "@/lib/job-access";
import { jobs, milestones, checklistItems, submissions, verdictItems, events, users } from "@/db/schema";

export async function loadJobForUser(jobId: string, user: { id: string; email: string }) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) notFound();
  const role = jobRole(job, user);
  if (!role) notFound();

  const ms = await db.select().from(milestones).where(eq(milestones.jobId, jobId)).orderBy(asc(milestones.position));
  const ids = ms.map((m) => m.id);
  const [items, subs, evs] = ids.length
    ? await Promise.all([
        db.select().from(checklistItems).where(inArray(checklistItems.milestoneId, ids)).orderBy(asc(checklistItems.position)),
        // Not the audit report: it carries per-page screenshots and this page polls while checks run.
        db.select({ id: submissions.id, milestoneId: submissions.milestoneId, url: submissions.url, beforePhoto: submissions.beforePhoto, afterPhoto: submissions.afterPhoto, createdAt: submissions.createdAt })
          .from(submissions).where(inArray(submissions.milestoneId, ids)).orderBy(desc(submissions.createdAt)),
        db.select().from(events).where(inArray(events.milestoneId, ids)).orderBy(asc(events.createdAt)),
      ])
    : [[], [], []];
  const latest = ids.map((id) => subs.find((s) => s.milestoneId === id));
  const subIds = latest.flatMap((s) => (s ? [s.id] : []));
  const verdicts = subIds.length ? await db.select().from(verdictItems).where(inArray(verdictItems.submissionId, subIds)) : [];

  const person = (u?: { email: string; displayName: string | null; company: string | null; headline: string | null }) =>
    ({ name: u?.displayName ?? u?.email ?? job.freelancerEmail, email: u?.email ?? job.freelancerEmail, detail: u?.company ?? u?.headline ?? null });
  const cols = { email: users.email, displayName: users.displayName, company: users.company, headline: users.headline };
  const [client] = await db.select(cols).from(users).where(eq(users.id, job.clientId));
  const [free] = job.freelancerId ? await db.select(cols).from(users).where(eq(users.id, job.freelancerId)) : [];

  return {
    job, role, clientEmail: client?.email ?? "", client: person(client), freelancer: person(free),
    milestones: ms.map((m, i) => ({
      ...m,
      checklist: items.filter((c) => c.milestoneId === m.id),
      submission: latest[i],
      verdict: verdicts.filter((v) => v.submissionId === latest[i]?.id),
      events: evs.filter((e) => e.milestoneId === m.id),
    })),
  };
}
