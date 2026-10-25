"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setView(view: "client" | "freelancer") {
  (await cookies()).set("view", view, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}
