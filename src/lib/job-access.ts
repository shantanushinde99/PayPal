import { and, eq, isNull, or } from "drizzle-orm";
import { jobs } from "@/db/schema";

type JobParties = { clientId: string; freelancerId: string | null; freelancerEmail: string };
type Me = { id: string; email: string };

// The one rule for "whose job is this". An email only counts while the invite is unclaimed,
// so a linked job (e.g. a demo job paying out to a shared sandbox address) can't be reached by email.
export function jobRole(job: JobParties, user: Me): "client" | "freelancer" | null {
  if (job.clientId === user.id) return "client";
  if (job.freelancerId ? job.freelancerId === user.id : job.freelancerEmail === user.email) return "freelancer";
  return null;
}

export const myFreelanceWhere = (user: Me) =>
  or(eq(jobs.freelancerId, user.id), and(isNull(jobs.freelancerId), eq(jobs.freelancerEmail, user.email)));

export const myJobsWhere = (user: Me) => or(eq(jobs.clientId, user.id), myFreelanceWhere(user));
