import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, users, type User } from "@/db/schema";
import { jobRole } from "@/lib/job-access";

async function invitation(jobId: string, user: Pick<User, "id" | "email">) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job || jobRole(job, user) !== "freelancer") throw new Error("This is not your invitation.");
  if (job.status !== "invited") throw new Error(`This job was already ${job.status}.`);
  return job;
}

// Conditional on status so a double click can't accept and decline at once.
export async function acceptJob(jobId: string, user: Pick<User, "id" | "email" | "payoutEmail">) {
  await invitation(jobId, user);
  const [row] = await db.update(jobs)
    .set({ status: "accepted", freelancerId: user.id, freelancerEmail: user.payoutEmail ?? user.email, acceptedAt: new Date(), declineNote: null })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "invited"))).returning();
  if (!row) throw new Error("This job was already answered.");
}

export async function declineJob(jobId: string, user: Pick<User, "id" | "email">, note: string) {
  await invitation(jobId, user);
  await db.update(jobs).set({ status: "declined", declineNote: note.trim().slice(0, 300) || null })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "invited")));
}

// The client changed what was agreed: the freelancer must accept the new version.
export async function resetAcceptance(jobId: string) {
  await db.update(jobs).set({ status: "invited", acceptedAt: null }).where(and(eq(jobs.id, jobId), eq(jobs.status, "accepted")));
}

type Hirer = Pick<User, "id" | "email" | "isDemo" | "demoGroup">;

// Who the new job goes to. Demo and real accounts never mix.
export async function resolveHire(client: Hirer, input: { freelancerId?: string; email?: string }) {
  if (input.freelancerId) {
    const [f] = await db.select().from(users).where(eq(users.id, input.freelancerId));
    if (f?.id === client.id) throw new Error("You can't hire yourself.");
    const sameWorld = f && f.isDemo === client.isDemo && (!f.isDemo || f.demoGroup === client.demoGroup);
    if (!f || !f.onboardedAt || !f.roles.includes("freelancer") || !sameWorld) throw new Error("That freelancer isn't available.");
    return { freelancerId: f.id, freelancerEmail: f.payoutEmail ?? f.email };
  }
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Choose a freelancer from the directory or enter their PayPal email.");
  if (client.isDemo) throw new Error("In the demo, hire one of the demo freelancers from the directory.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email address doesn't look right.");
  if (email === client.email) throw new Error("You can't hire yourself.");
  return { freelancerId: null, freelancerEmail: email };
}
