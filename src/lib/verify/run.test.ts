import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, milestones, submissions } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";

const checkers = vi.hoisted(() => ({ checkWebsite: vi.fn(), checkPhotos: vi.fn() }));
vi.mock("@/lib/verify/website", () => ({ checkWebsite: checkers.checkWebsite }));
vi.mock("@/lib/verify/photo", () => ({ checkPhotos: checkers.checkPhotos }));
vi.mock("@/lib/paypal", () => ({}));
import { runVerification, failInterruptedChecks } from "./run";

const get = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0];

describe("runVerification", () => {
  it("never leaves a milestone stuck in verifying when something unexpected throws", async () => {
    const m = await seedMilestone({ state: "verifying" });
    await runVerification(m.id, randomUUID()); // submission does not exist
    const after = await get(m.id);
    expect(after.state).toBe("failed");
    expect(after.failReason).toMatch(/money is safe/i);
    expect(after.failReason).not.toMatch(/submission not found/);
  });
});

describe("failInterruptedChecks", () => {
  it("fails checks that were running when the server restarted", async () => {
    const m = await seedMilestone({ state: "verifying" });
    await failInterruptedChecks();
    expect((await get(m.id)).state).toBe("failed");
  });
});

describe("runVerification picks the checker by proof type", () => {
  it("uses the photo checker for photo milestones", async () => {
    const m = await seedMilestone({ state: "verifying", proofType: "photo" });
    const jpeg = "data:image/jpeg;base64,AAAA";
    const [sub] = await db.insert(submissions).values({ milestoneId: m.id, beforePhoto: jpeg, afterPhoto: jpeg }).returning();
    checkers.checkPhotos.mockResolvedValue([]);
    await runVerification(m.id, sub.id);
    expect(checkers.checkPhotos).toHaveBeenCalled();
    expect(checkers.checkWebsite).not.toHaveBeenCalled();
  });
});

describe("runVerification when the AI is busy", () => {
  it("tells the freelancer the AI is busy instead of blaming the checklist", async () => {
    const m = await seedMilestone({ state: "verifying", proofType: "photo" });
    const jpeg = "data:image/jpeg;base64,AAAA";
    const [sub] = await db.insert(submissions).values({ milestoneId: m.id, beforePhoto: jpeg, afterPhoto: jpeg }).returning();
    checkers.checkPhotos.mockRejectedValue(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'));
    await runVerification(m.id, sub.id);
    const after = await get(m.id);
    expect(after.state).toBe("failed");
    expect(after.failReason).toMatch(/AI reviewer is busy/);
  });
});

describe("an AI pass opens the review window instead of paying", () => {
  it("moves to passed with a release time and does not capture", async () => {
    const m = await seedMilestone({ state: "verifying", authorizationId: "A9", direct: true });
    const [sub] = await db.insert(submissions).values({ milestoneId: m.id, url: "https://site.test/" }).returning();
    const items = await db.select().from(checklistItems).where(eq(checklistItems.milestoneId, m.id));
    checkers.checkWebsite.mockResolvedValue({ verdict: items.map((c) => ({ checklistItemId: c.id, status: "pass", reason: "ok" })), report: { pages: [] } });
    await runVerification(m.id, sub.id);
    const after = await get(m.id);
    expect(after.state).toBe("passed");
    expect(after.releaseAt!.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });
});
