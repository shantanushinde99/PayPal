"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { acceptDecision, askJudge, openDispute, rejectDecision, resolveByAdmin, respondDispute } from "@/lib/disputes";

export type DisputeState = { error?: string };

const jobOf = async (milestoneId: string) => (await db.select({ jobId: milestones.jobId }).from(milestones).where(eq(milestones.id, milestoneId)))[0]?.jobId;

// Shared wrapper: run the rule, refresh the job page, and show any rule error next to the form.
async function act(milestoneId: string, fn: () => Promise<void>): Promise<DisputeState> {
  try {
    await fn();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const jobId = await jobOf(milestoneId);
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  return {};
}

export async function openDisputeAction(milestoneId: string, _: DisputeState, form: FormData) {
  const user = await requireUser();
  return act(milestoneId, () => openDispute(milestoneId, user, String(form.get("statement") ?? "")));
}

export async function respondDisputeAction(milestoneId: string, _: DisputeState, form: FormData) {
  const user = await requireUser();
  return act(milestoneId, () => respondDispute(milestoneId, user, String(form.get("statement") ?? "")));
}

export async function askJudgeAction(milestoneId: string) {
  const user = await requireUser();
  return act(milestoneId, () => askJudge(milestoneId, user));
}

export async function acceptDecisionAction(milestoneId: string) {
  const user = await requireUser();
  return act(milestoneId, () => acceptDecision(milestoneId, user));
}

export async function rejectDecisionAction(milestoneId: string) {
  const user = await requireUser();
  return act(milestoneId, () => rejectDecision(milestoneId, user));
}

export async function resolveByAdminAction(milestoneId: string, _: DisputeState, form: FormData) {
  const user = await requireUser();
  return act(milestoneId, () => resolveByAdmin(milestoneId, user, Number(form.get("share")), String(form.get("note") ?? "")));
}
