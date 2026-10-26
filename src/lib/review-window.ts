import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { events, milestones } from "@/db/schema";
import { env } from "@/lib/env";
import { release } from "@/lib/payments";
import { friendlyError } from "@/lib/friendly-error";

const DEFAULT_MINUTES = 24 * 60;
const MAX_MINUTES = 48 * 60; // PayPal honors an authorization for 3 days; leave room for a dispute
const DEMO_MINUTES = 2;

// How long the client has to approve or dispute after an AI pass before the money releases itself.
export function reviewWindowMinutes(client: { isDemo: boolean }, configured = env.REVIEW_WINDOW_MINUTES) {
  if (client.isDemo) return DEMO_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(0, configured ?? DEFAULT_MINUTES));
}

// Releases every verified milestone whose window has ended. Called on start and every minute.
// ponytail: in-process sweeper, one instance; move to a Render cron/workflow if we scale out.
export async function releaseDue() {
  const due = await db.select({ id: milestones.id }).from(milestones)
    .where(and(eq(milestones.state, "passed"), lte(milestones.releaseAt, new Date())));
  for (const { id } of due) {
    await release(id).catch(async (e) => {
      if (/no longer passed|not passed/.test(String(e))) return; // approved or disputed meanwhile
      console.error("auto-release failed", id, e);
      await db.insert(events).values({ milestoneId: id, kind: "error", message: friendlyError(e) });
    });
  }
}
