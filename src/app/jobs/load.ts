import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, checklistItems, submissions, verdictItems, events } from "@/db/schema";

export async function loadJobForUser(jobId: string, user: { id: string; email: string }) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) notFound();
  const role = job.clientId === user.id ? "client" : job.freelancerEmail === user.email ? "freelancer" : null;
  if (!role) notFound();

  const ms = await db.select().from(milestones).where(eq(milestones.jobId, jobId)).orderBy(asc(milestones.position));
  const ids = ms.map((m) => m.id);
  const [items, subs, evs] = ids.length
    ? await Promise.all([
        db.select().from(checklistItems).where(inArray(checklistItems.milestoneId, ids)).orderBy(asc(checklistItems.position)),
        db.select().from(submissions).where(inArray(submissions.milestoneId, ids)).orderBy(desc(submissions.createdAt)),
        db.select().from(events).where(inArray(events.milestoneId, ids)).orderBy(asc(events.createdAt)),
      ])
    : [[], [], []];
  const latest = ids.map((id) => subs.find((s) => s.milestoneId === id));
  const subIds = latest.flatMap((s) => (s ? [s.id] : []));
  const verdicts = subIds.length ? await db.select().from(verdictItems).where(inArray(verdictItems.submissionId, subIds)) : [];

  return {
    job, role,
    milestones: ms.map((m, i) => ({
      ...m,
      checklist: items.filter((c) => c.milestoneId === m.id),
      submission: latest[i],
      verdict: verdicts.filter((v) => v.submissionId === latest[i]?.id),
      events: evs.filter((e) => e.milestoneId === m.id),
    })),
  };
}
