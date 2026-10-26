import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, payments, users } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";
import { loadInsights } from "./insights";

describe("loadInsights", () => {
  it("shows a user only their own jobs, and an admin everything", async () => {
    const m = await seedMilestone({ state: "paid_out", capturedMinor: 600 });
    const [job] = await db.select().from(jobs).where(eq(jobs.id, m.jobId));
    await db.insert(payments).values([
      { milestoneId: m.id, kind: "hold", amountMinor: 1000, currency: "USD", paypalId: "H", createdAt: new Date("2026-10-01T00:00:00Z") },
      { milestoneId: m.id, kind: "paid", amountMinor: 600, currency: "USD", paypalId: "P", createdAt: new Date("2026-10-03T12:00:00Z") },
    ]);
    const [client] = await db.select().from(users).where(eq(users.id, job.clientId));

    const mine = await loadInsights(client);
    expect(mine.milestones).toHaveLength(1);
    expect(mine.milestones[0]).toMatchObject({ amount: 10, paid: 6, daysToPaid: 2.5, myRole: "client", state: "paid_out" });
    expect(mine.payments.map((p) => p.kind).sort()).toEqual(["hold", "paid"]);

    const stranger = await loadInsights({ id: randomUUID(), email: `x-${randomUUID()}@example.com`, isAdmin: false });
    expect(stranger.milestones).toEqual([]);

    const admin = await loadInsights({ id: randomUUID(), email: "admin@example.com", isAdmin: true });
    expect(admin.milestones.some((x) => x.myRole === "admin")).toBe(true);
  });
});
