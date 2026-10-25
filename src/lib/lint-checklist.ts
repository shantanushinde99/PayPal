import { generate } from "@/lib/gemini";

const schema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          verdict: { type: "string", enum: ["ok", "vague", "unverifiable"] },
          suggestion: { type: "string" },
        },
        required: ["index", "verdict"],
      },
    },
  },
  required: ["items"],
};

export function toLintNotes(count: number, raw: unknown[], proofType: string): (string | null)[] {
  const notes: (string | null)[] = Array(count).fill(null);
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { index, verdict, suggestion } = r as { index?: unknown; verdict?: unknown; suggestion?: unknown };
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= count) continue;
    if (verdict !== "vague" && verdict !== "unverifiable") continue;
    const what = verdict === "vague" ? "Too vague to check" : `Can't be verified from ${proofType === "photo" ? "photos" : "the website"}`;
    notes[index] = suggestion ? `${what}. Try: "${String(suggestion).slice(0, 200)}"` : `${what}.`;
  }
  return notes;
}

// Advisory only: any AI problem means "no hints", never a blocked save.
export async function lintChecklist(proofType: string, items: string[]): Promise<(string | null)[]> {
  try {
    const res = await generate({
      contents: `Proof type: ${proofType === "photo" ? "before/after photos" : "live website"}\nChecklist:\n${items.map((t, i) => `${i}: ${t}`).join("\n")}`,
      config: {
        systemInstruction:
          "You review an escrow checklist before money is held. For each item decide: 'ok' if a reviewer can verify it objectively " +
          "from the given proof type; 'vague' if it is subjective or unclear (e.g. 'looks modern', 'high quality'); 'unverifiable' if the " +
          "proof type can't show it (e.g. 'loads in under 1s' from photos, 'server is secure' from a website). For vague/unverifiable items " +
          "suggest one concrete, checkable rewrite in the same language.",
        responseMimeType: "application/json",
        responseJsonSchema: schema,
      },
    });
    return toLintNotes(items.length, JSON.parse(res.text ?? "{}").items ?? [], proofType);
  } catch {
    return items.map(() => null);
  }
}
