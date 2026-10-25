import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, payments, users } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";
import { loadPaymentsForUser } from "./payment-history";

describe("loadPaymentsForUser", () => {
  it("returns a job's payments to its client and freelancer only, from each one's side", async () => {
    const m = await seedMilestone({ state: "paid_out" });
    await db.insert(payments).values([
      { milestoneId: m.id, kind: "hold", amountMinor: 1000, currency: "USD", paypalId: "AUTH1" },
      { milestoneId: m.id, kind: "paid", amountMinor: 1000, currency: "USD", paypalId: "CAP1" },
    ]);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, m.jobId));
    const [client] = await db.select().from(users).where(eq(users.id, job.clientId));
    const [stranger] = await db.insert(users).values({ email: `stranger-${randomUUID()}@x.test` }).returning();

    const asClient = await loadPaymentsForUser(client, { jobId: job.id });
    expect(asClient.map((p) => p.view.title)).toEqual(["Paid to free@example.com", "Held by PayPal"]);
    const asFreelancer = await loadPaymentsForUser({ id: randomUUID(), email: "free@example.com" }, { jobId: job.id });
    expect(asFreelancer[0].view).toMatchObject({ sign: "+", title: `Received from ${client.email}` });
    expect(await loadPaymentsForUser(stranger, { jobId: job.id })).toEqual([]);
  });
  it("marks a hold as settled once it was paid out, so it doesn't look like a second charge", async () => {
    const m = await seedMilestone({ state: "paid_out" });
    await db.insert(payments).values([
      { milestoneId: m.id, kind: "hold", amountMinor: 500, currency: "USD", paypalId: "AUTH2", createdAt: new Date(Date.now() - 60_000) },
      { milestoneId: m.id, kind: "paid", amountMinor: 500, currency: "USD", paypalId: "CAP2" },
    ]);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, m.jobId));
    const [client] = await db.select().from(users).where(eq(users.id, job.clientId));
    const hold = (await loadPaymentsForUser(client, { jobId: job.id })).find((p) => p.kind === "hold")!;
    expect(hold.view).toMatchObject({ status: "Settled", sign: "", tone: "returned" });
  });
});

describe("payment history names", () => {
  it("uses display names when known, so demo login emails never show", async () => {
    const [client] = await db.insert(users).values({ email: `c-${randomUUID()}@demo.verifund.app`, displayName: "Alex Rivera" }).returning();
    const [free] = await db.insert(users).values({ email: `f-${randomUUID()}@demo.verifund.app`, displayName: "Priya Shah" }).returning();
    const [job] = await db.insert(jobs).values({ clientId: client.id, freelancerId: free.id, freelancerEmail: "payout@sandbox.test", status: "accepted", title: "T", description: "d", currency: "USD" }).returning();
    const [m] = await db.insert(milestones).values({ jobId: job.id, position: 0, title: "M", amountMinor: 100, state: "paid_out" }).returning();
    await db.insert(payments).values({ milestoneId: m.id, kind: "paid", amountMinor: 100, currency: "USD", paypalId: "C" });
    expect((await loadPaymentsForUser(client, { jobId: job.id }))[0].view.title).toBe("Paid to Priya Shah");
    expect((await loadPaymentsForUser(free, { jobId: job.id }))[0].view.title).toBe("Received from Alex Rivera");
  });
});
