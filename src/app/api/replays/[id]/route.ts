import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, milestones, replays, submissions } from "@/db/schema";
import { currentUser } from "@/lib/session";
import { jobRole } from "@/lib/job-access";

// The recording of a website check, for the job's two parties (and admins) only. id = submission id.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const [row] = user && /^[0-9a-f-]{36}$/.test(id)
    ? await db.select({ mp4: replays.mp4, j: jobs }).from(replays)
      .innerJoin(submissions, eq(submissions.id, replays.submissionId))
      .innerJoin(milestones, eq(milestones.id, submissions.milestoneId))
      .innerJoin(jobs, eq(jobs.id, milestones.jobId))
      .where(eq(replays.submissionId, id))
    : [];
  if (!user || !row || !(user.isAdmin || jobRole(row.j, user))) return new Response("Not found", { status: 404 });

  const headers = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  const size = row.mp4.length;
  // Safari only plays video served with byte ranges.
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (!m || (!m[1] && !m[2])) return new Response(new Uint8Array(row.mp4), { headers: { ...headers, "Content-Length": String(size) } });
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(new Uint8Array(row.mp4.subarray(start, end + 1)), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}
