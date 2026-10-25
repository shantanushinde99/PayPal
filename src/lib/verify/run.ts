import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, events, submissions, verdictItems } from "@/db/schema";
import { transition } from "@/db/transition";
import { checkWebsite } from "@/lib/verify/website";
import { shouldRelease, type VerdictItem } from "@/lib/release";
import { release } from "@/lib/payments";

export async function runVerification(milestoneId: string, submissionId: string) {
  const log = async (message: string, image?: string) => {
    await db.insert(events).values({ milestoneId, kind: "agent", message, image });
  };
  const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  const checklist = await db.select().from(checklistItems)
    .where(eq(checklistItems.milestoneId, milestoneId)).orderBy(asc(checklistItems.position));

  let verdict: VerdictItem[];
  try {
    verdict = await checkWebsite({ url: sub.url, checklist, log });
  } catch (e) {
    const reason = `The check could not finish: ${(e as Error).message}`;
    await db.insert(events).values({ milestoneId, kind: "error", message: reason });
    verdict = checklist.map((c) => ({ checklistItemId: c.id, status: "unsure", reason }));
  }
  await db.insert(verdictItems).values(verdict.map((v) => ({ ...v, submissionId })));

  if (!shouldRelease(verdict)) {
    const missing = verdict.filter((v) => v.status !== "pass").length;
    await transition(milestoneId, "verifying", "failed", { failReason: `${missing} item(s) not met yet` });
    return;
  }
  await transition(milestoneId, "verifying", "passed");
  await log("All requirements met. Releasing payment…");
  try {
    await release(milestoneId);
  } catch (e) {
    await db.insert(events).values({ milestoneId, kind: "error", message: `Payment step failed: ${(e as Error).message}` });
  }
}
