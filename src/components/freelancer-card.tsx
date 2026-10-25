import { BadgeCheck, ExternalLink } from "lucide-react";
import type { DirectoryEntry } from "@/lib/directory";

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function FreelancerSummary({ f }: { f: DirectoryEntry }) {
  const name = f.displayName ?? "Freelancer";
  return (
    <div className="flex items-start gap-4">
      <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-violet-500 font-display text-lg font-bold text-white">{initials(name)}</span>
      <div className="min-w-0 space-y-1">
        <p className="font-display text-lg font-semibold">{name}</p>
        <p className="text-sm text-ink-soft">{f.headline}</p>
        <p className="text-xs font-medium">
          {f.trackRecord
            ? <span className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck aria-hidden className="size-3.5" />{f.trackRecord.paid} milestone{f.trackRecord.paid === 1 ? "" : "s"} paid · {f.trackRecord.firstTry}% verified first try</span>
            : <span className="text-ink-soft">New on Verifund</span>}
        </p>
      </div>
    </div>
  );
}

export function SkillChips({ skills }: { skills: string[] }) {
  if (!skills.length) return null;
  return <ul className="flex flex-wrap gap-1.5">{skills.map((s) => <li key={s} className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-soft">{s}</li>)}</ul>;
}

export function PortfolioLink({ url }: { url: string | null }) {
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer nofollow" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand hover:underline">Portfolio <ExternalLink aria-hidden className="size-3.5" /></a>;
}
