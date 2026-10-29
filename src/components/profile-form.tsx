"use client";
import { useActionState, useState } from "react";
import { Briefcase, Check, Code2, Lock, Sparkles } from "lucide-react";
import { saveProfile, type ImportState, type ProfileState } from "@/app/profile/actions";
import { PortfolioOwnership, ProfileImport } from "@/components/profile-import";
import type { DraftField } from "@/lib/profile-import";
import { SubmitButton } from "@/components/submit-button";
import { btn, field } from "@/components/ui";
import type { User } from "@/db/schema";

const CHOICES = [
  { key: "client", value: ["client"], title: "I'm hiring", text: "Post jobs, hold payments with PayPal, pay when work is verified.", Icon: Briefcase },
  { key: "freelancer", value: ["freelancer"], title: "I'm a freelancer", text: "Get hired, see the money is funded, get paid the moment it's verified.", Icon: Code2 },
] as const;

export function ProfileForm({ user, submitLabel, ownershipCode }: { user: User; submitLabel: string; ownershipCode: string }) {
  const locked = !!user.onboardedAt && user.roles.length > 0;
  const [roles, setRoles] = useState<string[]>(user.roles.length ? user.roles.slice(0, 1) : ["client"]);
  const [state, action] = useActionState<ProfileState, FormData>(saveProfile, {});
  const isClient = roles.includes("client"), isFreelancer = roles.includes("freelancer");
  const key = roles.join("+");
  // Field values: the saved profile, replaced by an imported draft (fields re-mount with it; the user edits, then saves).
  const [imported, setImported] = useState<ImportState | null>(null);
  const [v, setV] = useState({ displayName: user.displayName ?? user.name ?? "", company: user.company ?? "", headline: user.headline ?? "", skills: user.skills.join(", "), bio: user.bio ?? "", portfolioUrl: user.portfolioUrl ?? "" });
  const [version, setVersion] = useState(0);
  const onDraft = (r: ImportState) => {
    const d = r.draft;
    setV((old) => ({
      displayName: d.displayName || old.displayName, company: d.company || old.company, headline: d.headline || old.headline,
      skills: d.skills.length ? d.skills.join(", ") : old.skills, bio: d.bio || old.bio, portfolioUrl: isFreelancer ? r.url : old.portfolioUrl,
    }));
    setImported(r); setVersion((n) => n + 1);
  };
  const from = (k: DraftField) => imported?.sources[k] && <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand"><Sparkles aria-hidden className="size-3" /> from {imported.sources[k] === "/" ? "your homepage" : imported.sources[k]}</span>;

  return (
    <form action={action} className="space-y-8">
      {locked ? (
        // The role is set once, at sign-up: an account is either a client or a freelancer.
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-white p-5">
          <input type="hidden" name="roleChoice" value={roles[0]} />
          {roles[0] === "freelancer" ? <Code2 aria-hidden className="mt-0.5 size-6 shrink-0 text-brand" /> : <Briefcase aria-hidden className="mt-0.5 size-6 shrink-0 text-brand" />}
          <div className="space-y-1">
            <p className="font-semibold">You&apos;re on Verifund as {roles[0] === "freelancer" ? "a freelancer" : "a client (hiring)"}</p>
            <p className="inline-flex items-start gap-1.5 text-sm text-ink-soft"><Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Your role is set when you sign up. To {roles[0] === "freelancer" ? "hire freelancers" : "work as a freelancer"} too, log out and sign in with a different PayPal account.</p>
          </div>
        </div>
      ) : (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-lg font-semibold">How will you use Verifund?</legend>
          <p className="mb-3 text-sm text-ink-soft">Choose carefully: this can&apos;t be changed later. For the other role, use a different PayPal account.</p>
          <div className="grid gap-3 sm:grid-cols-2">
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
      )}

      <ProfileImport role={isFreelancer ? "freelancer" : "client"} initialUrl={user.portfolioUrl ?? ""} onDraft={onDraft} />
      {imported && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          Draft ready from <b>{imported.url}</b> (read {imported.pages.map((p) => (p === "/" ? "homepage" : p)).join(", ")}). Check the fields below, edit anything, then save.
          {imported.verified && <> Your verification code was found, so your portfolio shows as <b>✓ Verified owner</b>.</>}
        </p>
      )}

      <div key={version} className="contents">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold">Your name{from("displayName")}<input name="displayName" required minLength={2} maxLength={60} defaultValue={v.displayName} className={field} /></label>
        {isClient && <label className="space-y-1.5 text-sm font-semibold">Company <span className="font-normal text-ink-soft">(optional)</span>{from("company")}<input name="company" maxLength={80} defaultValue={v.company} className={field} placeholder="Sunrise Bakery" /></label>}
      </div>

      {isFreelancer && (
        <section className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Your freelancer profile</h2>
          <p className="-mt-3 text-sm text-ink-soft">Clients see this in the freelancer directory.</p>
          <label className="block space-y-1.5 text-sm font-semibold">Headline{from("headline")}<input name="headline" required maxLength={80} defaultValue={v.headline} className={field} placeholder="Web developer · Next.js & Shopify" /></label>
          <label className="block space-y-1.5 text-sm font-semibold">Skills <span className="font-normal text-ink-soft">(comma separated, up to 10)</span>{from("skills")}<input name="skills" defaultValue={v.skills} className={field} placeholder="React, Tailwind, SEO" /></label>
          <label className="block space-y-1.5 text-sm font-semibold">Short bio{from("bio")}<textarea name="bio" rows={5} maxLength={600} defaultValue={v.bio} className={field} placeholder="What you do and who you do it for." /></label>
          <label className="block space-y-1.5 text-sm font-semibold">Portfolio link <span className="font-normal text-ink-soft">(optional)</span><input name="portfolioUrl" type="url" defaultValue={v.portfolioUrl} className={field} placeholder="https://you.dev" /></label>
          <PortfolioOwnership code={ownershipCode} savedUrl={user.portfolioUrl} verified={!!user.portfolioUrl && user.portfolioVerifiedUrl === user.portfolioUrl} />
        </section>
      )}
      </div>

      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">{state.error}</p>}
      <SubmitButton className={`${btn.primary} w-full sm:w-auto`} pending="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
