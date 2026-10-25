import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/session";
import { CURRENCIES } from "@/lib/money";
import { Header } from "@/components/header";
import { Card, btn, field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createJob } from "../actions";

export default async function NewJob() {
  const user = await requireUser();
  return (
    <>
      <Header email={user.email} />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"><ArrowLeft aria-hidden className="size-4" /> Dashboard</Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Post a job</h1>
          <p className="text-ink-soft">Describe the work in plain words. AI splits it into milestones with a checklist you can edit before paying.</p>
        </div>
        <Card className="p-6">
          <form action={createJob} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="description" className="text-sm font-semibold">What needs to be done?</label>
              <textarea id="description" name="description" required rows={5} className={field}
                placeholder="Build a landing page for my bakery with a menu, opening hours and a contact form." />
              <p className="text-sm text-ink-soft">Websites are checked live by an AI browser; physical jobs (painting, repairs) with before/after photos.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="freelancerEmail" className="text-sm font-semibold">Freelancer&apos;s PayPal email</label>
              <input id="freelancerEmail" name="freelancerEmail" type="email" required autoComplete="off" className={field} placeholder="freelancer@example.com" />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <label htmlFor="budget" className="text-sm font-semibold">Total budget</label>
                <input id="budget" name="budget" type="number" min="1" step="0.01" required inputMode="decimal" className={field} placeholder="300" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="currency" className="text-sm font-semibold">Currency</label>
                <select id="currency" name="currency" className={field}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
            </div>
            <SubmitButton className={`${btn.primary} w-full`} pending="AI is drafting milestones…">
              <Sparkles aria-hidden className="size-4" /> Draft milestones with AI
            </SubmitButton>
          </form>
        </Card>
      </main>
    </>
  );
}
