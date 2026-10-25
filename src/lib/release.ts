export type VerdictStatus = "pass" | "fail" | "unsure";
export type VerdictItem = { checklistItemId: string; status: VerdictStatus; reason: string; evidence?: string; pageUrl?: string };

const STATUSES = new Set<string>(["pass", "fail", "unsure"]);
const RANK: Record<string, number> = { pass: 0, unsure: 1, fail: 2 };
const rank = (s: unknown) => RANK[String(s)] ?? RANK.unsure;

// AI output is untrusted: anything missing or malformed becomes "unsure", which holds the money.
export function normalizeVerdict(checklistIds: string[], raw: unknown[]): VerdictItem[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of raw) {
    if (!r || typeof r !== "object" || !("checklistItemId" in r)) continue;
    const item = r as Record<string, unknown>;
    const prev = byId.get(String(item.checklistItemId));
    if (!prev || rank(item.status) > rank(prev.status)) byId.set(String(item.checklistItemId), item); // repeated id: worst status wins
  }
  return checklistIds.map((id) => {
    const r = byId.get(id);
    if (!r) return { checklistItemId: id, status: "unsure", reason: "The AI did not check this item." };
    const status = STATUSES.has(String(r.status)) ? (r.status as VerdictStatus) : "unsure";
    return {
      checklistItemId: id, status, reason: String(r.reason ?? ""),
      ...(r.evidence ? { evidence: String(r.evidence).slice(0, 500) } : {}),
      ...(r.pageUrl ? { pageUrl: String(r.pageUrl).slice(0, 500) } : {}),
    };
  });
}

export const shouldRelease = (items: VerdictItem[]) => items.length > 0 && items.every((i) => i.status === "pass");
