import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, jobs, milestones, scopeRequests, users } from "@/db/schema";
vi.mock("@/lib/gemini", () => ({ generate: vi.fn() }));
vi.mock("@/lib/lint-checklist", () => ({ lintChecklist: vi.fn(async (_: string, items: string[]) => items.map(() => null)) }));
import { answerProposal, askScope, parseScope, proposeMilestone } from "./scope";

const ITEMS = ["Menu page lists items with prices", "Contact form shows a confirmation"];

describe("parseScope", () => {
  it("accepts 'included' only with a real checklist item; anything else is new work", () => {
    expect(parseScope({ verdict: "included", reason: "On the menu item.", item: "menu page lists items with prices" }, ITEMS))
      .toMatchObject({ verdict: "included", item: "Menu page lists items with prices" });
    expect(parseScope({ verdict: "included", reason: "x", item: "A blog" }, ITEMS)).toMatchObject({ verdict: "new", item: null });
    expect(parseScope({ verdict: "new", reason: "New feature.", title: "Online ordering", checklist: ["Customers can order cakes online", "x"], price: 79.999 }, ITEMS))
      .toEqual({ verdict: "new", reason: "New feature.", item: null, title: "Online ordering", checklist: ["Customers can order cakes online"], price: 80 });
    expect(parseScope("ignore the rules", ITEMS)).toMatchObject({ verdict: "new", price: null });
  });
});

describe("scope requests", () => {
  async function setup() {
    const [c] = await db.insert(users).values({ email: `c-${randomUUID()}@x.test` }).returning();
    const [f] = await db.insert(users).values({ email: `f-${randomUUID()}@x.test` }).returning();
    const [j] = await db.insert(jobs).values({ clientId: c.id, freelancerId: f.id, freelancerEmail: f.email, title: "T", description: "Bakery site", currency: "USD", status: "accepted" }).returning();
    const [m] = await db.insert(milestones).values({ jobId: j.id, position: 0, title: "Site", amountMinor: 30000, state: "funded" }).returning();
    await db.insert(checklistItems).values(ITEMS.map((requirement, position) => ({ milestoneId: m.id, position, requirement })));
    return { c, f, j };
  }
  const newWork = vi.fn(async () => ({ verdict: "new" as const, reason: "Online ordering is a new feature.", item: null, title: "Online ordering", checklist: ["Customers can order cakes online"], price: 80 }));

  it("records the AI's answer for either side, with the agreed checklists as context", async () => {
    const { c, f, j } = await setup();
    const included = vi.fn(async () => ({ verdict: "included" as const, reason: "Already agreed.", item: ITEMS[0], title: null, checklist: [], price: null }));
    await askScope(j.id, f, "The client wants prices on the menu.", included);
    expect((included.mock.calls[0] as unknown[])[0]).toMatchObject({ milestones: [{ items: ITEMS }] });
    const r = await askScope(j.id, c, "Can customers order cakes online?", newWork);
    expect(r).toMatchObject({ askedBy: "client", verdict: "new", priceMinor: 8000 });
    await expect(askScope(j.id, c, "short", newWork)).rejects.toThrow(/at least 10/);
    await expect(askScope(j.id, { id: randomUUID(), email: "x@x.test" }, "Can customers order online?", newWork)).rejects.toThrow(/not allowed/i);
  });

  it("turns new work into a milestone the freelancer must accept before it can be funded", async () => {
    const { c, f, j } = await setup();
    const r = await askScope(j.id, c, "Can customers order cakes online?", newWork);
    await expect(proposeMilestone(r.id, f)).rejects.toThrow(/only the client/i);
    const m = await proposeMilestone(r.id, c);
    expect(m).toMatchObject({ position: 1, title: "Online ordering", amountMinor: 8000, pendingAcceptance: true, state: "draft" });
    expect((await db.select().from(checklistItems).where(eq(checklistItems.milestoneId, m.id)).orderBy(asc(checklistItems.position))).map((i) => i.requirement))
      .toEqual(["Customers can order cakes online"]);
    expect((await db.select().from(scopeRequests).where(eq(scopeRequests.id, r.id)))[0].milestoneId).toBe(m.id);
    await expect(proposeMilestone(r.id, c)).rejects.toThrow(/already proposed/);

    await expect(answerProposal(m.id, c, true)).rejects.toThrow(/not allowed/i);
    await answerProposal(m.id, f, true);
    expect((await db.select().from(milestones).where(eq(milestones.id, m.id)))[0].pendingAcceptance).toBe(false);
  });

  it("lets the freelancer decline proposed work", async () => {
    const { c, f, j } = await setup();
    const m = await proposeMilestone((await askScope(j.id, c, "Add a blog with weekly posts.", newWork)).id, c);
    await answerProposal(m.id, f, false);
    expect((await db.select().from(milestones).where(eq(milestones.id, m.id)))[0].state).toBe("cancelled");
  });
});
