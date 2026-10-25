"use client";

// Formats in the viewer's own timezone (the server may run in UTC). The server-rendered
// text can differ by timezone, hence suppressHydrationWarning.
export function LocalTime({ date, mode = "datetime" }: { date: Date | string; mode?: "datetime" | "time" | "full" }) {
  const d = new Date(date);
  const text = mode === "time"
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : mode === "full"
      ? d.toLocaleString([], { dateStyle: "medium", timeStyle: "medium" })
      : d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return <time dateTime={d.toISOString()} suppressHydrationWarning>{text}</time>;
}
