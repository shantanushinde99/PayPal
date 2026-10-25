const MINUTE = 60_000;
const DAY = 24 * 3600_000;

// ponytail: in-memory rolling windows, resets on restart; Gemini's 429 + fallback model cover the gap.
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private perMinute: number, private perDay: number) {}

  waitMs(key: string, now = Date.now()): number {
    const day = (this.hits.get(key) ?? []).filter((t) => now - t < DAY);
    this.hits.set(key, day);
    if (day.length >= this.perDay) return Infinity;
    const minute = day.filter((t) => now - t < MINUTE);
    return minute.length < this.perMinute ? 0 : minute[0] + MINUTE - now;
  }

  record(key: string, now = Date.now()) {
    this.hits.set(key, [...(this.hits.get(key) ?? []), now]);
  }
}
