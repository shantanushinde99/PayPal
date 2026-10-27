"use client";
import { useLayoutEffect } from "react";

const KEY = "verifund-demo-tab";

// Demo logins last for days, but a judge who closes the tab and comes back should see the home page, not an old
// workspace. The marker lives in sessionStorage, so it belongs to this tab only and vanishes when the tab closes.
// Entering the demo on purpose ("Try the live demo", "Your dashboard", switching sides) arrives with ?enter=1.
export function DemoEntryGate() {
  useLayoutEffect(() => {
    try {
      const url = new URL(location.href);
      if (url.searchParams.get("enter") === "1") {
        sessionStorage.setItem(KEY, "1");
        url.searchParams.delete("enter");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      } else if (!sessionStorage.getItem(KEY)) {
        location.replace("/welcome");
      }
    } catch { /* storage blocked: just show the dashboard */ }
  }, []);
  return null;
}
