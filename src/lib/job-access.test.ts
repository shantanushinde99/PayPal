import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, users } from "@/db/schema";
import { jobRole, myJobsWhere } from "./job-access";

const me = { id: "u1", email: "me@x.test" };

describe("jobRole", () => {
  it("knows the client and the linked freelancer", () => {
    expect(jobRole({ clientId: "u1", freelancerId: "u2", freelancerEmail: "f@x.test" }, me)).toBe("client");
    expect(jobRole({ clientId: "c", freelancerId: "u1", freelancerEmail: "payout@sandbox.test" }, me)).toBe("freelancer");
  });
  it("lets an unclaimed email invite through by email only", () => {
    expect(jobRole({ clientId: "c", freelancerId: null, freelancerEmail: "me@x.test" }, me)).toBe("freelancer");
  });
  it("never matches by email once the job is linked to an account", () => {
    expect(jobRole({ clientId: "c", freelancerId: "someone-else", freelancerEmail: "me@x.test" }, me)).toBeNull();
  });
  it("returns null for strangers", () => {
    expect(jobRole({ clientId: "c", freelancerId: null, freelancerEmail: "other@x.test" }, me)).toBeNull();
  });
});

describe("myJobsWhere", () => {
  it("selects the same jobs as jobRole", async () => {
    const mk = async () => (await db.insert(users).values({ email: `u-${randomUUID()}@x.test` }).returning())[0];
    const [a, b, c] = [await mk(), await mk(), await mk()];
    const base = { title: "T", description: "d", currency: "USD" };
    const [own] = await db.insert(jobs).values({ ...base, clientId: a.id, freelancerEmail: b.email }).returning();
    const [linked] = await db.insert(jobs).values({ ...base, clientId: c.id, freelancerId: a.id, freelancerEmail: "payout@x.test" }).returning();
    const [invite] = await db.insert(jobs).values({ ...base, clientId: c.id, freelancerEmail: a.email }).returning();
    const [claimed] = await db.insert(jobs).values({ ...base, clientId: c.id, freelancerId: b.id, freelancerEmail: a.email }).returning();
    const ids = (await db.select({ id: jobs.id }).from(jobs).where(myJobsWhere(a))).map((r) => r.id).sort();
    expect(ids).toEqual([own.id, linked.id, invite.id].sort());
    expect(ids).not.toContain(claimed.id);
    expect((await db.select().from(jobs).where(eq(jobs.id, own.id)))[0].status).toBe("invited");
  });
});
