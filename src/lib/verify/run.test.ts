import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, submissions } from "@/db/schema";
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
    expect(after.failReason).toMatch(/could not finish/i);
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
