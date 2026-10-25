import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, events, milestones, submissions, verdictItems } from "@/db/schema";
import { transition } from "@/db/transition";
import { checkWebsite } from "@/lib/verify/website";
import { shouldRelease, type VerdictItem } from "@/lib/release";
import { release } from "@/lib/payments";

const logError = (milestoneId: string, message: string) => db.insert(events).values({ milestoneId, kind: "error", message });

export async function runVerification(milestoneId: string, submissionId: string) {
  let passed = false;
  try {
    passed = await verify(milestoneId, submissionId);
  } catch (e) {
    // Anything unexpected: leave the money on hold and let the freelancer resubmit.
    const reason = `The check could not finish: ${(e as Error).message}`;
    await logError(milestoneId, reason);
    await transition(milestoneId, "verifying", "failed", { failReason: reason });
    return;
  }
  if (!passed) return;
  try {
    await release(milestoneId);
  } catch (e) {
    await logError(milestoneId, `Payment step failed: ${(e as Error).message}`);
  }
}

async function verify(milestoneId: string, submissionId: string): Promise<boolean> {
  const log = async (message: string, image?: string) => {
    await db.insert(events).values({ milestoneId, kind: "agent", message, image });
  };
  const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!sub) throw new Error("submission not found");
  const checklist = await db.select().from(checklistItems)
    .where(eq(checklistItems.milestoneId, milestoneId)).orderBy(asc(checklistItems.position));

  let verdict: VerdictItem[];
  try {
    verdict = await checkWebsite({ url: sub.url, checklist, log });
  } catch (e) {
    const reason = `The check could not finish: ${(e as Error).message}`;
    await logError(milestoneId, reason);
    verdict = checklist.map((c) => ({ checklistItemId: c.id, status: "unsure", reason }));
  }
  await db.insert(verdictItems).values(verdict.map((v) => ({ ...v, submissionId })));

  if (!shouldRelease(verdict)) {
    const missing = verdict.filter((v) => v.status !== "pass").length;
    await transition(milestoneId, "verifying", "failed", { failReason: `${missing} item(s) not met yet` });
    return false;
  }
  await transition(milestoneId, "verifying", "passed");
  await log("All requirements met. Releasing payment…");
  return true;
}

// Checks run in-process via after(); a restart kills them. Called once at server start.
export async function failInterruptedChecks() {
  const stuck = await db.select({ id: milestones.id }).from(milestones).where(eq(milestones.state, "verifying"));
  for (const { id } of stuck) {
    await transition(id, "verifying", "failed", { failReason: "The check was interrupted by a server restart. Please resubmit." })
      .catch(() => {}); // finished in the meantime
  }
}
