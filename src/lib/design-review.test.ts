import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, submissions, users } from "@/db/schema";
import { approvedDesign, requestChanges, submitDesign } from "./design-review";

const IMG = "data:image/jpeg;base64,AAAA";
const mk = async (patch = {}) => (await db.insert(users).values({ email: `u-${randomUUID()}@x.test`, ...patch }).returning())[0];
async function setup(rounds = 2) {
  const client = await mk({ roles: ["client"] }), free = await mk({ roles: ["freelancer"] });
  const [job] = await db.insert(jobs).values({ clientId: client.id, freelancerId: free.id, freelancerEmail: free.email, status: "accepted", title: "T", description: "d", currency: "USD", revisionRounds: rounds }).returning();
  const [m] = await db.insert(milestones).values({ jobId: job.id, position: 0, title: "Design", amountMinor: 5000, proofType: "design", state: "funded" }).returning();
  return { client, free, job, m };
}
const ms = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0];

describe("design review", () => {
  it("goes to the client (not the AI), who can ask for changes only within the agreed rounds", async () => {
    const { client, free, m } = await setup(1);
    await submitDesign(m, IMG);
    expect(await ms(m.id)).toMatchObject({ state: "passed" });
    expect((await ms(m.id)).releaseAt!.getTime()).toBeGreaterThan(Date.now()); // silence approves it later

    await expect(requestChanges(m.id, free, "Make it warmer please")).rejects.toThrow(/not allowed/i);
    await expect(requestChanges(m.id, client, "meh")).rejects.toThrow(/what to change/i);
    await requestChanges(m.id, client, "Make the header warmer please");
    expect(await ms(m.id)).toMatchObject({ state: "failed", changeRequests: 1, failReason: expect.stringContaining("round 1 of 1") });

    await submitDesign(await ms(m.id), IMG); // the freelancer sends a new version
    await expect(requestChanges(m.id, client, "Actually, the old blue")).rejects.toThrow(/used all 1 change rounds/);
    expect((await ms(m.id)).state).toBe("passed");
  });

  it("hands the approved mockup to later milestones as their reference design", async () => {
    const { job, m } = await setup();
    await db.update(milestones).set({ state: "paid_out" }).where(eq(milestones.id, m.id));
    await db.insert(submissions).values({ milestoneId: m.id, afterPhoto: IMG });
    expect(await approvedDesign({ jobId: job.id, position: 1 })).toBe(IMG);
    expect(await approvedDesign({ jobId: job.id, position: 0 })).toBeNull(); // not from itself or later ones
  });
});
