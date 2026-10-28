"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// A slim bar at the top the moment an in-app link is clicked, while the current page stays on screen.
// Covers pages without a loading.tsx (like the dashboard, which shares "/" with the landing page).
export function NavProgress() {
  const path = usePathname(), query = useSearchParams();
  const here = path + (query.size ? "?" + query.toString() : "");
  // The address the click started from: once the URL changes, the new page has arrived and the bar goes away.
  const [from, setFrom] = useState<string | null>(null);
  const busy = from === here;
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || (to.pathname === location.pathname && to.search === location.search)) return;
      setFrom(location.pathname + location.search);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  if (!busy) return null;
  return (
    <div role="progressbar" aria-label="Loading page" className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-sky-100">
      <div className="h-full w-1/3 animate-[navbar_1s_ease-in-out_infinite] bg-brand" />
    </div>
  );
}
