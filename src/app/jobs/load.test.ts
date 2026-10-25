import { describe, it, expect, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
import { db } from "@/db";
import { jobs, submissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { seedMilestone } from "@/test/fixtures";
import { loadJobForUser } from "./load";

describe("loadJobForUser", () => {
  it("does not load the heavy audit report for the job page", async () => {
    const m = await seedMilestone();
    await db.insert(submissions).values({ milestoneId: m.id, url: "https://x.test/", report: { pages: ["big"] } });
    const [job] = await db.select().from(jobs).where(eq(jobs.id, m.jobId));
    const [client] = await db.select().from(users).where(eq(users.id, job.clientId));
    const data = await loadJobForUser(job.id, { id: client.id, email: client.email });
    expect(data.milestones[0].submission).toBeDefined();
    expect(data.milestones[0].submission).not.toHaveProperty("report");
  });
});
