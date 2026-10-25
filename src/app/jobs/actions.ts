"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, checklistItems } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { planJob } from "@/lib/plan-job";
import { toMinor } from "@/lib/money";
import { startFunding, cancel } from "@/lib/payments";

export async function createJob(formData: FormData) {
  const user = await requireUser();
  const description = String(formData.get("description")).trim();
  const currency = String(formData.get("currency"));
  const budget = Number(formData.get("budget"));
  const freelancerEmail = String(formData.get("freelancerEmail")).trim().toLowerCase();
  if (!description || !(budget > 0) || !freelancerEmail.includes("@")) throw new Error("Invalid job");
  if (freelancerEmail === user.email) throw new Error("You can't hire yourself");

  const plan = await planJob(description, budget);
  const jobId = await db.transaction(async (tx) => {
    const [job] = await tx.insert(jobs).values({ clientId: user.id, freelancerEmail, title: plan.title, description, currency }).returning();
    for (const [i, m] of plan.milestones.entries()) {
      const [ms] = await tx.insert(milestones).values({ jobId: job.id, position: i, title: m.title, amountMinor: toMinor(m.amount, currency) }).returning();
      await tx.insert(checklistItems).values(m.checklist.map((requirement, position) => ({ milestoneId: ms.id, position, requirement })));
    }
    return job.id;
  });
  redirect(`/jobs/${jobId}`);
}

// Client edits a draft milestone. Checklist is frozen once funded.
export async function saveMilestone(milestoneId: string, formData: FormData) {
  const user = await requireUser();
  const [row] = await db.select({ m: milestones, j: jobs }).from(milestones)
    .innerJoin(jobs, eq(jobs.id, milestones.jobId)).where(eq(milestones.id, milestoneId));
  if (!row || row.j.clientId !== user.id || row.m.state !== "draft") throw new Error("Not editable");

  const requirements = String(formData.get("checklist")).split("\n").map((s) => s.trim()).filter(Boolean);
  const amount = Number(formData.get("amount"));
  if (!requirements.length || !(amount > 0)) throw new Error("Need at least one requirement and an amount");

  await db.transaction(async (tx) => {
    await tx.update(milestones).set({ title: String(formData.get("title")), amountMinor: toMinor(amount, row.j.currency) })
      .where(and(eq(milestones.id, milestoneId), eq(milestones.state, "draft")));
    await tx.delete(checklistItems).where(eq(checklistItems.milestoneId, milestoneId));
    await tx.insert(checklistItems).values(requirements.map((requirement, position) => ({ milestoneId, position, requirement })));
  });
  revalidatePath(`/jobs/${row.j.id}`);
}

async function requireClientOf(milestoneId: string) {
  const user = await requireUser();
  const [row] = await db.select({ m: milestones, j: jobs }).from(milestones)
    .innerJoin(jobs, eq(jobs.id, milestones.jobId)).where(eq(milestones.id, milestoneId));
  if (!row || row.j.clientId !== user.id) throw new Error("Not allowed");
  return row;
}

export async function fundMilestone(milestoneId: string) {
  await requireClientOf(milestoneId);
  redirect(await startFunding(milestoneId));
}

export async function cancelMilestone(milestoneId: string) {
  const { j } = await requireClientOf(milestoneId);
  await cancel(milestoneId);
  revalidatePath(`/jobs/${j.id}`);
}
