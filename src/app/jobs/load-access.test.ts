import { describe, it, expect, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { jobs, users } from "@/db/schema";
import { loadJobForUser } from "./load";
import { loadPaymentsForUser } from "@/lib/payment-history";

const mk = async (patch = {}) => (await db.insert(users).values({ email: `u-${randomUUID()}@x.test`, displayName: "N", ...patch }).returning())[0];

describe("job access by account", () => {
  it("lets the linked freelancer in even when payouts go to another address", async () => {
    const client = await mk({ displayName: "Alex" }), free = await mk({ displayName: "Priya" });
    const [job] = await db.insert(jobs).values({ clientId: client.id, freelancerId: free.id, freelancerEmail: "payout@sandbox.test", title: "T", description: "d", currency: "USD" }).returning();
    const data = await loadJobForUser(job.id, free);
    expect(data.role).toBe("freelancer");
    expect(data.client.name).toBe("Alex");
    expect(data.freelancer.name).toBe("Priya");
  });
  it("keeps out someone whose email matches a linked job's payout address", async () => {
    const client = await mk(), free = await mk(), lookalike = await mk({ email: `payout-${randomUUID()}@sandbox.test` });
    const [job] = await db.insert(jobs).values({ clientId: client.id, freelancerId: free.id, freelancerEmail: lookalike.email, title: "T", description: "d", currency: "USD" }).returning();
    await expect(loadJobForUser(job.id, lookalike)).rejects.toThrow("404");
    expect(await loadPaymentsForUser(lookalike, { jobId: job.id })).toEqual([]);
  });
});
