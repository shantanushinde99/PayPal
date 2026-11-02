import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, submissions, users } from "@/db/schema";
import { confirmInbox, inboxCode } from "./inbox-check";

async function setup(code: string | null = "VF-AB12") {
  const [c] = await db.insert(users).values({ email: `c-${randomUUID()}@x.test` }).returning();
  const [j] = await db.insert(jobs).values({ clientId: c.id, freelancerEmail: "f@x.test", title: "T", description: "d", currency: "USD", status: "accepted" }).returning();
  const [m] = await db.insert(milestones).values({ jobId: j.id, position: 0, title: "Site", amountMinor: 30000, state: "passed", releaseAt: new Date(Date.now() + 3600_000) }).returning();
  const [s] = await db.insert(submissions).values({ milestoneId: m.id, url: "https://b.test/", inboxCode: code }).returning();
  return { c, m, s };
}
const ms = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0];
const sub = async (id: string) => (await db.select().from(submissions).where(eq(submissions.id, id)))[0];

describe("inbox check", () => {
  it("makes a short code from the submission", () => {
    expect(inboxCode("3f2a9c10-0000-0000-0000-000000000000")).toBe("VF-3F2A");
  });

  it("records a yes and leaves the payment on its way", async () => {
    const { c, m, s } = await setup();
    await confirmInbox(m.id, c, true);
    expect((await sub(s.id)).inboxConfirmed).toBe(true);
    expect((await ms(m.id)).state).toBe("passed");
    await expect(confirmInbox(m.id, c, false)).rejects.toThrow(/already answered/);
  });

  it("sends the work back to the freelancer on a no", async () => {
    const { c, m, s } = await setup();
    await confirmInbox(m.id, c, false);
    expect((await sub(s.id)).inboxConfirmed).toBe(false);
    expect(await ms(m.id)).toMatchObject({ state: "failed", releaseAt: null, failReason: expect.stringContaining("VF-AB12") });
  });

  it("is only for the client, and only when a test message was sent", async () => {
    const a = await setup(), b = await setup(null);
    await expect(confirmInbox(a.m.id, b.c, true)).rejects.toThrow(/not allowed/i);
    await expect(confirmInbox(b.m.id, b.c, true)).rejects.toThrow(/no test message/i);
  });
});
