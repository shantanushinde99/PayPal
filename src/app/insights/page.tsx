import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/session";
import { loadInsights } from "@/lib/insights";
import { env } from "@/lib/env";
import { Header } from "@/components/header";
import { InsightsStudioLazy } from "./studio-lazy";

export default async function Insights() {
  const user = await requireUser();
  const data = await loadInsights(user);
  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-3 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold">Insights</h1>
            <p className="text-sm text-ink-soft">{user.isAdmin ? "Every job on Verifund." : "Your jobs, payments and AI checks."} Drag widgets to rearrange, or ask the AI for a new chart.</p>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-soft"><Sparkles aria-hidden className="size-3.5" /> Built with AG Studio · AI by Gemini</p>
        </div>
        {data.milestones.length ? (
          <div className="h-[calc(100vh-11rem)] min-h-[640px] overflow-hidden rounded-xl border border-line bg-white">
            <InsightsStudioLazy data={data} licenseKey={env.AG_STUDIO_LICENSE_KEY} />
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-white p-8 text-center text-ink-soft">No jobs yet. Insights appear once you have a milestone.</p>
        )}
      </main>
    </>
  );
}
