"use server";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, checklistItems, submissions, verdictItems } from "@/db/schema";
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
import { confirmInbox } from "@/lib/inbox-check";
import { recheckWarranty } from "@/lib/warranty";
import { cleanDomain, confirmHandover, domainItem } from "@/lib/handover";
import { applyExpectations, suggestFor, withBaseline, type Expectation } from "@/lib/expectations";
import { lintChecklist } from "@/lib/lint-checklist";
import { startFunding, completeFunding, cancel, release } from "@/lib/payments";
import { runPreview, runVerification } from "@/lib/verify/run";
import { answerProposal, askScope, proposeMilestone } from "@/lib/scope";
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
  const warrantyPercent = Math.min(30, Math.max(0, Math.round(Number(formData.get("warrantyPercent") ?? 25)) || 0));
  const warrantyDays = [7, 14].includes(Number(formData.get("warrantyDays"))) ? Number(formData.get("warrantyDays")) : 7;

  const plan = await planJob(description, budget);
  // After a design milestone, the build is checked against the approved mockup: that's part of what both sides agree to.
  const milestonesPlan = plan.milestones.map((m, i) => {
    const proofType = asProofType(m.proofType);
    const designBefore = plan.milestones.slice(0, i).some((x) => x.proofType === "design");
    const checklist = proofType === "website" && designBefore ? withDesignItem(m.checklist) : m.checklist;
    return { ...m, proofType, checklist: proofType === "website" && m.liveSite ? withBaseline(checklist) : checklist };
  });
  const notes = await Promise.all(milestonesPlan.map((m) => (m.proofType === "design" ? m.checklist.map(() => null) : lintChecklist(m.proofType, m.checklist))));
  const jobId = await db.transaction(async (tx) => {
    const [job] = await tx.insert(jobs).values({ clientId: user.id, ...hire, status: "invited", title: plan.title, description, currency, revisionRounds: rounds, warrantyPercent, warrantyDays }).returning();
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

  const lines = (k: string) => String(formData.get(k) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const requirements = lines("checklist");
  const amount = Number(formData.get("amount"));
  if (!requirements.length || !(amount > 0)) throw new Error("Need at least one requirement and an amount");

  const proofType = asProofType(formData.get("proofType"));
  const journeys = proofType === "website" ? lines("journeys").filter((j) => !requirements.includes(j)).slice(0, 5) : [];
  const rawDomain = proofType === "website" ? String(formData.get("domain") ?? "").trim() : "";
  const domain = rawDomain ? cleanDomain(rawDomain) : null;
  if (rawDomain && !domain) throw new Error("That doesn't look like a domain. Use something like sunrisebakery.com.");
  const handover = proofType === "design" ? [] : lines("handover").map((h) => h.slice(0, 140)).slice(0, 6);
  // Ownership items: checked by code (domain) or confirmed by the client (handover), not by the AI.
  const owned = [...(domain ? [{ requirement: domainItem(domain), kind: "domain" }] : []), ...handover.map((requirement) => ({ requirement, kind: "handover" }))];
  const reference = proofType === "website" ? String(formData.get("referenceImage") ?? "") : "";
  if (reference) parsePhoto(reference); // throws on non-images / oversized
  const finalRequirements = reference ? withDesignItem(requirements) : requirements;
  const notes = proofType === "design" ? finalRequirements.map(() => null) : await lintChecklist(proofType, [...finalRequirements, ...journeys]);

  await db.transaction(async (tx) => {
    await tx.update(milestones).set({
      title: String(formData.get("title")), proofType, amountMinor: toMinor(amount, row.j.currency), referenceImage: reference || null,
      excluded: row.m.excluded.filter((x) => !finalRequirements.some((r) => r.toLowerCase() === x.toLowerCase())), // moved back into scope
    }).where(and(eq(milestones.id, milestoneId), eq(milestones.state, "draft")));
    await tx.delete(checklistItems).where(eq(checklistItems.milestoneId, milestoneId));
    await tx.insert(checklistItems).values([
      ...finalRequirements.map((requirement, position) => ({ milestoneId, position, requirement, lintNote: notes[position] })),
      ...journeys.map((requirement, i) => ({ milestoneId, position: finalRequirements.length + i, requirement, kind: "journey", lintNote: notes[finalRequirements.length + i] })),
      ...owned.map((o, i) => ({ milestoneId, position: finalRequirements.length + journeys.length + i, ...o })),
    ]);
    await resetAcceptance(row.j.id, tx); // same transaction: no window to fund the old version
    // Once money is in the job, the job stays accepted: the freelancer accepts this changed milestone on its own.
    const [j] = await tx.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, row.j.id));
    if (j?.status === "accepted") await tx.update(milestones).set({ pendingAcceptance: true }).where(eq(milestones.id, milestoneId));
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

const fundable = ({ m }: { m: { pendingAcceptance: boolean } }) => {
  if (m.pendingAcceptance) throw new Error("The freelancer hasn't accepted this milestone yet.");
};

export async function fundMilestone(milestoneId: string) {
  fundable(await requireClientOf(milestoneId));
  redirect((await startFunding(milestoneId)).approveUrl);
}

// JS SDK buttons (PayPal, Pay Later, Venmo): same server-side order and authorization, approved in a popup.
export async function createFundingOrder(milestoneId: string): Promise<{ orderId?: string; error?: string }> {
  try {
    fundable(await requireClientOf(milestoneId));
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

  if (formData.get("intent") === "preview") {
    if (row.m.proofType !== "website" || !["funded", "failed"].includes(row.m.state)) throw new Error("Preview checks are for website work while the money is held.");
    const previews = await db.select({ createdAt: submissions.createdAt, verdicts: count(verdictItems.id) }).from(submissions)
      .leftJoin(verdictItems, eq(verdictItems.submissionId, submissions.id))
      .where(and(eq(submissions.milestoneId, milestoneId), eq(submissions.preview, true))).groupBy(submissions.id);
    if (previews.some((p) => !p.verdicts && p.createdAt > new Date(Date.now() - 10 * 60_000))) throw new Error("A preview check is already running.");
    if (previews.length >= 10) throw new Error("This milestone has used its 10 preview checks. Submit it for the AI check when it's ready.");
    const [sub] = await db.insert(submissions).values({ milestoneId, ...proof, preview: true }).returning();
    after(() => runPreview(milestoneId, sub.id));
    revalidatePath(`/jobs/${row.j.id}`);
    return;
  }

  if (row.m.proofType === "design") {
    await submitDesign(row.m, proof.afterPhoto!); // the client reviews it, not the AI
    revalidatePath(`/jobs/${row.j.id}`);
    return;
  }

  await transition(milestoneId, row.m.state as MilestoneState, "verifying", { failReason: null });
  // A new delivery: anything the client said was missing gets asked again.
  await db.update(checklistItems).set({ confirmed: null }).where(and(eq(checklistItems.milestoneId, milestoneId), eq(checklistItems.kind, "handover"), eq(checklistItems.confirmed, false)));
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

// Expectation finder: what clients usually expect for this job that isn't written down yet.
export async function findExpectationsAction(milestoneId: string): Promise<{ items?: Expectation[]; error?: string }> {
  const user = await requireUser();
  try {
    return { items: await suggestFor(milestoneId, user.id) };
  } catch (e) {
    console.error("expectation finder failed", milestoneId, e);
    return { error: e instanceof Error && /Not allowed|fixed once/.test(e.message) ? e.message : "The AI couldn't look for missing items right now. Please try again." };
  }
}

export async function applyExpectationsAction(milestoneId: string, add: string[], excluded: string[]): Promise<{ error?: string }> {
  const user = await requireUser();
  try {
    await applyExpectations(milestoneId, user.id, add, excluded);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const [m] = await db.select({ jobId: milestones.jobId }).from(milestones).where(eq(milestones.id, milestoneId));
  if (m) revalidatePath(`/jobs/${m.jobId}`);
  return {};
}

// "Is this included, or new work?" (either side), then the client may propose new work as a paid milestone.
export async function askScopeAction(jobId: string, _: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  try {
    await askScope(jobId, user, String(formData.get("request") ?? ""));
  } catch (e) {
    console.error("scope question failed", jobId, e);
    return { error: e instanceof Error && !/fetch|quota|model|Gemini|429|503/i.test(e.message) ? e.message : "The AI couldn't answer right now. Please try again." };
  }
  revalidatePath(`/jobs/${jobId}`);
  return {};
}

export async function proposeMilestoneAction(requestId: string, jobId: string) {
  const user = await requireUser();
  await proposeMilestone(requestId, user);
  revalidatePath(`/jobs/${jobId}`);
}

export async function answerProposalAction(milestoneId: string, accept: boolean) {
  const user = await requireUser();
  await answerProposal(milestoneId, user, accept);
  const [m] = await db.select({ jobId: milestones.jobId }).from(milestones).where(eq(milestones.id, milestoneId));
  if (m) revalidatePath(`/jobs/${m.jobId}`);
}

export async function confirmHandoverAction(itemId: string, jobId: string, received: boolean) {
  const user = await requireUser();
  await confirmHandover(itemId, user, received);
  revalidatePath(`/jobs/${jobId}`);
}

export async function recheckWarrantyAction(milestoneId: string) {
  const user = await requireUser();
  await recheckWarranty(milestoneId, user);
  const [m] = await db.select({ jobId: milestones.jobId }).from(milestones).where(eq(milestones.id, milestoneId));
  if (m) revalidatePath(`/jobs/${m.jobId}`);
}

// Client says whether the AI's test message reached their inbox.
export async function confirmInboxAction(milestoneId: string, received: boolean) {
  const user = await requireUser();
  await confirmInbox(milestoneId, user, received);
  const [m] = await db.select({ jobId: milestones.jobId }).from(milestones).where(eq(milestones.id, milestoneId));
  if (m) revalidatePath(`/jobs/${m.jobId}`);
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
