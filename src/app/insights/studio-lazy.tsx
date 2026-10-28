"use client";
import dynamic from "next/dynamic";

// AG Studio is several MB of JavaScript: load it after the page appears, with a placeholder meanwhile.
export const InsightsStudioLazy = dynamic(() => import("./studio").then((m) => m.InsightsStudio), {
  ssr: false,
  loading: () => <div aria-busy="true" className="grid h-full place-items-center text-sm text-ink-soft">Loading the Insights dashboard…</div>,
});
