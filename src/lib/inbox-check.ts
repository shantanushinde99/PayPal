import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, jobs, milestones, submissions } from "@/db/schema";
import { transition } from "@/db/transition";

// "The form shows 'thanks'" isn't "the message arrived". The AI sends its test message with a short code; only the
// client can see their inbox, so they confirm whether it arrived. Silence doesn't block payment.

export const inboxCode = (submissionId: string) => `VF-${submissionId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;

export async function confirmInbox(milestoneId: string, user: { id: string }, received: boolean) {
  const [row] = await db.select({ m: milestones, j: jobs }).from(milestones).innerJoin(jobs, eq(jobs.id, milestones.jobId)).where(eq(milestones.id, milestoneId));
  if (!row || row.j.clientId !== user.id) throw new Error("Not allowed");
  if (row.m.state !== "passed") throw new Error("This can only be answered while the work is waiting for your approval.");
  const [sub] = await db.select().from(submissions).where(eq(submissions.milestoneId, milestoneId)).orderBy(desc(submissions.createdAt)).limit(1);
  if (!sub?.inboxCode) throw new Error("No test message was sent for this delivery.");
  if (sub.inboxConfirmed !== null) throw new Error("You already answered this.");
  await db.update(submissions).set({ inboxConfirmed: received }).where(and(eq(submissions.id, sub.id), eq(submissions.milestoneId, milestoneId)));
  if (received) {
    await db.insert(events).values({ milestoneId, kind: "state", message: `The client confirmed the test message ${sub.inboxCode} reached their inbox.` });
    return;
  }
  // Not received: the form doesn't really work yet. Back to the freelancer, who can fix it or dispute.
  await transition(milestoneId, "passed", "failed", {
    releaseAt: null, failReason: `The client didn't receive the test message (${sub.inboxCode}) sent through the contact form. Check where the form sends messages, then resubmit.`,
  });
  await db.insert(events).values({ milestoneId, kind: "state", message: `The client says the test message ${sub.inboxCode} never arrived.` });
}
