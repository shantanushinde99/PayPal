import { requireUser } from "@/lib/session";
import { createJob } from "../actions";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

export default async function NewJob() {
  await requireUser();
  return (
    <main className="mx-auto max-w-xl p-8 space-y-4">
      <h1 className="text-2xl font-bold">Post a job</h1>
      <form action={createJob} className="space-y-4">
        <textarea name="description" required rows={6} className="w-full rounded border p-2"
          placeholder="Build a landing page for my bakery with a menu, opening hours and a contact form." />
        <input name="freelancerEmail" type="email" required className="w-full rounded border p-2" placeholder="Freelancer's PayPal email" />
        <div className="flex gap-2">
          <input name="budget" type="number" min="1" step="0.01" required className="flex-1 rounded border p-2" placeholder="Total budget" />
          <select name="currency" className="rounded border p-2">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <button className="rounded bg-black px-4 py-2 text-white">Let AI draft milestones</button>
      </form>
    </main>
  );
}
