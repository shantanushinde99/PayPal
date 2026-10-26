"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Polls while a check runs; otherwise refreshes once just after the next review window ends
// (the release sweeper runs every minute).
export function AutoRefresh({ active, refreshAt }: { active: boolean; refreshAt?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (active) {
      const t = setInterval(() => router.refresh(), 2000);
      return () => clearInterval(t);
    }
    if (!refreshAt) return;
    const ms = new Date(refreshAt).getTime() + 65_000 - Date.now();
    if (ms > 2 ** 31 - 1) return; // setTimeout limit (~24.8 days); far-off windows refresh on next visit
    const t = setTimeout(() => router.refresh(), Math.max(1000, ms));
    return () => clearTimeout(t);
  }, [active, refreshAt, router]);
  return null;
}
