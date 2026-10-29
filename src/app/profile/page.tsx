import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { Header } from "@/components/header";
import { ProfileForm } from "@/components/profile-form";
import { ownershipCode } from "@/lib/ownership";

export default async function Profile({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const saved = (await searchParams).saved;
  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Your profile</h1>
          <p className="text-ink-soft">Payments go to <b>{user.payoutEmail ?? user.email}</b>, verified by PayPal.</p>
        </div>
        {saved && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 aria-hidden className="size-4" /> Profile saved</p>}
        {user.isDemo ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This is a demo account; its profile is fixed.</p> : <ProfileForm user={user} submitLabel="Save profile" ownershipCode={ownershipCode(user.id)} />}
      </main>
    </>
  );
}
