import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { env } from "@/lib/env";
import { RateLimiter } from "@/lib/rate-limiter";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const MODELS = [env.GEMINI_MODEL_PRIMARY, env.GEMINI_MODEL_FALLBACK];
const limiter = new RateLimiter(14, 480);
const MAX_WAIT = 90_000;

export class AiBusyError extends Error {
  constructor() { super("The AI is busy right now (limit reached or overloaded). Please try again in a minute."); }
}

// Quota hit (429) or model overloaded (503): the other model may still answer.
export const shouldTryOtherModel = (e: unknown) => /429|RESOURCE_EXHAUSTED|quota|503|UNAVAILABLE|overloaded/i.test(String(e));

export async function generate(req: Omit<GenerateContentParameters, "model">) {
  const deadline = Date.now() + MAX_WAIT;
  const exhausted = new Set<string>();
  while (Date.now() < deadline) {
    const usable = MODELS.filter((m) => !exhausted.has(m));
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
      return await ai.models.generateContent({ ...req, model });
    } catch (e) {
      if (!shouldTryOtherModel(e)) throw e;
      exhausted.add(model);
    }
  }
  throw new AiBusyError();
}
