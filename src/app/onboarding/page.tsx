import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/session";
import { Logo } from "@/components/header";
import { ProfileForm } from "@/components/profile-form";
import { ownershipCode } from "@/lib/ownership";

export default async function Onboarding() {
  const user = await requireUser({ onboarded: false });
  if (user.onboardedAt) redirect("/");
  return (
    <>
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center px-4"><Logo /></header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800"><ShieldCheck aria-hidden className="size-4" /> Signed in with PayPal as {user.email}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Welcome to Verifund</h1>
          <p className="text-ink-soft">Tell us how you&apos;ll use it. Payments always go to your verified PayPal email.</p>
        </div>
        <ProfileForm user={user} submitLabel="Finish setup" ownershipCode={ownershipCode(user.id)} />
      </main>
    </>
  );
}
