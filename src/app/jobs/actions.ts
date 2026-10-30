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
import { checkProofLink } from "@/lib/proof-link";
import { withDesignItem } from "@/lib/design-reference";
import { requestChanges, submitDesign } from "@/lib/design-review";
import { lintChecklist } from "@/lib/lint-checklist";
import { startFunding, completeFunding, cancel, release } from "@/lib/payments";
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

  const rounds = Math.min(5, Math.max(0, Math.round(Number(formData.get("revisionRounds") ?? 2)) || 0));

  const plan = await planJob(description, budget);
  // After a design milestone, the build is checked against the approved mockup: that's part of what both sides agree to.
  const milestonesPlan = plan.milestones.map((m, i) => {
    const proofType = asProofType(m.proofType);
    const designBefore = plan.milestones.slice(0, i).some((x) => x.proofType === "design");
    return { ...m, proofType, checklist: proofType === "website" && designBefore ? withDesignItem(m.checklist) : m.checklist };
  });
  const notes = await Promise.all(milestonesPlan.map((m) => (m.proofType === "design" ? m.checklist.map(() => null) : lintChecklist(m.proofType, m.checklist))));
  const jobId = await db.transaction(async (tx) => {
    const [job] = await tx.insert(jobs).values({ clientId: user.id, ...hire, status: "invited", title: plan.title, description, currency, revisionRounds: rounds }).returning();
    for (const [i, m] of milestonesPlan.entries()) {
      const [ms] = await tx.insert(milestones).values({ jobId: job.id, position: i, title: m.title, proofType: m.proofType, amountMinor: toMinor(m.amount, currency) }).returning();
      await tx.insert(checklistItems).values(m.checklist.map((requirement, position) => ({ milestoneId: ms.id, position, requirement, lintNote: notes[i][position] })));
    }
    return job.id;
  });
  redirect(`/jobs/${jobId}`);
}

const asProofType = (v: unknown) => (v === "photo" || v === "design" ? v : "website");

// Client edits a draft milestone. Checklist is frozen once funded.
export async function saveMilestone(milestoneId: string, formData: FormData) {
  const user = await requireUser();
  const [row] = await db.select({ m: milestones, j: jobs }).from(milestones)
    .innerJoin(jobs, eq(jobs.id, milestones.jobId)).where(eq(milestones.id, milestoneId));
  if (!row || row.j.clientId !== user.id || row.m.state !== "draft") throw new Error("Not editable");

  const requirements = String(formData.get("checklist")).split("\n").map((s) => s.trim()).filter(Boolean);
  const amount = Number(formData.get("amount"));
  if (!requirements.length || !(amount > 0)) throw new Error("Need at least one requirement and an amount");

  const proofType = asProofType(formData.get("proofType"));
  const reference = proofType === "website" ? String(formData.get("referenceImage") ?? "") : "";
  if (reference) parsePhoto(reference); // throws on non-images / oversized
  const finalRequirements = reference ? withDesignItem(requirements) : requirements;
  const notes = proofType === "design" ? finalRequirements.map(() => null) : await lintChecklist(proofType, finalRequirements);

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
  redirect((await startFunding(milestoneId)).approveUrl);
}

// JS SDK buttons (PayPal, Pay Later, Venmo): same server-side order and authorization, approved in a popup.
export async function createFundingOrder(milestoneId: string): Promise<{ orderId?: string; error?: string }> {
  try {
    await requireClientOf(milestoneId);
    return { orderId: (await startFunding(milestoneId, { sdk: true })).orderId };
  } catch (e) {
    console.error("create order failed", milestoneId, e);
    return { error: "PayPal couldn't start the payment. Nothing was charged; please try again." };
  }
}

export async function approveFunding(milestoneId: string, orderId: string): Promise<{ error?: string }> {
  try {
    const { j } = await requireClientOf(milestoneId);
    await completeFunding(milestoneId, orderId);
    revalidatePath(`/jobs/${j.id}`);
    return {};
  } catch (e) {
    console.error("approve failed", milestoneId, e);
    return { error: "We couldn't confirm the PayPal approval. Nothing was charged twice; refresh the page to see the status." };
  }
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
  if (row.m.proofType === "design") {
    const mockup = String(formData.get("mockup") ?? "");
    parsePhoto(mockup); // throws on non-images / oversized
    proof = { afterPhoto: mockup };
  } else if (row.m.proofType === "photo") {
    const before = String(formData.get("beforePhoto") ?? ""), after = String(formData.get("afterPhoto") ?? "");
    parsePhoto(before); parsePhoto(after); // throws on non-images / oversized
    proof = { beforePhoto: before, afterPhoto: after };
  } else {
    const raw = String(formData.get("url") ?? "");
    const link = checkProofLink(raw); // the form checks this first; this is the server's copy of the rule
    if (link.problem) throw new Error(link.problem);
    proof = { url: new URL(raw.trim()).toString() };
  }

  if (row.m.position > 0) {
    const [prev] = await db.select().from(milestones)
      .where(and(eq(milestones.jobId, row.j.id), eq(milestones.position, row.m.position - 1)));
    if (prev && !["paid_out", "cancelled"].includes(prev.state)) throw new Error("Finish the previous milestone first");
  }

  if (row.m.proofType === "design") {
    await submitDesign(row.m, proof.afterPhoto!); // the client reviews it, not the AI
    revalidatePath(`/jobs/${row.j.id}`);
    return;
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

// Client wants changes to a submitted design (within the agreed rounds).
export async function requestDesignChanges(milestoneId: string, _: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  try {
    await requestChanges(milestoneId, user, String(formData.get("note") ?? ""));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const [m] = await db.select({ jobId: milestones.jobId }).from(milestones).where(eq(milestones.id, milestoneId));
  if (m) revalidatePath(`/jobs/${m.jobId}`);
  return {};
}

// Client is happy with the verified work: pay now instead of waiting for the review window.
export async function approveRelease(milestoneId: string) {
  const { m, j } = await requireClientOf(milestoneId);
  if (m.state !== "passed") throw new Error("Only verified work can be approved.");
  await release(milestoneId);
  revalidatePath(`/jobs/${j.id}`);
}
