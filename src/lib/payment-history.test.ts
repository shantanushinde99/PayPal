import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, payments, users } from "@/db/schema";
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
