import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, replays, submissions, users, type User } from "@/db/schema";
import { seedMilestone } from "@/test/fixtures";

const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock("@/lib/session", () => session);
import { GET } from "./route";

const get = (id: string, range?: string) =>
  GET(new Request("http://x/api/replays/" + id, { headers: range ? { range } : {} }), { params: Promise.resolve({ id }) });

describe("GET /api/replays/[id]", () => {
  it("serves the recording to the job's parties only, with byte ranges", async () => {
    const m = await seedMilestone();
    const [job] = await db.select().from(jobs).where(eq(jobs.id, m.jobId));
    const [client] = await db.select().from(users).where(eq(users.id, job.clientId));
    const [s] = await db.insert(submissions).values({ milestoneId: m.id, url: "https://a.example" }).returning();
    await db.insert(replays).values({ submissionId: s.id, mp4: Buffer.from("0123456789") });

    session.currentUser.mockResolvedValue({ id: crypto.randomUUID(), email: "stranger@example.com", isAdmin: false } as User);
    expect((await get(s.id)).status).toBe(404);
    session.currentUser.mockResolvedValue(null);
    expect((await get(s.id)).status).toBe(404);

    session.currentUser.mockResolvedValue({ id: crypto.randomUUID(), email: "free@example.com", isAdmin: false } as User);
    expect(await (await get(s.id)).text()).toBe("0123456789");

    session.currentUser.mockResolvedValue(client);
    const part = await get(s.id, "bytes=2-4");
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(await part.text()).toBe("234");
    expect((await get(s.id, "bytes=-3")).headers.get("content-range")).toBe("bytes 7-9/10");
    expect((await get(s.id, "bytes=20-")).status).toBe(416);
    expect((await get("not-a-uuid")).status).toBe(404);
  });
});
