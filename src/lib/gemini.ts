import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { env } from "@/lib/env";
import { RateLimiter } from "@/lib/rate-limiter";

let client: GoogleGenAI | undefined; // created on first use: `next build` loads this module without secrets
const ai = () => (client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }));
const MODELS = [env.GEMINI_MODEL_PRIMARY, env.GEMINI_MODEL_FALLBACK];
export const CHAT_MODELS = [env.GEMINI_MODEL_FALLBACK, env.GEMINI_MODEL_PRIMARY];
const limiter = new RateLimiter(14, 480);
const MAX_WAIT = 90_000;

export class AiBusyError extends Error {
  constructor() { super("The AI is busy right now (limit reached or overloaded). Please try again in a minute."); }
}

// Quota hit (429) or model overloaded (503): the other model may still answer.
export const shouldTryOtherModel = (e: unknown) => /429|RESOURCE_EXHAUSTED|quota|503|UNAVAILABLE|overloaded/i.test(String(e));

// Free-plan Mistral models (ministral-14b: 30 requests/min, ministral-8b: 188/min), strongest first.
export const MISTRAL_MODELS = ["ministral-14b-latest", "ministral-8b-latest"];

// Text in, JSON out (planning, checklist checks, the AI Judge…): no tools, no images. These go to Mistral first, so
// Gemini's quota is left for the website agent and photo checks, which need tools and vision.
export const isTextTask = (req: Omit<GenerateContentParameters, "model">) => typeof req.contents === "string" && !req.config?.tools;

async function mistral(req: Omit<GenerateContentParameters, "model">, model: string, doFetch: typeof fetch = fetch): Promise<string> {
  const schema = req.config?.responseJsonSchema;
  const system = req.config?.systemInstruction;
  const res = await doFetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.MISTRAL_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model, temperature: 0.2,
      messages: [...(typeof system === "string" ? [{ role: "system", content: system }] : []), { role: "user", content: req.contents }],
      ...(schema ? { response_format: { type: "json_schema", json_schema: { name: "answer", schema, strict: true } } } : {}),
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Mistral ${model} ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  const content = body?.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.filter((c) => c?.type === "text").map((c) => c.text).join("") : content;
  if (typeof text !== "string" || !text.trim()) throw new Error(`Mistral ${model}: empty answer`);
  return text;
}

// `models`: try order. The checker uses primary-first; the Insights chat prefers the fallback model so they share less quota.
export async function generate(req: Omit<GenerateContentParameters, "model">, models = MODELS, doFetch: typeof fetch = fetch) {
  if (env.MISTRAL_API_KEY && isTextTask(req)) {
    for (const model of MISTRAL_MODELS) {
      try {
        return { text: await mistral(req, model, doFetch), modelVersion: model } as unknown as GenerateContentResponse; // callers read .text
      } catch (e) {
        console.warn("Mistral unavailable, trying the next model", String(e).slice(0, 160)); // any failure: Gemini still answers
      }
    }
  }
  const deadline = Date.now() + MAX_WAIT;
  const exhausted = new Set<string>();
  while (Date.now() < deadline) {
    const usable = models.filter((m) => !exhausted.has(m));
    if (!usable.length) break;
    const model = usable.find((m) => limiter.waitMs(m) === 0);
    if (!model) {
      const wait = Math.min(...usable.map((m) => limiter.waitMs(m)));
      if (!Number.isFinite(wait) || Date.now() + wait > deadline) break;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    limiter.record(model);
    try {
      return await ai().models.generateContent({ ...req, model });
    } catch (e) {
      if (!shouldTryOtherModel(e)) throw e;
      exhausted.add(model);
    }
  }
  throw new AiBusyError();
}
