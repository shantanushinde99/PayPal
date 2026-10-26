"use server";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, checklistItems, submissions } from "@/db/schema";
import { transition } from "@/db/transition";
import { requireUser } from "@/lib/session";
import { jobRole } from "@/lib/job-access";
import { acceptJob, declineJob, resetAcceptance, resolveHire } from "@/lib/invitations";
import { planJob } from "@/lib/plan-job";
import { toMinor, CURRENCIES } from "@/lib/money";
import { parsePhoto } from "@/lib/photo-input";
import { withDesignItem } from "@/lib/design-reference";
import { lintChecklist } from "@/lib/lint-checklist";
import { startFunding, cancel, release } from "@/lib/payments";
import { runVerification } from "@/lib/verify/run";
import type { MilestoneState } from "@/lib/milestone-state";

export async function createJob(formData: FormData) {
  const user = await requireUser();
  const description = String(formData.get("description")).trim();
  const currency = String(formData.get("currency"));
  const budget = Number(formData.get("budget"));
  if (!user.roles.includes("client")) throw new Error("Add the client role in your profile to post jobs.");
  if (!description || !(budget > 0)) throw new Error("Describe the job and set a budget.");
  if (!CURRENCIES.includes(currency)) throw new Error("Unsupported currency");
  const hire = await resolveHire(user, { freelancerId: String(formData.get("freelancerId") ?? "") || undefined, email: String(formData.get("freelancerEmail") ?? "") });

  const plan = await planJob(description, budget);
  const notes = await Promise.all(plan.milestones.map((m) => lintChecklist(m.proofType === "photo" ? "photo" : "website", m.checklist)));
  const jobId = await db.transaction(async (tx) => {
    const [job] = await tx.insert(jobs).values({ clientId: user.id, ...hire, status: "invited", title: plan.title, description, currency }).returning();
    for (const [i, m] of plan.milestones.entries()) {
      const proofType = m.proofType === "photo" ? "photo" : "website";
      const [ms] = await tx.insert(milestones).values({ jobId: job.id, position: i, title: m.title, proofType, amountMinor: toMinor(m.amount, currency) }).returning();
      await tx.insert(checklistItems).values(m.checklist.map((requirement, position) => ({ milestoneId: ms.id, position, requirement, lintNote: notes[i][position] })));
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

  const proofType = formData.get("proofType") === "photo" ? "photo" : "website";
  const reference = proofType === "website" ? String(formData.get("referenceImage") ?? "") : "";
  if (reference) parsePhoto(reference); // throws on non-images / oversized
  const finalRequirements = reference ? withDesignItem(requirements) : requirements;
  const notes = await lintChecklist(proofType, finalRequirements);

  await db.transaction(async (tx) => {
    await tx.update(milestones).set({
      title: String(formData.get("title")), proofType, amountMinor: toMinor(amount, row.j.currency), referenceImage: reference || null,
    }).where(and(eq(milestones.id, milestoneId), eq(milestones.state, "draft")));
    await tx.delete(checklistItems).where(eq(checklistItems.milestoneId, milestoneId));
    await tx.insert(checklistItems).values(finalRequirements.map((requirement, position) => ({ milestoneId, position, requirement, lintNote: notes[position] })));
    await resetAcceptance(row.j.id, tx); // same transaction: no window to fund the old version
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

export async function submitProof(milestoneId: string, formData: FormData) {
  const user = await requireUser();
  const [row] = await db.select({ m: milestones, j: jobs }).from(milestones)
    .innerJoin(jobs, eq(jobs.id, milestones.jobId)).where(eq(milestones.id, milestoneId));
  if (!row || jobRole(row.j, user) !== "freelancer") throw new Error("Not allowed");
  if (row.j.status !== "accepted") throw new Error("Accept the job before submitting proof");

  let proof: { url?: string; beforePhoto?: string; afterPhoto?: string };
  if (row.m.proofType === "photo") {
    const before = String(formData.get("beforePhoto") ?? ""), after = String(formData.get("afterPhoto") ?? "");
    parsePhoto(before); parsePhoto(after); // throws on non-images / oversized
    proof = { beforePhoto: before, afterPhoto: after };
  } else {
    const url = new URL(String(formData.get("url"))); // throws on junk
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL must be http(s)");
    proof = { url: url.toString() };
  }

  if (row.m.position > 0) {
    const [prev] = await db.select().from(milestones)
      .where(and(eq(milestones.jobId, row.j.id), eq(milestones.position, row.m.position - 1)));
    if (prev && !["paid_out", "cancelled"].includes(prev.state)) throw new Error("Finish the previous milestone first");
  }

  await transition(milestoneId, row.m.state as MilestoneState, "verifying", { failReason: null });
  const [sub] = await db.insert(submissions).values({ milestoneId, ...proof }).returning();
  after(() => runVerification(milestoneId, sub.id));
  revalidatePath(`/jobs/${row.j.id}`);
}

// Client can retry the PayPal step if capture/payout failed after a pass.
export async function retryRelease(milestoneId: string) {
  const { j } = await requireClientOf(milestoneId);
  await release(milestoneId);
  revalidatePath(`/jobs/${j.id}`);
}

export async function acceptInvitation(jobId: string) {
  const user = await requireUser();
  await acceptJob(jobId, user);
  revalidatePath(`/jobs/${jobId}`);
}

export async function declineInvitation(jobId: string, formData: FormData) {
  const user = await requireUser();
  await declineJob(jobId, user, String(formData.get("note") ?? ""));
  revalidatePath(`/jobs/${jobId}`);
}

// Client is happy with the verified work: pay now instead of waiting for the review window.
export async function approveRelease(milestoneId: string) {
  const { m, j } = await requireClientOf(milestoneId);
  if (m.state !== "passed") throw new Error("Only verified work can be approved.");
  await release(milestoneId);
  revalidatePath(`/jobs/${j.id}`);
}
