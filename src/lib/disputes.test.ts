import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { disputes, jobs, milestones, users } from "@/db/schema";

const pp = vi.hoisted(() => ({ createOrder: vi.fn(), authorizeOrder: vi.fn(), captureAuthorization: vi.fn(), voidAuthorization: vi.fn(), createPayout: vi.fn() }));
vi.mock("@/lib/paypal", () => pp);
vi.mock("@/lib/gemini", () => ({ generate: vi.fn() }));
import { acceptDecision, askJudge, openDispute, parseJudgeDecision, rejectDecision, resolveByAdmin, respondDispute, settleDueDisputes } from "./disputes";

const mk = async (patch = {}) => (await db.insert(users).values({ email: `u-${randomUUID()}@x.test`, onboardedAt: new Date(), ...patch }).returning())[0];
async function setup(state: string, patch = {}) {
  const client = await mk({ roles: ["client"] }), free = await mk({ roles: ["freelancer"] });
  const [job] = await db.insert(jobs).values({ clientId: client.id, freelancerId: free.id, freelancerEmail: free.email, status: "accepted", title: "T", description: "d", currency: "USD" }).returning();
  const [m] = await db.insert(milestones).values({ jobId: job.id, position: 0, title: "M", amountMinor: 1000, state, authorizationId: "AUTH", direct: true, ...patch }).returning();
  return { client, free, job, m };
}
const ms = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0];
const dp = async (id: string) => (await db.select().from(disputes).where(eq(disputes.milestoneId, id)))[0];
const STATEMENT = "The contact form does not send anything, I tested it twice.";
const judge = (share: number) => vi.fn(async () => ({ share, reasoning: "Form works but is unstyled." }));

beforeEach(() => { Object.values(pp).forEach((f) => f.mockReset()); pp.captureAuthorization.mockResolvedValue("CAP"); });

describe("parseJudgeDecision", () => {
  it("accepts a whole 0-100 share with reasoning", () => {
    expect(parseJudgeDecision({ freelancerShare: 80, reasoning: " ok " })).toEqual({ share: 80, reasoning: "ok" });
    expect(parseJudgeDecision({ freelancerShare: 79.6, reasoning: "x" }).share).toBe(80);
  });
  it("fails closed on junk", () => {
    for (const bad of [{ freelancerShare: 150, reasoning: "x" }, { freelancerShare: -1, reasoning: "x" }, { freelancerShare: "all", reasoning: "x" }, { freelancerShare: 50 }, null])
      expect(() => parseJudgeDecision(bad)).toThrow();
  });
});

describe("opening a dispute", () => {
  it("lets the client dispute an AI pass during the review window", async () => {
    const { client, m } = await setup("passed", { releaseAt: new Date(Date.now() + 3600_000) });
    await openDispute(m.id, client, STATEMENT);
    expect((await ms(m.id)).state).toBe("disputed");
    expect(await dp(m.id)).toMatchObject({ openedBy: "client", clientStatement: STATEMENT, status: "open" });
  });
  it("lets the freelancer dispute an AI fail", async () => {
    const { free, m } = await setup("failed");
    await openDispute(m.id, free, STATEMENT);
    expect(await dp(m.id)).toMatchObject({ openedBy: "freelancer", freelancerStatement: STATEMENT });
  });
  it("refuses the wrong party, a closed window, strangers and empty statements", async () => {
    const a = await setup("passed", { releaseAt: new Date(Date.now() + 3600_000) });
    await expect(openDispute(a.m.id, a.free, STATEMENT)).rejects.toThrow();
    await expect(openDispute(a.m.id, await mk(), STATEMENT)).rejects.toThrow();
    await expect(openDispute(a.m.id, a.client, "bad")).rejects.toThrow(/explain/i);
    const b = await setup("passed", { releaseAt: new Date(Date.now() - 1000) });
    await expect(openDispute(b.m.id, b.client, STATEMENT)).rejects.toThrow(/window/i);
    const c = await setup("failed");
    await expect(openDispute(c.m.id, c.client, STATEMENT)).rejects.toThrow();
  });
});

describe("judging and settling", () => {
  it("lets the other side respond, then the AI Judge proposes a share", async () => {
    const { client, free, m } = await setup("passed", { releaseAt: new Date(Date.now() + 3600_000) });
    await openDispute(m.id, client, STATEMENT);
    await respondDispute(m.id, free, "It sends to the bakery inbox; screenshot attached on /contact.");
    await askJudge(m.id, client, judge(70));
    expect(await dp(m.id)).toMatchObject({ status: "judged", judgeShare: 70, freelancerStatement: expect.stringContaining("bakery") });
    expect(pp.captureAuthorization).not.toHaveBeenCalled();
  });
  it("settles the split when both sides accept", async () => {
    const { client, free, m } = await setup("failed");
    await openDispute(m.id, free, STATEMENT);
    await askJudge(m.id, free, judge(60));
    await acceptDecision(m.id, client);
    expect((await ms(m.id)).state).toBe("disputed");
    await acceptDecision(m.id, free);
    expect(await ms(m.id)).toMatchObject({ state: "paid_out", capturedMinor: 600 });
    expect(await dp(m.id)).toMatchObject({ status: "resolved", finalShare: 60 });
  });
  it("settles automatically when nobody rejects before the deadline", async () => {
    const { free, m } = await setup("failed");
    await openDispute(m.id, free, STATEMENT);
    await askJudge(m.id, free, judge(0));
    await db.update(disputes).set({ decideAt: new Date(Date.now() - 1000) }).where(eq(disputes.milestoneId, m.id));
    await settleDueDisputes();
    expect((await ms(m.id)).state).toBe("cancelled");
    expect(pp.voidAuthorization).toHaveBeenCalledWith("AUTH");
  });
  it("escalates on rejection; only an admin can then decide", async () => {
    const { client, free, m } = await setup("failed");
    await openDispute(m.id, free, STATEMENT);
    await askJudge(m.id, free, judge(20));
    await rejectDecision(m.id, free);
    expect((await dp(m.id)).status).toBe("escalated");
    await expect(acceptDecision(m.id, client)).rejects.toThrow();
    await expect(resolveByAdmin(m.id, client, 50, "split")).rejects.toThrow(/admin/i);
    await resolveByAdmin(m.id, await mk({ isAdmin: true }), 50, "Both partly right.");
    expect(await ms(m.id)).toMatchObject({ state: "paid_out", capturedMinor: 500 });
    expect(await dp(m.id)).toMatchObject({ status: "resolved", finalShare: 50, adminNote: "Both partly right." });
  });
  it("keeps the dispute open when the AI Judge fails", async () => {
    const { free, m } = await setup("failed");
    await openDispute(m.id, free, STATEMENT);
    await expect(askJudge(m.id, free, vi.fn(async () => { throw new Error("503 UNAVAILABLE"); }))).rejects.toThrow(/busy/i);
    expect((await dp(m.id)).status).toBe("open");
  });
});
