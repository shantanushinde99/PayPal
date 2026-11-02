import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, payments, submissions, users } from "@/db/schema";

const pp = vi.hoisted(() => ({ createOrder: vi.fn(), authorizeOrder: vi.fn(), captureAuthorization: vi.fn(), voidAuthorization: vi.fn(), createPayout: vi.fn() }));
vi.mock("@/lib/paypal", () => pp);
import { release } from "./payments";
import { checkPages, sweepWarranties } from "./warranty";

beforeEach(() => { Object.values(pp).forEach((f) => f.mockReset()); pp.captureAuthorization.mockResolvedValue("CAP"); });

async function setup(url = "https://bakery.test/", percent = 25) {
  const [c] = await db.insert(users).values({ email: `c-${randomUUID()}@x.test` }).returning();
  const [j] = await db.insert(jobs).values({ clientId: c.id, freelancerEmail: "f@x.test", title: "T", description: "d", currency: "USD", status: "accepted", warrantyPercent: percent }).returning();
  const [m] = await db.insert(milestones).values({ jobId: j.id, position: 0, title: "Site", amountMinor: 1000, state: "passed", authorizationId: "AUTH", direct: true, proofType: "website" }).returning();
  await db.insert(submissions).values({ milestoneId: m.id, url, report: { pages: [{ url, status: 200, offsite: false }] } });
  return m;
}
const ms = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0];
const kinds = async (id: string) => (await db.select().from(payments).where(eq(payments.milestoneId, id))).map((p) => `${p.kind}:${p.amountMinor}`).sort();
const site = (status: number) => vi.fn(async () => new Response("", { status })) as unknown as typeof fetch;

describe("warranty", () => {
  it("captures 75% at release and keeps 25% authorized while the site is monitored", async () => {
    const m = await setup();
    await release(m.id);
    expect(pp.captureAuthorization).toHaveBeenCalledWith("AUTH", m.id, { amountMinor: 750, currency: "USD", final: false, tag: "main" });
    expect(await ms(m.id)).toMatchObject({ state: "paid_out", capturedMinor: 750, warrantyMinor: 250, warrantyStatus: "holding" });
    expect(await kinds(m.id)).toEqual(["paid:750"]);
  });

  it("doesn't apply to code repositories or jobs without a warranty", async () => {
    for (const m of [await setup("https://github.com/me/app"), await setup("https://bakery.test/", 0)]) {
      pp.captureAuthorization.mockClear();
      await release(m.id);
      expect(pp.captureAuthorization).toHaveBeenCalledWith("AUTH", m.id);
      expect(await ms(m.id)).toMatchObject({ capturedMinor: 1000, warrantyStatus: null });
    }
  });

  it("pays the rest when the warranty ends with the site working", async () => {
    const m = await setup();
    await release(m.id);
    await db.update(milestones).set({ warrantyUntil: new Date(Date.now() - 1000), warrantyCheckedAt: new Date(Date.now() - 120_000) }).where(eq(milestones.id, m.id));
    pp.captureAuthorization.mockResolvedValueOnce("CAP2");
    await sweepWarranties(site(200));
    expect(pp.captureAuthorization).toHaveBeenLastCalledWith("AUTH", m.id, { amountMinor: 250, currency: "USD", final: true, tag: "warranty" });
    expect(await ms(m.id)).toMatchObject({ warrantyStatus: "released", capturedMinor: 1000, warrantyIssue: null });
    expect(await kinds(m.id)).toEqual(["paid:250", "paid:750"]);
  });

  it("returns the rest to the client when a page is still broken at the end", async () => {
    const m = await setup();
    await release(m.id);
    await db.update(milestones).set({ warrantyUntil: new Date(Date.now() - 1000), warrantyCheckedAt: new Date(Date.now() - 120_000) }).where(eq(milestones.id, m.id));
    await sweepWarranties(site(404));
    expect(pp.voidAuthorization).toHaveBeenCalledWith("AUTH");
    expect(await ms(m.id)).toMatchObject({ warrantyStatus: "returned", capturedMinor: 750, warrantyIssue: "/ returns 404" });
  });

  it("keeps holding, and lets a fix count, while the warranty runs", async () => {
    const m = await setup();
    await release(m.id);
    await db.update(milestones).set({ warrantyCheckedAt: new Date(Date.now() - 2 * 86400_000) }).where(eq(milestones.id, m.id));
    await sweepWarranties(site(500));
    expect(await ms(m.id)).toMatchObject({ warrantyStatus: "holding", warrantyIssue: "/ returns 500" });
    await db.update(milestones).set({ warrantyCheckedAt: new Date(Date.now() - 2 * 86400_000) }).where(eq(milestones.id, m.id));
    await sweepWarranties(site(200));
    expect(await ms(m.id)).toMatchObject({ warrantyStatus: "holding", warrantyIssue: null });
    expect(pp.voidAuthorization).not.toHaveBeenCalled();
  });

  it("names broken pages", async () => {
    const f = vi.fn(async (u: string) => new Response("", { status: u.endsWith("/menu") ? 404 : 200 })) as unknown as typeof fetch;
    expect(await checkPages(["https://b.test/", "https://b.test/menu"], f)).toBe("/menu returns 404");
    expect(await checkPages(["https://b.test/"], vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch)).toBe("/ doesn't respond");
  });
});
