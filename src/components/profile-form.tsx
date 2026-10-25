"use client";
import { useActionState, useState } from "react";
import { Briefcase, Check, Code2, Users } from "lucide-react";
import { saveProfile, type ProfileState } from "@/app/profile/actions";
import { SubmitButton } from "@/components/submit-button";
import { btn, field } from "@/components/ui";
import type { User } from "@/db/schema";

const CHOICES = [
  { key: "client", value: ["client"], title: "I'm hiring", text: "Post jobs, hold payments with PayPal, pay when work is verified.", Icon: Briefcase },
  { key: "freelancer", value: ["freelancer"], title: "I'm a freelancer", text: "Get hired, see the money is funded, get paid the moment it's verified.", Icon: Code2 },
  { key: "both", value: ["client", "freelancer"], title: "Both", text: "Hire for some jobs and take on others. Switch views any time.", Icon: Users },
] as const;

export function ProfileForm({ user, submitLabel }: { user: User; submitLabel: string }) {
  const [roles, setRoles] = useState<string[]>(user.roles.length ? user.roles : ["client"]);
  const [state, action] = useActionState<ProfileState, FormData>(saveProfile, {});
  const isClient = roles.includes("client"), isFreelancer = roles.includes("freelancer");
  const key = roles.join("+");

  return (
    <form action={action} className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-lg font-semibold">How will you use Verifund?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {CHOICES.map((c) => {
            const on = c.value.join("+") === key;
            return (
              <label key={c.title} className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-colors ${on ? "border-brand bg-brand-soft/40" : "border-line bg-white hover:border-brand/40"}`}>
                <input type="radio" name="roleChoice" value={c.key} className="sr-only" checked={on} onChange={() => setRoles([...c.value])} />
                {on && <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-brand text-white"><Check aria-hidden className="size-4" /></span>}
                <c.Icon aria-hidden className="mb-3 size-7 text-brand" />
                <p className="font-semibold">{c.title}</p>
                <p className="text-sm text-ink-soft">{c.text}</p>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold">Your name<input name="displayName" required minLength={2} maxLength={60} defaultValue={user.displayName ?? user.name ?? ""} className={field} /></label>
        {isClient && <label className="space-y-1.5 text-sm font-semibold">Company <span className="font-normal text-ink-soft">(optional)</span><input name="company" maxLength={80} defaultValue={user.company ?? ""} className={field} placeholder="Sunrise Bakery" /></label>}
      </div>

      {isFreelancer && (
        <section className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Your freelancer profile</h2>
          <p className="-mt-3 text-sm text-ink-soft">Clients see this in the freelancer directory.</p>
          <label className="block space-y-1.5 text-sm font-semibold">Headline<input name="headline" required maxLength={80} defaultValue={user.headline ?? ""} className={field} placeholder="Web developer · Next.js & Shopify" /></label>
          <label className="block space-y-1.5 text-sm font-semibold">Skills <span className="font-normal text-ink-soft">(comma separated, up to 10)</span><input name="skills" defaultValue={user.skills.join(", ")} className={field} placeholder="React, Tailwind, SEO" /></label>
          <label className="block space-y-1.5 text-sm font-semibold">Short bio<textarea name="bio" rows={4} maxLength={600} defaultValue={user.bio ?? ""} className={field} placeholder="What you do and who you do it for." /></label>
          <label className="block space-y-1.5 text-sm font-semibold">Portfolio link <span className="font-normal text-ink-soft">(optional)</span><input name="portfolioUrl" type="url" defaultValue={user.portfolioUrl ?? ""} className={field} placeholder="https://you.dev" /></label>
        </section>
      )}

      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">{state.error}</p>}
      <SubmitButton className={`${btn.primary} w-full sm:w-auto`} pending="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
