import { cookies } from "next/headers";
import type { User } from "@/db/schema";

export type View = "client" | "freelancer";

// Which side a user is looking at. Single-role users always see their role.
export async function currentView(user: Pick<User, "roles">): Promise<View> {
  if (user.roles.length === 1) return user.roles[0] as View;
  const v = (await cookies()).get("view")?.value;
  return v === "freelancer" ? "freelancer" : "client";
}
