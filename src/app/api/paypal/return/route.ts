import { NextResponse, type NextRequest } from "next/server";
import { completeFunding } from "@/lib/payments";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const milestoneId = req.nextUrl.searchParams.get("milestone");
  const orderId = req.nextUrl.searchParams.get("token"); // PayPal sends the order id as ?token=
  if (!milestoneId || !orderId) return NextResponse.redirect(env.APP_URL);
  const jobId = await completeFunding(milestoneId, orderId);
  return NextResponse.redirect(`${env.APP_URL}/jobs/${jobId}`);
}
