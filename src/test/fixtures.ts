import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, jobs, milestones, checklistItems, type Milestone } from "@/db/schema";

export async function seedMilestone(patch: Partial<Milestone> = {}) {
  const [u] = await db.insert(users).values({ email: `test-${randomUUID()}@example.com` }).returning();
  const [j] = await db.insert(jobs).values({ clientId: u.id, freelancerEmail: "free@example.com", title: "T", description: "d", currency: "USD" }).returning();
  const [m] = await db.insert(milestones).values({ jobId: j.id, position: 0, title: "M", amountMinor: 1000, ...patch }).returning();
  await db.insert(checklistItems).values({ milestoneId: m.id, position: 0, requirement: "has a form" });
  return m;
}
