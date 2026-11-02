import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, jobs, milestones, users } from "@/db/schema";
import { cleanDomain, confirmHandover, domainItem, domainVerdict } from "./handover";

describe("domain check", () => {
  it("cleans what the client types", () => {
    expect(cleanDomain(" https://www.SunriseBakery.com/menu ")).toBe("sunrisebakery.com");
    expect(cleanDomain("shop.bakery.co.uk")).toBe("shop.bakery.co.uk");
    expect(cleanDomain("my bakery")).toBeNull();
  });
  it("passes only when the site is served from the client's domain (or a subdomain), measured by code", () => {
    const item = { id: "d", requirement: domainItem("sunrisebakery.com") };
    expect(domainVerdict(item, "https://www.sunrisebakery.com/").status).toBe("pass");
    expect(domainVerdict(item, "https://shop.sunrisebakery.com/").status).toBe("pass");
    const v = domainVerdict(item, "https://sunrise-bakery.vercel.app/");
    expect(v).toMatchObject({ status: "fail", reason: expect.stringContaining("sunrise-bakery.vercel.app") });
    expect(domainVerdict(item, "https://notsunrisebakery.com/").status).toBe("fail");
  });
});

describe("handover confirmations", () => {
  async function setup() {
    const [c] = await db.insert(users).values({ email: `c-${randomUUID()}@x.test` }).returning();
    const [j] = await db.insert(jobs).values({ clientId: c.id, freelancerEmail: "f@x.test", title: "T", description: "d", currency: "USD", status: "accepted" }).returning();
    const [m] = await db.insert(milestones).values({ jobId: j.id, position: 0, title: "Site", amountMinor: 30000, state: "passed", releaseAt: new Date(Date.now() + 3600_000) }).returning();
    const [h] = await db.insert(checklistItems).values({ milestoneId: m.id, position: 0, requirement: "Admin login for the website", kind: "handover" }).returning();
    const [i] = await db.insert(checklistItems).values({ milestoneId: m.id, position: 1, requirement: "Menu has prices" }).returning();
    return { c, m, h, i };
  }
  const item = async (id: string) => (await db.select().from(checklistItems).where(eq(checklistItems.id, id)))[0];
  const ms = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0];

  it("records a yes and leaves the payment on its way", async () => {
    const { c, m, h } = await setup();
    await confirmHandover(h.id, c, true);
    expect((await item(h.id)).confirmed).toBe(true);
    expect((await ms(m.id)).state).toBe("passed");
    await expect(confirmHandover(h.id, c, false)).rejects.toThrow(/already answered/);
  });

  it("sends the work back on a no", async () => {
    const { c, m, h } = await setup();
    await confirmHandover(h.id, c, false);
    expect(await ms(m.id)).toMatchObject({ state: "failed", releaseAt: null, failReason: expect.stringContaining("Admin login") });
  });

  it("is only for the client, and only for handover items", async () => {
    const a = await setup(), b = await setup();
    await expect(confirmHandover(a.h.id, b.c, true)).rejects.toThrow(/not allowed/i);
    await expect(confirmHandover(a.i.id, a.c, true)).rejects.toThrow(/not allowed/i);
  });
});
