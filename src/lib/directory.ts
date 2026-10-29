import { and, arrayContains, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, submissions, users, type User } from "@/db/schema";

export type DirectoryEntry = Pick<User, "id" | "displayName" | "headline" | "skills" | "bio" | "portfolioUrl"> & {
  trackRecord: { paid: number; firstTry: number } | null;
  portfolioVerified: boolean; // their own ownership code was found on the portfolio they link to
};

// Freelancers a viewer may hire: real ones for real users, their own workspace's for demo users.
export async function listFreelancers(viewer: Pick<User, "id" | "isDemo" | "demoGroup">, q = ""): Promise<DirectoryEntry[]> {
  const like = `%${q.trim().replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const rows = await db.select({
    id: users.id, displayName: users.displayName, headline: users.headline, skills: users.skills, bio: users.bio, portfolioUrl: users.portfolioUrl, portfolioVerifiedUrl: users.portfolioVerifiedUrl,
  }).from(users).where(and(
    arrayContains(users.roles, ["freelancer"]),
    isNotNull(users.onboardedAt),
    ne(users.id, viewer.id),
    viewer.isDemo ? and(eq(users.isDemo, true), eq(users.demoGroup, viewer.demoGroup!)) : eq(users.isDemo, false),
    q.trim() ? or(
      sql`${users.displayName} ilike ${like}`, sql`${users.headline} ilike ${like}`,
      sql`array_to_string(${users.skills}, ' ') ilike ${like}`,
    ) : undefined,
  )).orderBy(users.displayName).limit(100);
  if (!rows.length) return [];

  // Paid milestones per freelancer, and how many passed on their first submission.
  const stats = await db.select({
    freelancerId: jobs.freelancerId,
    paid: sql<number>`count(*)::int`,
    firstTry: sql<number>`count(*) filter (where (select count(*) from ${submissions} s where s.milestone_id = ${milestones.id}) = 1)::int`,
  }).from(milestones).innerJoin(jobs, eq(jobs.id, milestones.jobId))
    .where(and(eq(milestones.state, "paid_out"), inArray(jobs.freelancerId, rows.map((r) => r.id))))
    .groupBy(jobs.freelancerId);
  const by = new Map(stats.map((s) => [s.freelancerId, s]));
  return rows.map(({ portfolioVerifiedUrl, ...r }) => {
    const s = by.get(r.id);
    return {
      ...r, trackRecord: s ? { paid: s.paid, firstTry: Math.round((s.firstTry / s.paid) * 100) } : null,
      portfolioVerified: !!r.portfolioUrl && portfolioVerifiedUrl === r.portfolioUrl,
    };
  });
}
