import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, events, type Milestone } from "@/db/schema";
import { canTransition, type MilestoneState } from "@/lib/milestone-state";

// Atomic: only succeeds if the row is still in `from`. Concurrent callers lose and get an error.
export async function transition(
  id: string, from: MilestoneState, to: MilestoneState, patch: Partial<Milestone> = {},
): Promise<Milestone> {
  if (!canTransition(from, to)) throw new Error(`Illegal transition ${from} -> ${to}`);
  const [row] = await db
    .update(milestones)
    .set({ ...patch, state: to })
    .where(and(eq(milestones.id, id), eq(milestones.state, from)))
    .returning();
  if (!row) throw new Error(`Milestone ${id} is no longer ${from}`);
  await db.insert(events).values({ milestoneId: id, kind: "state", message: `${from} → ${to}` });
  return row;
}
