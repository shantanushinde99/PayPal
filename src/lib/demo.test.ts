import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/env", async (orig) => ({ env: { ...(await orig<typeof import("@/lib/env")>()).env, DEMO_PAYOUT_EMAIL: "demo-free@sandbox.test" } }));
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobs, users } from "@/db/schema";
import { and, gt } from "drizzle-orm";
import { createDemoWorkspace, deleteOldDemos, demoAuthorize, signSwitch, verifySwitch } from "./demo";

// The sign-in rate limit counts demo users from the last minute; earlier runs shouldn't count.
beforeEach(async () => {
  await db.update(users).set({ createdAt: new Date(Date.now() - 120_000) })
    .where(and(eq(users.isDemo, true), gt(users.createdAt, new Date(Date.now() - 60_000))));
});

describe("demo workspaces", () => {
  it("creates an isolated, ready-to-use workspace", async () => {
    const ws = await createDemoWorkspace();
    const people = await db.select().from(users).where(eq(users.demoGroup, ws.group));
    expect(people.length).toBe(4);
    expect(people.every((u) => u.isDemo && u.onboardedAt && u.payoutEmail === "demo-free@sandbox.test")).toBe(true);
    const js = await db.select().from(jobs).where(eq(jobs.clientId, ws.clientId));
    expect(js.map((j) => j.status).sort()).toEqual(["accepted", "invited", "invited"]);
    expect(js.every((j) => j.freelancerId && people.some((p) => p.id === j.freelancerId))).toBe(true);
  });
  it("sign-in without a token always makes a brand-new demo user, never an existing one", async () => {
    const real = (await db.insert(users).values({ email: `real-${randomUUID()}@x.test` }).returning())[0];
    const a = await demoAuthorize({}), b = await demoAuthorize({ email: real.email, id: real.id });
    expect(a && b && a.id !== b.id && b.id !== real.id).toBe(true);
    const rows = await db.select().from(users).where(inArray(users.id, [a!.id, b!.id]));
    expect(rows.every((r) => r.isDemo)).toBe(true);
  });
  it("switches sides only with a valid, fresh token for the same workspace", async () => {
    const ws = await createDemoWorkspace(), other = await createDemoWorkspace();
    const good = signSwitch(ws.freelancerId, ws.group);
    expect((await demoAuthorize({ switch: good }))?.id).toBe(ws.freelancerId);
    expect(await verifySwitch(good.slice(0, -2) + (good.endsWith("AA") ? "BB" : "AA"))).toBeNull();
    expect(await verifySwitch(signSwitch(other.freelancerId, ws.group))).toBeNull();
    expect(await verifySwitch(signSwitch(ws.freelancerId, ws.group, -1))).toBeNull();
    expect(await demoAuthorize({ switch: "garbage" })).toBeNull();
  });
  it("cleans up only old demo workspaces", async () => {
    const old = await createDemoWorkspace(), fresh = await createDemoWorkspace();
    const real = (await db.insert(users).values({ email: `keep-${randomUUID()}@x.test`, createdAt: new Date(Date.now() - 9e9) }).returning())[0];
    await db.update(users).set({ createdAt: new Date(Date.now() - 49 * 3600_000) }).where(eq(users.demoGroup, old.group));
    await deleteOldDemos(48);
    expect(await db.select().from(users).where(eq(users.demoGroup, old.group))).toEqual([]);
    expect(await db.select().from(jobs).where(eq(jobs.clientId, old.clientId))).toEqual([]);
    expect((await db.select().from(users).where(eq(users.demoGroup, fresh.group))).length).toBe(4);
    expect((await db.select().from(users).where(eq(users.id, real.id))).length).toBe(1);
  });
});

describe("demo sign-in guards", () => {
  it("refuses when too many workspaces were just created", async () => {
    const { DEMO_RATE_LIMIT } = await import("./demo");
    const group = randomUUID();
    await db.insert(users).values(Array.from({ length: DEMO_RATE_LIMIT * 4 }, (_, i) => ({ email: `burst-${i}-${group}@demo.verifund.app`, isDemo: true, demoGroup: group })));
    expect(await demoAuthorize({})).toBeNull();
    await db.delete(users).where(eq(users.demoGroup, group));
  });
});
