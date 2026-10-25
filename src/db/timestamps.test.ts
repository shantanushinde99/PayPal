import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";

describe("timestamps", () => {
  it("reads back database-generated times as the real moment, whatever the DB timezone", async () => {
    const m = await seedMilestone();
    const [e] = await db.insert(events).values({ milestoneId: m.id, kind: "state", message: "t" }).returning();
    const [back] = await db.select().from(events).where(eq(events.id, e.id));
    expect(Math.abs(back.createdAt.getTime() - Date.now())).toBeLessThan(60_000);
  });
});
