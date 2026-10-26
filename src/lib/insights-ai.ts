import { FunctionCallingConfigMode, type Content, type GenerateContentConfig } from "@google/genai";
import { generate } from "@/lib/gemini";

// The subset of AG Studio's AgLlmRequest we use (ag-studio/dist/types/api/ai/agLlmAdapter.d.ts).
type Text = { type?: string; text?: string };
type Item = {
  type: string; role?: string; content?: Text[] | string;
  callId?: string; name?: string; arguments?: string; output?: unknown;
};
export type StudioRequest = {
  input: Item[];
  instructions?: string;
  tools?: { name: string; description?: string; parameters?: unknown }[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  responseFormat?: { type: "text" } | { type: "json"; schema: unknown };
};
export type StudioReply = { text: string; calls: { id: string; name: string; args: unknown }[]; model?: string };

// Gemini 3 wants each function call's thought signature back on the next turn; AG Studio doesn't carry it.
// ponytail: in-memory, capped; after a restart we send Gemini's documented bypass value instead.
const signatures = new Map<string, string>();
const BYPASS = "skip_thought_signature_validator";
function remember(id: string, sig: string) {
  signatures.set(id, sig);
  if (signatures.size > 5000) signatures.delete(signatures.keys().next().value!);
}

const textOf = (c: Item["content"]) => (typeof c === "string" ? c : (c ?? []).map((p) => p.text ?? "").join(""));
const parse = (s?: string) => { try { return JSON.parse(s || "{}"); } catch { return {}; } };

// AG Studio's conversation (OpenAI-responses style) → Gemini contents. Same-role turns are merged.
export function toGemini(req: StudioRequest): { contents: Content[]; config: GenerateContentConfig } {
  const contents: Content[] = [];
  const names = new Map<string, string>();
  const push = (role: "user" | "model", part: Content["parts"] extends (infer P)[] | undefined ? P : never) => {
    const last = contents.at(-1);
    if (last?.role === role) last.parts!.push(part);
    else contents.push({ role, parts: [part] });
  };
  for (const it of req.input) {
    if (it.type === "message") {
      const text = textOf(it.content);
      if (text) push(it.role === "assistant" ? "model" : "user", { text });
    } else if (it.type === "function_call" && it.name) {
      names.set(it.callId ?? "", it.name);
      push("model", { functionCall: { id: it.callId, name: it.name, args: parse(it.arguments) }, thoughtSignature: signatures.get(it.callId ?? "") ?? BYPASS });
    } else if (it.type === "function_call_output") {
      const out = typeof it.output === "string" ? it.output : JSON.stringify(it.output);
      push("user", { functionResponse: { id: it.callId, name: names.get(it.callId ?? "") ?? "tool", response: { output: out } } });
    }
  }
  const tools = req.tools?.length
    ? [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }]
    : undefined;
  const choice = req.toolChoice;
  const config: GenerateContentConfig = {
    systemInstruction: req.instructions,
    tools,
    ...(tools && choice && choice !== "auto" && {
      toolConfig: { functionCallingConfig: choice === "none" ? { mode: FunctionCallingConfigMode.NONE }
        : { mode: FunctionCallingConfigMode.ANY, ...(typeof choice === "object" && { allowedFunctionNames: [choice.name] }) } },
    }),
    ...(!tools && req.responseFormat?.type === "json" && { responseMimeType: "application/json", responseJsonSchema: req.responseFormat.schema }),
  };
  return { contents, config };
}

export async function askStudio(req: StudioRequest): Promise<StudioReply> {
  const { contents, config } = toGemini(req);
  const res = await generate({ contents, config });
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  const calls = parts.flatMap((p) => {
    if (!p.functionCall) return [];
    const id = p.functionCall.id || crypto.randomUUID();
    if (p.thoughtSignature) remember(id, p.thoughtSignature);
    return [{ id, name: p.functionCall.name ?? "", args: p.functionCall.args ?? {} }];
  });
  return { text: parts.filter((p) => p.text && !p.thought).map((p) => p.text).join(""), calls, model: res.modelVersion };
}
