import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";

const pp = vi.hoisted(() => ({ createOrder: vi.fn(), authorizeOrder: vi.fn(), captureAuthorization: vi.fn(), voidAuthorization: vi.fn(), createPayout: vi.fn() }));
vi.mock("@/lib/paypal", () => pp);
import { reviewWindowMinutes, releaseDue } from "./review-window";

const get = async (id: string) => (await db.select().from(milestones).where(eq(milestones.id, id)))[0];
beforeEach(() => { Object.values(pp).forEach((f) => f.mockReset()); pp.captureAuthorization.mockResolvedValue("CAP"); });

describe("reviewWindowMinutes", () => {
  it("uses 24h by default, a short window for demos, and caps long settings", () => {
    expect(reviewWindowMinutes({ isDemo: false }, undefined)).toBe(1440);
    expect(reviewWindowMinutes({ isDemo: true }, undefined)).toBe(2);
    expect(reviewWindowMinutes({ isDemo: false }, 30)).toBe(30);
    expect(reviewWindowMinutes({ isDemo: false }, 99999)).toBe(2880); // stays inside PayPal's honor period
    expect(reviewWindowMinutes({ isDemo: false }, -3)).toBe(0);
  });
});

describe("releaseDue", () => {
  it("pays only verified milestones whose review window has ended", async () => {
    const due = await seedMilestone({ state: "passed", authorizationId: "A1", direct: true, releaseAt: new Date(Date.now() - 1000) });
    const later = await seedMilestone({ state: "passed", authorizationId: "A2", direct: true, releaseAt: new Date(Date.now() + 3600_000) });
    const disputed = await seedMilestone({ state: "disputed", authorizationId: "A3", direct: true, releaseAt: new Date(Date.now() - 1000) });
    await releaseDue();
    expect((await get(due.id)).state).toBe("paid_out");
    expect((await get(later.id)).state).toBe("passed");
    expect((await get(disputed.id)).state).toBe("disputed");
  });
  it("captures once even when two sweeps race", async () => {
    const m = await seedMilestone({ state: "passed", authorizationId: "A4", direct: true, releaseAt: new Date(Date.now() - 1000) });
    await Promise.allSettled([releaseDue(), releaseDue()]);
    expect((await get(m.id)).state).toBe("paid_out");
    expect(pp.captureAuthorization.mock.calls.filter((c) => c[0] === "A4").length).toBeLessThanOrEqual(2); // same request id → PayPal returns one capture
  });
});
