import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/session";
import { currentView } from "@/lib/view";
import { loadInsights } from "@/lib/insights";
import { env } from "@/lib/env";
import { Header } from "@/components/header";
import { InsightsStudioLazy } from "./studio-lazy";

export default async function Insights() {
  const user = await requireUser();
  // Same client/freelancer switch as the dashboard; admins look at the whole platform.
  const side = user.isAdmin ? "platform" : await currentView(user);
  const data = await loadInsights(user, side);
  const intro = { platform: "Every job on Verifund.", client: "What you've funded and paid, as a client.", freelancer: "What you've earned and what's on hold for you, as a freelancer." }[side];
  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-3 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold">Insights</h1>
            <p className="text-sm text-ink-soft">{intro} Drag widgets to rearrange, or ask the AI for a new chart.</p>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-soft"><Sparkles aria-hidden className="size-3.5" /> Built with AG Studio · AI by Gemini</p>
        </div>
        {data.milestones.length ? (
          <div className="h-[calc(100vh-11rem)] min-h-[640px] overflow-hidden rounded-xl border border-line bg-white">
            <InsightsStudioLazy data={data} licenseKey={env.AG_STUDIO_LICENSE_KEY} />
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-white p-8 text-center text-ink-soft">{side === "freelancer" ? "No freelance jobs yet. Insights appear once a client hires you." : "No jobs yet. Insights appear once you have a milestone."}</p>
        )}
      </main>
    </>
  );
}
