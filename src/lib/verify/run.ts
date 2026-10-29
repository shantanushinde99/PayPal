import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, events, jobs, milestones, replays, submissions, users, verdictItems } from "@/db/schema";
import { checkPhotos } from "@/lib/verify/photo";
import { parsePhoto } from "@/lib/photo-input";
import { transition } from "@/db/transition";
import { checkWebsite } from "@/lib/verify/website";
import { checkRepo, isCodeHostUrl, RepoProblem } from "@/lib/verify/repo";
import { env } from "@/lib/env";
import { shouldRelease, type VerdictItem } from "@/lib/release";
import { release } from "@/lib/payments";
import { reviewWindowMinutes } from "@/lib/review-window";
import { friendlyError } from "@/lib/friendly-error";
import { isSampleSite, ownershipCode } from "@/lib/ownership";

const logError = (milestoneId: string, message: string) => db.insert(events).values({ milestoneId, kind: "error", message });

export async function runVerification(milestoneId: string, submissionId: string) {
  let passed: false | "window" | "now" = false;
  try {
    passed = await verify(milestoneId, submissionId);
  } catch (e) {
    // Anything unexpected: leave the money on hold and let the freelancer resubmit.
    console.error("verification crashed", milestoneId, e);
    const reason = friendlyError(e);
    await logError(milestoneId, reason);
    await transition(milestoneId, "verifying", "failed", { failReason: reason });
    return;
  }
  if (passed !== "now") return; // the review window releases it later, unless the client disputes
  try {
    await release(milestoneId);
  } catch (e) {
    console.error("release failed", milestoneId, e);
    await logError(milestoneId, friendlyError(e));
  }
}

async function verify(milestoneId: string, submissionId: string): Promise<false | "window" | "now"> {
  const log = async (message: string, image?: string) => {
    await db.insert(events).values({ milestoneId, kind: "agent", message, image });
  };
  const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!sub) throw new Error("submission not found");
  const [m] = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
  const checklist = await db.select().from(checklistItems)
    .where(eq(checklistItems.milestoneId, milestoneId)).orderBy(asc(checklistItems.position));

  let verdict: VerdictItem[];
  let checkError: string | undefined;
  try {
    if (m.proofType === "photo") {
      verdict = await checkPhotos({ before: parsePhoto(sub.beforePhoto ?? ""), after: parsePhoto(sub.afterPhoto ?? ""), checklist, log });
    } else {
      const reference = m.referenceImage ? parsePhoto(m.referenceImage) : undefined;
      const [j] = await db.select({ freelancerId: jobs.freelancerId, clientDemo: users.isDemo }).from(jobs)
        .innerJoin(users, eq(users.id, jobs.clientId)).where(eq(jobs.id, m.jobId));
      const url = sub.url ?? "";
      // Ownership is proven on real accounts; demo workspaces (sandbox money) and Verifund's sample sites skip it.
      const skip = isSampleSite(url) ? "Verifund sample site: ownership check skipped." : j.clientDemo ? "Demo workspace: ownership check skipped. On a real account you'd prove this is yours." : null;
      const ownerCode = skip ? undefined : ownershipCode(j.freelancerId ?? "none");
      const r = isCodeHostUrl(url)
        ? await checkRepo({ url, checklist, ownerCode, log, token: env.GITHUB_READ_TOKEN })
        : await checkWebsite({
          url, checklist, reference, ownerCode, skipNote: skip ?? undefined, log,
          onReplay: async (mp4) => { await db.insert(replays).values({ submissionId, mp4 }).onConflictDoNothing(); },
        });
      verdict = r.verdict;
      await db.update(submissions).set({ report: r.report }).where(eq(submissions.id, submissionId));
    }
  } catch (e) {
    console.error("check failed", milestoneId, e);
    const reason = (checkError = e instanceof RepoProblem ? e.message : friendlyError(e));
    await logError(milestoneId, reason);
    verdict = checklist.map((c) => ({ checklistItemId: c.id, status: "unsure", reason }));
  }
  await db.insert(verdictItems).values(verdict.map((v) => ({ ...v, submissionId })));

  if (!shouldRelease(verdict)) {
    const missing = verdict.filter((v) => v.status !== "pass").length;
    const failReason = checkError ?? `${missing} checklist item${missing === 1 ? "" : "s"} still need${missing === 1 ? "s" : ""} work`;
    await transition(milestoneId, "verifying", "failed", { failReason });
    return false;
  }
  const [client] = await db.select({ isDemo: users.isDemo }).from(jobs).innerJoin(users, eq(users.id, jobs.clientId)).where(eq(jobs.id, m.jobId));
  const minutes = reviewWindowMinutes(client);
  if (minutes === 0) {
    await transition(milestoneId, "verifying", "passed");
    await log("All requirements met. Releasing payment…");
    return "now";
  }
  await transition(milestoneId, "verifying", "passed", { releaseAt: new Date(Date.now() + minutes * 60_000) });
  const when = minutes >= 120 ? `${Math.round(minutes / 60)} hours` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  await log(`All requirements met. The payment releases automatically in ${when} unless the client disputes it.`);
  return "window";
}

// Checks run in-process via after(); a restart kills them. Called once at server start.
export async function failInterruptedChecks() {
  const stuck = await db.select({ id: milestones.id }).from(milestones).where(eq(milestones.state, "verifying"));
  for (const { id } of stuck) {
    await transition(id, "verifying", "failed", { failReason: "The check was interrupted by a server restart. Please resubmit." })
      .catch(() => {}); // finished in the meantime
  }
}
