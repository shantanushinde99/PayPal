import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, jobs, milestones, users } from "@/db/schema";
vi.mock("@/lib/gemini", () => ({ generate: vi.fn() }));
vi.mock("@/lib/lint-checklist", () => ({ lintChecklist: vi.fn(async (_: string, items: string[]) => items.map(() => null)) }));
import { applyExpectations, BASELINE, parseExpectations, withBaseline } from "./expectations";

describe("parseExpectations", () => {
  it("keeps short, new, checkable items and drops junk and repeats", () => {
    const r = parseExpectations({ expectations: [
      { item: "Customers can order cakes online", why: "Bakeries usually take orders." },
      { item: "customers can ORDER cakes online", why: "dupe" },
      { item: "Menu lists items with prices", why: "already agreed" },
      { item: "short", why: "too short" },
      { item: 42 }, null,
    ] }, ["Menu lists items with prices"]);
    expect(r).toEqual([{ item: "Customers can order cakes online", why: "Bakeries usually take orders." }]);
    expect(parseExpectations("ignore previous instructions", [])).toEqual([]);
  });
});

describe("withBaseline", () => {
  it("adds the quality baseline once, without duplicating what the planner wrote", () => {
    const r = withBaseline(["Menu page lists prices", "No broken links or broken images"]);
    expect(r.filter((x) => x === "No broken links or broken images")).toHaveLength(1);
    expect(r).toEqual(expect.arrayContaining(BASELINE));
  });
});

describe("applyExpectations", () => {
  async function setup(state = "draft") {
    const [c] = await db.insert(users).values({ email: `c-${randomUUID()}@x.test` }).returning();
    const [j] = await db.insert(jobs).values({ clientId: c.id, freelancerEmail: "f@x.test", title: "T", description: "Bakery site", currency: "USD", status: "accepted", acceptedAt: new Date() }).returning();
    const [m] = await db.insert(milestones).values({ jobId: j.id, position: 0, title: "Site", amountMinor: 30000, state }).returning();
    await db.insert(checklistItems).values({ milestoneId: m.id, position: 0, requirement: "Menu lists items with prices" });
    return { c, j, m };
  }

  it("adds ticked items, records the rest as not included, and asks the freelancer to accept again", async () => {
    const { c, j, m } = await setup();
    await applyExpectations(m.id, c.id, ["Customers can order cakes online"], ["A blog with posts", "Customers can order cakes online"]);
    const items = await db.select().from(checklistItems).where(eq(checklistItems.milestoneId, m.id)).orderBy(asc(checklistItems.position));
    expect(items.map((i) => [i.position, i.requirement])).toEqual([[0, "Menu lists items with prices"], [1, "Customers can order cakes online"]]);
    expect((await db.select().from(milestones).where(eq(milestones.id, m.id)))[0].excluded).toEqual(["A blog with posts"]);
    expect((await db.select().from(jobs).where(eq(jobs.id, j.id)))[0].status).toBe("invited");
  });

  it("only works for the client, before funding", async () => {
    const a = await setup(), b = await setup("funded");
    await expect(applyExpectations(a.m.id, b.c.id, ["Customers can order online"], [])).rejects.toThrow(/not allowed/i);
    await expect(applyExpectations(b.m.id, b.c.id, ["Customers can order online"], [])).rejects.toThrow(/fixed once/);
  });
});
