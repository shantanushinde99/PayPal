import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, users } from "@/db/schema";
const pp = vi.hoisted(() => ({ createOrder: vi.fn(), authorizeOrder: vi.fn(), captureAuthorization: vi.fn(), voidAuthorization: vi.fn(), createPayout: vi.fn() }));
vi.mock("@/lib/paypal", () => pp);
import { acceptJob, declineJob, resetAcceptance } from "./invitations";
import { startFunding } from "./payments";

const mk = async (patch = {}) => (await db.insert(users).values({ email: `u-${randomUUID()}@x.test`, roles: ["freelancer"], onboardedAt: new Date(), ...patch }).returning())[0];
async function invitedJob(patch = {}) {
  const client = await mk({ roles: ["client"] });
  const free = await mk({ payoutEmail: "payout@sandbox.test" });
  const [job] = await db.insert(jobs).values({ clientId: client.id, freelancerId: free.id, freelancerEmail: free.email, title: "T", description: "d", currency: "USD", ...patch }).returning();
  const [m] = await db.insert(milestones).values({ jobId: job.id, position: 0, title: "M", amountMinor: 1000 }).returning();
  return { client, free, job, m };
}
const reload = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

beforeEach(() => { pp.createOrder.mockReset(); pp.createOrder.mockResolvedValue({ orderId: "O1", approveUrl: "https://pp/approve" }); });

describe("invitations", () => {
  it("accepting links the freelancer and snapshots their payout address", async () => {
    const { free, job } = await invitedJob();
    await acceptJob(job.id, free);
    expect(await reload(job.id)).toMatchObject({ status: "accepted", freelancerId: free.id, freelancerEmail: "payout@sandbox.test" });
  });
  it("lets an email invitee claim the job with their own account", async () => {
    const newbie = await mk();
    const { job } = await invitedJob({ freelancerId: null, freelancerEmail: newbie.email });
    await expect(acceptJob(job.id, await mk())).rejects.toThrow(/not your invitation/i);
    await acceptJob(job.id, newbie);
    expect(await reload(job.id)).toMatchObject({ status: "accepted", freelancerId: newbie.id, freelancerEmail: newbie.email });
  });
  it("only the invited freelancer can answer, and only once", async () => {
    const { client, free, job } = await invitedJob();
    const stranger = await mk();
    await expect(acceptJob(job.id, stranger)).rejects.toThrow(/not your invitation/i);
    await expect(acceptJob(job.id, client)).rejects.toThrow(/not your invitation/i);
    await declineJob(job.id, free, "Too busy this month");
    expect(await reload(job.id)).toMatchObject({ status: "declined", declineNote: "Too busy this month" });
    await expect(acceptJob(job.id, free)).rejects.toThrow(/already/i);
  });
  it("blocks funding until the freelancer accepts", async () => {
    const { free, job, m } = await invitedJob();
    await expect(startFunding(m.id)).rejects.toThrow(/hasn't accepted/);
    expect(pp.createOrder).not.toHaveBeenCalled();
    await acceptJob(job.id, free);
    await expect(startFunding(m.id)).resolves.toMatchObject({ approveUrl: "https://pp/approve" });
  });
  it("an edit after acceptance needs a fresh acceptance", async () => {
    const { free, job, m } = await invitedJob();
    await acceptJob(job.id, free);
    await resetAcceptance(job.id);
    expect((await reload(job.id)).status).toBe("invited");
    await expect(startFunding(m.id)).rejects.toThrow(/hasn't accepted/);
  });
});

import { resolveHire } from "./invitations";

describe("resolveHire", () => {
  it("hires an onboarded freelancer from the directory", async () => {
    const client = await mk({ roles: ["client"] }), free = await mk({ payoutEmail: "p@sandbox.test" });
    expect(await resolveHire(client, { freelancerId: free.id })).toEqual({ freelancerId: free.id, freelancerEmail: "p@sandbox.test" });
  });
  it("invites by email", async () => {
    const client = await mk({ roles: ["client"] });
    expect(await resolveHire(client, { email: "  New@X.test " })).toEqual({ freelancerId: null, freelancerEmail: "new@x.test" });
  });
  it("refuses self-hire, non-freelancers and crossing the demo boundary", async () => {
    const client = await mk({ roles: ["client", "freelancer"] });
    await expect(resolveHire(client, { freelancerId: client.id })).rejects.toThrow(/yourself/);
    await expect(resolveHire(client, { email: client.email })).rejects.toThrow(/yourself/);
    const notFree = await mk({ roles: ["client"] });
    await expect(resolveHire(client, { freelancerId: notFree.id })).rejects.toThrow(/freelancer/);
    const demo = await mk({ isDemo: true, demoGroup: randomUUID() });
    await expect(resolveHire(client, { freelancerId: demo.id })).rejects.toThrow(/freelancer/);
    const demoClient = await mk({ roles: ["client"], isDemo: true, demoGroup: randomUUID() });
    await expect(resolveHire(demoClient, { email: "real@x.test" })).rejects.toThrow(/demo/i);
    await expect(resolveHire(client, {})).rejects.toThrow(/choose/i);
  });
});

describe("money already held", () => {
  it("editing a draft milestone doesn't reopen a job that already has funded work", async () => {
    const { free, job } = await invitedJob();
    await acceptJob(job.id, free);
    await db.insert(milestones).values({ jobId: job.id, position: 1, title: "M2", amountMinor: 500, state: "funded", authorizationId: "A" });
    await resetAcceptance(job.id);
    expect((await reload(job.id)).status).toBe("accepted");
  });
  it("a freelancer can't decline once money is held", async () => {
    const { free, job } = await invitedJob();
    await db.insert(milestones).values({ jobId: job.id, position: 1, title: "M2", amountMinor: 500, state: "funded", authorizationId: "A" });
    await expect(declineJob(job.id, free, "")).rejects.toThrow(/already funded/i);
  });
  it("demo login addresses can't be invited by email", async () => {
    const client = await mk({ roles: ["client"] });
    await expect(resolveHire(client, { email: "priya.123@demo.verifund.app" })).rejects.toThrow(/demo/i);
  });
});
