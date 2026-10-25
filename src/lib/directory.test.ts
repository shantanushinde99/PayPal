import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { jobs, milestones, submissions, users } from "@/db/schema";
import { listFreelancers } from "./directory";

const tag = randomUUID().slice(0, 8);
const mk = async (patch = {}) => (await db.insert(users).values({ email: `u-${randomUUID()}@x.test`, roles: ["freelancer"], onboardedAt: new Date(), displayName: `F ${tag}`, headline: "Dev", ...patch }).returning())[0];

describe("listFreelancers", () => {
  it("shows real freelancers to real clients, demo freelancers only inside their own workspace", async () => {
    const group = randomUUID();
    const real = await mk(), notOnboarded = await mk({ onboardedAt: null }), clientOnly = await mk({ roles: ["client"] });
    const demoFree = await mk({ isDemo: true, demoGroup: group }), otherDemo = await mk({ isDemo: true, demoGroup: randomUUID() });
    const viewer = await mk({ roles: ["client"] });
    const demoViewer = await mk({ roles: ["client"], isDemo: true, demoGroup: group });
    const ids = async (v: typeof viewer) => (await listFreelancers(v, tag)).map((f) => f.id);
    expect(await ids(viewer)).toContain(real.id);
    for (const hidden of [notOnboarded, clientOnly, demoFree, otherDemo, viewer]) expect(await ids(viewer)).not.toContain(hidden.id);
    expect(await ids(demoViewer)).toEqual([demoFree.id]);
  });
  it("searches name, headline and skills", async () => {
    const f = await mk({ headline: `Shopify wizard ${tag}`, skills: ["Liquid", "SEO"] });
    const viewer = await mk({ roles: ["client"] });
    expect((await listFreelancers(viewer, `shopify wizard ${tag}`)).map((x) => x.id)).toEqual([f.id]);
    expect((await listFreelancers(viewer, "liquid")).map((x) => x.id)).toContain(f.id);
  });
  it("computes a track record from paid milestones", async () => {
    const f = await mk({ skills: [`rec-${tag}`] }), client = await mk({ roles: ["client"] });
    const [job] = await db.insert(jobs).values({ clientId: client.id, freelancerId: f.id, freelancerEmail: f.email, status: "accepted", title: "T", description: "d", currency: "USD" }).returning();
    const [m1] = await db.insert(milestones).values({ jobId: job.id, position: 0, title: "a", amountMinor: 100, state: "paid_out" }).returning();
    const [m2] = await db.insert(milestones).values({ jobId: job.id, position: 1, title: "b", amountMinor: 100, state: "paid_out" }).returning();
    await db.insert(submissions).values([{ milestoneId: m1.id, url: "https://a" }, { milestoneId: m2.id, url: "https://b" }, { milestoneId: m2.id, url: "https://b2" }]);
    const [row] = await listFreelancers(client, `rec-${tag}`);
    expect(row.trackRecord).toEqual({ paid: 2, firstTry: 50 });
  });
});
