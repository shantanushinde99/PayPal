export type VerdictStatus = "pass" | "fail" | "unsure";
export type VerdictItem = { checklistItemId: string; status: VerdictStatus; reason: string };

const STATUSES = new Set<string>(["pass", "fail", "unsure"]);

// AI output is untrusted: anything missing or malformed becomes "unsure", which holds the money.
export function normalizeVerdict(checklistIds: string[], raw: unknown[]): VerdictItem[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of raw) {
    if (r && typeof r === "object" && "checklistItemId" in r) byId.set(String(r.checklistItemId), r as Record<string, unknown>);
  }
  return checklistIds.map((id) => {
    const r = byId.get(id);
    if (!r) return { checklistItemId: id, status: "unsure", reason: "The AI did not check this item." };
    const status = STATUSES.has(String(r.status)) ? (r.status as VerdictStatus) : "unsure";
    return { checklistItemId: id, status, reason: String(r.reason ?? "") };
  });
}

export const shouldRelease = (items: VerdictItem[]) => items.length > 0 && items.every((i) => i.status === "pass");
