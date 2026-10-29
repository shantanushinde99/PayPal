import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, payments, users } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";
import { loadInsights } from "./insights";

// A paid milestone and a funded one on the same job, with a linked freelancer.
async function seed() {
  const paid = await seedMilestone({ state: "paid_out", capturedMinor: 600 });
  const [job] = await db.select().from(jobs).where(eq(jobs.id, paid.jobId));
  const [held] = await db.insert(milestones).values({ jobId: job.id, position: 1, title: "Part 2", amountMinor: 2000, state: "funded" }).returning();
  await db.insert(milestones).values({ jobId: job.id, position: 2, title: "Part 3", amountMinor: 5000, state: "draft" });
  const [free] = await db.insert(users).values({ email: `f-${randomUUID()}@example.com`, displayName: "Priya", roles: ["freelancer", "client"] }).returning();
  await db.update(jobs).set({ freelancerId: free.id }).where(eq(jobs.id, job.id));
  await db.update(users).set({ displayName: "Leon" }).where(eq(users.id, job.clientId));
  await db.insert(payments).values([
    { milestoneId: paid.id, kind: "hold", amountMinor: 1000, currency: "USD", paypalId: "H", createdAt: new Date("2026-10-01T00:00:00Z") },
    { milestoneId: paid.id, kind: "paid", amountMinor: 600, currency: "USD", paypalId: "P", createdAt: new Date("2026-10-03T12:00:00Z") },
    { milestoneId: paid.id, kind: "void", amountMinor: 400, currency: "USD", paypalId: "V", createdAt: new Date("2026-10-03T12:00:00Z") },
    { milestoneId: held.id, kind: "hold", amountMinor: 2000, currency: "USD", paypalId: "H2", createdAt: new Date("2026-10-05T00:00:00Z") },
  ]);
  const [client] = await db.select().from(users).where(eq(users.id, job.clientId));
  return { client, free };
}

describe("loadInsights", () => {
  it("gives the client their spending, with the freelancer as the other party", async () => {
    const { client } = await seed();
    const r = await loadInsights(client, "client");
    const byTitle = Object.fromEntries(r.milestones.map((m) => [m.milestone, m]));
    expect(byTitle["M"]).toMatchObject({ counterpart: "Priya", stage: "Paid", amount: 10, paid: 6, onHold: 0, completed: 1, daysToPaid: 2.5 });
    expect(byTitle["Part 2"]).toMatchObject({ stage: "On hold", onHold: 20, paid: 0, completed: 0 });
    expect(byTitle["Part 3"]).toMatchObject({ stage: "Draft", onHold: 0 }); // a draft isn't money in escrow
    expect(r.payments.map((p) => p.movement).sort()).toEqual(["Funded (on hold)", "Funded (on hold)", "Paid", "Returned to you"]);
    expect(r.payments.reduce((t, p) => t + p.settled, 0)).toBe(6); // only what was actually paid counts as spent
  });

  it("gives the freelancer their earnings, with the client as the other party", async () => {
    const { free } = await seed();
    const r = await loadInsights(free, "freelancer");
    expect(r.milestones.find((m) => m.milestone === "M")).toMatchObject({ counterpart: "Leon", paid: 6, completed: 1 });
    expect(r.milestones.find((m) => m.milestone === "Part 2")).toMatchObject({ onHold: 20 });
    expect(r.payments.map((p) => p.movement).sort()).toEqual(["Held for you", "Held for you", "Received", "Released to client"]);
    expect(r.payments.reduce((t, p) => t + p.settled, 0)).toBe(6); // held money isn't earned yet
  });

  it("shows only the side being viewed to someone with both roles", async () => {
    const { free } = await seed(); // Priya is also a client, but not on this job
    expect((await loadInsights(free, "client")).milestones).toEqual([]);
  });

  it("shows strangers nothing and admins the whole platform", async () => {
    await seed();
    expect((await loadInsights({ id: randomUUID(), email: `x-${randomUUID()}@example.com`, isAdmin: false }, "client")).milestones).toEqual([]);
    const admin = await loadInsights({ id: randomUUID(), email: "admin@example.com", isAdmin: true }, "platform");
    expect(admin.milestones.length).toBeGreaterThanOrEqual(3);
  });
});
