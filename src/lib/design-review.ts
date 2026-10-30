import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { events, jobs, milestones, submissions, users, type Milestone } from "@/db/schema";
import { transition } from "@/db/transition";
import { jobRole } from "@/lib/job-access";
import { reviewWindowMinutes } from "@/lib/review-window";
import type { MilestoneState } from "@/lib/milestone-state";

// A design milestone is judged by the client, not the AI: they approve the mockup, or ask for changes
// within the rounds both sides agreed to. Silence approves it when the review window ends.

const log = (milestoneId: string, message: string) => db.insert(events).values({ milestoneId, kind: "state", message });

export async function submitDesign(m: Milestone, mockup: string) {
  const [client] = await db.select({ isDemo: users.isDemo }).from(jobs).innerJoin(users, eq(users.id, jobs.clientId)).where(eq(jobs.id, m.jobId));
  const minutes = Math.max(2, reviewWindowMinutes(client));
  await transition(m.id, m.state as MilestoneState, "verifying", { failReason: null });
  const [sub] = await db.insert(submissions).values({ milestoneId: m.id, afterPhoto: mockup }).returning();
  await transition(m.id, "verifying", "passed", { releaseAt: new Date(Date.now() + minutes * 60_000) });
  await log(m.id, "Design submitted. The client approves it or asks for changes; if they don't answer in time, it's approved.");
  return sub;
}

export async function requestChanges(milestoneId: string, user: { id: string; email: string }, note: string) {
  const [row] = await db.select({ m: milestones, j: jobs }).from(milestones).innerJoin(jobs, eq(jobs.id, milestones.jobId)).where(eq(milestones.id, milestoneId));
  if (!row || jobRole(row.j, user) !== "client") throw new Error("Not allowed");
  const { m, j } = row;
  if (m.proofType !== "design" || m.state !== "passed") throw new Error("Only a submitted design can get change requests.");
  if (!m.releaseAt || m.releaseAt <= new Date()) throw new Error("The review window has ended; the design is approved.");
  if (m.changeRequests >= j.revisionRounds) {
    throw new Error(`You've used all ${j.revisionRounds} change rounds you agreed to. Approve the design, or open a dispute if it misses a checklist item.`);
  }
  const what = note.trim();
  if (what.length < 10) throw new Error("Say what to change (at least 10 characters).");
  const round = m.changeRequests + 1;
  await transition(milestoneId, "passed", "failed", {
    changeRequests: round, releaseAt: null, failReason: `Changes requested (round ${round} of ${j.revisionRounds}): ${what.slice(0, 500)}`,
  });
  await log(milestoneId, `The client asked for changes: round ${round} of ${j.revisionRounds}.`);
}

// The mockup the client approved in an earlier design milestone: later website milestones are checked against it.
export async function approvedDesign(m: Pick<Milestone, "jobId" | "position">) {
  const [d] = await db.select({ id: milestones.id }).from(milestones)
    .where(and(eq(milestones.jobId, m.jobId), eq(milestones.proofType, "design"), eq(milestones.state, "paid_out"), lt(milestones.position, m.position)))
    .orderBy(desc(milestones.position)).limit(1);
  if (!d) return null;
  const [s] = await db.select({ img: submissions.afterPhoto }).from(submissions).where(eq(submissions.milestoneId, d.id)).orderBy(desc(submissions.createdAt)).limit(1);
  return s?.img ?? null;
}
